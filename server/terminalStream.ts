import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Request, Response } from 'express';
import { jobManager } from './jobManager';
import { LogEntry } from './types';

interface WSClientMeta {
  ws: WebSocket;
  isAlive: boolean;
  subscribedJobId: string | 'all';
}

class TerminalStreamService {
  private wss: WebSocketServer | null = null;
  private wsClients: Set<WSClientMeta> = new Set();
  private sseClients: Map<string, Set<Response>> = new Map(); // key is jobId or 'all'
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Initializes the WebSocket Server attached to the HTTP server
   */
  public attachToServer(server: HttpServer) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/terminal',
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      // Parse query string for jobId if provided: /ws/terminal?jobId=xyz
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const initialJobId = url.searchParams.get('jobId') || 'all';

      const clientMeta: WSClientMeta = {
        ws,
        isAlive: true,
        subscribedJobId: initialJobId,
      };

      this.wsClients.add(clientMeta);

      // Send initial welcome message
      this.sendToWs(ws, {
        type: 'connected',
        transport: 'websocket',
        subscribedJobId: initialJobId,
        timestamp: new Date().toISOString(),
        message: `Real-time WebSocket terminal stream connected (Subscription: ${initialJobId})`,
      });

      // If subscribed to a specific job, send its existing logs immediately
      if (initialJobId !== 'all') {
        const job = jobManager.getJob(initialJobId);
        if (job) {
          this.sendToWs(ws, {
            type: 'history',
            jobId: initialJobId,
            logs: job.logs,
            status: job.status,
            plan: job.plan,
          });
        }
      }

      ws.on('pong', () => {
        clientMeta.isAlive = true;
      });

      ws.on('message', (raw) => {
        try {
          const message = JSON.parse(raw.toString());
          this.handleClientMessage(clientMeta, message);
        } catch {
          // Ignore malformed messages or ping strings
          if (raw.toString() === 'ping') {
            ws.send('pong');
          }
        }
      });

      ws.on('close', () => {
        this.wsClients.delete(clientMeta);
      });

      ws.on('error', (err) => {
        console.error('[TerminalStream WS Error]', err.message);
        this.wsClients.delete(clientMeta);
      });
    });

    // Start 15s ping-pong keepalive interval
    this.heartbeatInterval = setInterval(() => {
      this.wsClients.forEach((client) => {
        if (!client.isAlive) {
          client.ws.terminate();
          this.wsClients.delete(client);
          return;
        }
        client.isAlive = false;
        client.ws.ping();
      });

      // Also send SSE keepalive comments to prevent proxy timeouts
      this.sseClients.forEach((responses) => {
        responses.forEach((res) => {
          if (!res.writableEnded) {
            res.write(': keepalive\n\n');
          }
        });
      });
    }, 15000);

    // Subscribe to jobManager events
    this.bindJobManagerEvents();

    console.log('[TerminalStream] WebSocket and SSE streaming service initialized at /ws/terminal and /api/terminal/stream');
  }

  /**
   * Handles incoming client messages over WebSocket
   */
  private handleClientMessage(client: WSClientMeta, data: any) {
    if (data.type === 'subscribe') {
      const jobId = data.jobId || 'all';
      client.subscribedJobId = jobId;

      this.sendToWs(client.ws, {
        type: 'subscribed',
        subscribedJobId: jobId,
        timestamp: new Date().toISOString(),
      });

      if (jobId !== 'all') {
        const job = jobManager.getJob(jobId);
        if (job) {
          this.sendToWs(client.ws, {
            type: 'history',
            jobId,
            logs: job.logs,
            status: job.status,
            plan: job.plan,
          });
        }
      }
    } else if (data.type === 'ping') {
      this.sendToWs(client.ws, { type: 'pong', timestamp: new Date().toISOString() });
    }
  }

  /**
   * Binds to JobManager lifecycle and log events to stream to all WebSocket and SSE listeners
   */
  private bindJobManagerEvents() {
    // Whenever any log is added to any job
    jobManager.on('job_log', ({ jobId, log }: { jobId: string; log: LogEntry }) => {
      this.broadcastLog(jobId, log);
    });

    // Whenever a job status changes
    jobManager.on('job_status', ({ jobId, job }: { jobId: string; job: any }) => {
      this.broadcastJobUpdate(jobId, job);
    });
  }

  /**
   * Broadcasts a terminal log entry to WebSocket and SSE clients
   */
  public broadcastLog(jobId: string, log: LogEntry) {
    // 1. WebSocket delivery
    const wsPayload = JSON.stringify({
      type: 'log',
      jobId,
      log,
      timestamp: log.timestamp || new Date().toISOString(),
    });

    this.wsClients.forEach((client) => {
      if (
        client.ws.readyState === WebSocket.OPEN &&
        (client.subscribedJobId === 'all' || client.subscribedJobId === jobId)
      ) {
        client.ws.send(wsPayload);
      }
    });

    // 2. SSE delivery
    const sseData = `data: ${JSON.stringify({ type: 'log', jobId, entry: log })}\n\n`;

    // Send to specific job SSE clients
    const jobSubscribers = this.sseClients.get(jobId);
    if (jobSubscribers) {
      jobSubscribers.forEach((res) => {
        if (!res.writableEnded) res.write(sseData);
      });
    }

    // Send to 'all' SSE clients
    const allSubscribers = this.sseClients.get('all');
    if (allSubscribers) {
      allSubscribers.forEach((res) => {
        if (!res.writableEnded) res.write(sseData);
      });
    }
  }

  /**
   * Broadcasts a job status update or completion
   */
  public broadcastJobUpdate(jobId: string, job: any) {
    const wsPayload = JSON.stringify({
      type: 'status',
      jobId,
      status: job.status,
      plan: job.plan,
      error: job.error,
      updatedAt: job.updatedAt,
    });

    this.wsClients.forEach((client) => {
      if (
        client.ws.readyState === WebSocket.OPEN &&
        (client.subscribedJobId === 'all' || client.subscribedJobId === jobId)
      ) {
        client.ws.send(wsPayload);
      }
    });

    const sseData = `data: ${JSON.stringify({ type: 'status', jobId, job })}\n\n`;

    const jobSubscribers = this.sseClients.get(jobId);
    if (jobSubscribers) {
      jobSubscribers.forEach((res) => {
        if (!res.writableEnded) res.write(sseData);
      });
    }

    const allSubscribers = this.sseClients.get('all');
    if (allSubscribers) {
      allSubscribers.forEach((res) => {
        if (!res.writableEnded) res.write(sseData);
      });
    }
  }

  /**
   * Broadcasts a test step lifecycle event (running, passed, failed, healed)
   */
  public broadcastStepEvent(jobId: string, eventData: any) {
    this.broadcastToJob(jobId, 'step_event', eventData);
  }

  /**
   * Broadcasts an arbitrary typed event to all clients listening to a jobId
   */
  public broadcastToJob(jobId: string, type: string, payload: any) {
    const wsPayload = JSON.stringify({
      type,
      jobId,
      ...payload,
      timestamp: new Date().toISOString(),
    });

    this.wsClients.forEach((client) => {
      if (
        client.ws.readyState === WebSocket.OPEN &&
        (client.subscribedJobId === 'all' || client.subscribedJobId === jobId)
      ) {
        client.ws.send(wsPayload);
      }
    });

    const sseData = `data: ${JSON.stringify({ type, jobId, ...payload })}\n\n`;

    const jobSubscribers = this.sseClients.get(jobId);
    if (jobSubscribers) {
      jobSubscribers.forEach((res) => {
        if (!res.writableEnded) res.write(sseData);
      });
    }

    const allSubscribers = this.sseClients.get('all');
    if (allSubscribers) {
      allSubscribers.forEach((res) => {
        if (!res.writableEnded) res.write(sseData);
      });
    }
  }

  /**
   * Registers an SSE response stream for a job or 'all'
   */
  public registerSSEClient(req: Request, res: Response, targetJobId: string = 'all') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send initial handshake
    res.write(
      `data: ${JSON.stringify({
        type: 'init',
        transport: 'sse',
        targetJobId,
        connectedAt: new Date().toISOString(),
      })}\n\n`
    );

    // If connected to a specific job, send history
    if (targetJobId !== 'all') {
      const job = jobManager.getJob(targetJobId);
      if (job) {
        res.write(`data: ${JSON.stringify({ type: 'history', job })}\n\n`);
      }
    }

    if (!this.sseClients.has(targetJobId)) {
      this.sseClients.set(targetJobId, new Set());
    }
    this.sseClients.get(targetJobId)!.add(res);

    req.on('close', () => {
      const clientSet = this.sseClients.get(targetJobId);
      if (clientSet) {
        clientSet.delete(res);
        if (clientSet.size === 0) {
          this.sseClients.delete(targetJobId);
        }
      }
    });
  }

  private sendToWs(ws: WebSocket, payload: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  public getStatus() {
    return {
      connectedWsClients: this.wsClients.size,
      activeSseTopics: Array.from(this.sseClients.keys()),
    };
  }
}

export const terminalStreamService = new TerminalStreamService();
