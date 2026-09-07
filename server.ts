import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { runPlannerAgent } from './server/plannerAgent';
import { runCodeGeneratorAgent, executePlaywrightHeadlessRun } from './server/generatorAgent';
import {
  runPlaywrightTestEngine,
  getReportById,
  listAllReports,
  generatePlaywrightHtmlReport,
  generateJiraExport,
  generateGitHubExport,
} from './server/testRunner';
import { runHealerAgent } from './server/healerAgent';
import { jobManager, testLLMConnection } from './server/jobManager';
import { terminalStreamService } from './server/terminalStream';
import { LLMConfig } from './server/types';
import fs from 'fs';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // Initialize and attach WebSocket and SSE streaming server
  terminalStreamService.attachToServer(server);

  // JSON body parser with generous limit for specs
  app.use(express.json({ limit: '10mb' }));

  // API Health Check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'playwright-agent-studio',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      streaming: terminalStreamService.getStatus(),
    });
  });

  // Test connection to custom OpenAI-compatible LLM endpoint
  app.post('/api/llm/test-connection', async (req: Request, res: Response) => {
    try {
      const config: LLMConfig = req.body;
      if (!config || !config.baseUrl) {
        return res.status(400).json({ error: 'baseUrl is required' });
      }
      const result = await testLLMConnection(config);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to test connection' });
    }
  });

  // Synchronous Planner execution
  app.post('/api/planner/execute', async (req: Request, res: Response) => {
    try {
      const { requirement, targetUrl, llmConfig, options } = req.body;
      if (!requirement) {
        return res.status(400).json({ error: 'requirement string is required' });
      }

      const logs: string[] = [];
      const plan = await runPlannerAgent(
        requirement,
        targetUrl || 'https://example.com',
        llmConfig || {
          baseUrl: 'http://localhost:11434/v1',
          model: 'llama3.3',
          provider: 'ollama',
        },
        {
          ...options,
          onLog: (line) => logs.push(line),
        }
      );

      res.json({ success: true, plan, logs });
    } catch (err: any) {
      console.error('[API /api/planner/execute] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Create an asynchronous Planner job
  app.post('/api/planner/jobs', (req: Request, res: Response) => {
    const { requirement, targetUrl, llmConfig } = req.body;
    if (!requirement) {
      return res.status(400).json({ error: 'requirement is required' });
    }

    const resolvedConfig: LLMConfig = llmConfig || {
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.3',
      provider: 'ollama',
    };

    const job = jobManager.createJob(requirement, targetUrl || 'https://example.com', resolvedConfig);
    res.status(201).json(job);
  });

  // List all planner jobs
  app.get('/api/planner/jobs', (req: Request, res: Response) => {
    res.json(jobManager.listJobs());
  });

  // Get single job detail
  app.get('/api/planner/jobs/:jobId', (req: Request, res: Response) => {
    const job = jobManager.getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  });

  // Approve a test plan (Human-in-the-Loop workflow)
  app.put('/api/planner/jobs/:jobId/approve', (req: Request, res: Response) => {
    try {
      const { steps, notes, rawMarkdown, title } = req.body;
      if (!Array.isArray(steps)) {
        return res.status(400).json({ error: 'steps array is required' });
      }
      const updatedJob = jobManager.updateJobApproval(
        req.params.jobId,
        steps,
        rawMarkdown,
        notes,
        title
      );
      res.json(updatedJob);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ==========================================
  // PHASE 2: Playwright Code Generator Routes
  // ==========================================

  // POST /api/generate-code: Convert approved Markdown test plan into Playwright TypeScript spec
  app.post('/api/generate-code', async (req: Request, res: Response) => {
    try {
      const {
        jobId,
        title,
        targetUrl,
        steps,
        rawMarkdown,
        notes,
        llmConfig,
        outputPath,
        testName,
      } = req.body;

      if (!targetUrl) {
        return res.status(400).json({ error: 'targetUrl is required' });
      }

      const activeJobId = jobId || (steps && steps[0]?.id ? `job-${Date.now()}` : undefined);

      if (activeJobId) {
        jobManager.setJobStatus(activeJobId, 'generating_code');
        jobManager.addLog(
          activeJobId,
          `[Phase 2: Generator Agent] Code generation initiated for "${title || 'Playwright Test Spec'}"`,
          'info'
        );
      }

      const logs: string[] = [];
      const resolvedLLMConfig: LLMConfig = llmConfig || {
        baseUrl: 'http://localhost:11434/v1',
        model: 'llama3.3',
        provider: 'ollama',
      };

      const spec = await runCodeGeneratorAgent(
        {
          jobId: activeJobId,
          title: title || 'Automated End-to-End Test',
          targetUrl,
          steps: Array.isArray(steps) ? steps : [],
          rawMarkdown: rawMarkdown || '',
          notes: notes || '',
          llmConfig: resolvedLLMConfig,
          outputPath: outputPath || 'tests/e2e/test-1.spec.ts',
          testName,
        },
        {
          onLog: (line, level) => {
            logs.push(line);
            if (activeJobId) {
              jobManager.addLog(activeJobId, line, level || 'info');
            }
          },
        }
      );

      if (activeJobId) {
        jobManager.setGeneratedCode(activeJobId, spec);
      }

      res.status(200).json({
        success: true,
        spec,
        outputPath: spec.relativeFilePath,
        logs,
      });
    } catch (err: any) {
      console.error('[API /api/generate-code] Error:', err);
      if (req.body.jobId) {
        jobManager.addLog(req.body.jobId, `[Phase 2 Error] ${err.message}`, 'error');
        jobManager.setJobStatus(req.body.jobId, 'failed');
      }
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to generate Playwright code',
      });
    }
  });

  // PUT /api/generate-code/save: Manual code editor save endpoint
  app.put('/api/generate-code/save', (req: Request, res: Response) => {
    try {
      const { jobId, code, filePath } = req.body;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'code string is required' });
      }

      if (jobId && jobManager.getJob(jobId)) {
        const updated = jobManager.updateGeneratedCode(jobId, code);
        return res.json({ success: true, spec: updated.generatedCode });
      }

      // If no jobId or standalone file
      const targetPath = filePath
        ? path.resolve(process.cwd(), filePath)
        : path.join(process.cwd(), 'tests', 'e2e', 'test-1.spec.ts');

      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, code, 'utf-8');

      res.json({
        success: true,
        message: `Saved to ${path.relative(process.cwd(), targetPath)}`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // PHASE 3: Self-Healing Execution Engine & Extended Reporting Routes
  // ==========================================

  // Handler for running Playwright tests with autonomous self-healing
  const handleTestRun = async (req: Request, res: Response) => {
    try {
      const {
        jobId,
        targetUrl,
        selfHealingEnabled,
        simulateFailureScenario,
        specFilePath,
        specCode,
        llmConfig,
      } = req.body;

      const job = jobId ? jobManager.getJob(jobId) : null;
      const effectiveUrl = targetUrl || job?.targetUrl || 'https://example.com';
      const effectiveConfig = llmConfig || job?.llmConfig;

      const defaultSpecPath = specFilePath || path.join(process.cwd(), 'tests', 'e2e', 'test-1.spec.ts');
      let effectiveCode = specCode || job?.generatedCode?.code;

      if (!effectiveCode && fs.existsSync(defaultSpecPath)) {
        effectiveCode = fs.readFileSync(defaultSpecPath, 'utf-8');
      }

      if (jobId) {
        jobManager.setJobStatus(jobId, 'executing_test');
        jobManager.addLog(
          jobId,
          `[Phase 3 Runner] Initiating test execution with Self-Healing ${selfHealingEnabled !== false ? 'ENABLED' : 'DISABLED'}`,
          'info'
        );
      }

      // Execute through Phase 3 test engine
      const report = await runPlaywrightTestEngine({
        jobId,
        targetUrl: effectiveUrl,
        specFilePath: defaultSpecPath,
        specCode: effectiveCode,
        llmConfig: effectiveConfig,
        selfHealingEnabled: selfHealingEnabled !== false,
        simulateFailureScenario: !!simulateFailureScenario,
        onLog: (msg, level) => {
          if (jobId) {
            jobManager.addLog(jobId, msg, level || 'info');
          }
        },
      });

      // Record test execution and report in job manager
      if (jobId) {
        jobManager.recordTestExecution(jobId, {
          status: report.status,
          durationMs: report.durationMs,
          passedSteps: report.passedSteps,
          totalSteps: report.totalSteps,
          outputLogs: report.outputLogs,
          healedCount: report.healedSteps,
          report,
        });
      }

      res.json({
        success: true,
        report,
        status: report.status,
        healed: report.status === 'healed',
      });
    } catch (err: any) {
      console.error('[API /api/run-test] Error:', err);
      if (req.body.jobId) {
        jobManager.addLog(req.body.jobId, `[Execution Error] ${err.message}`, 'error');
        jobManager.setJobStatus(req.body.jobId, 'test_failed');
      }
      res.status(500).json({ success: false, error: err.message });
    }
  };

  // POST /api/run-test: Phase 3 Test Execution Trigger with Self-Healing Loop
  app.post('/api/run-test', handleTestRun);

  // POST /api/tests/run: Backward-compatible alias
  app.post('/api/tests/run', handleTestRun);

  // POST /api/healer/repair: Standalone Autonomous Healer Agent invocation
  app.post('/api/healer/repair', async (req: Request, res: Response) => {
    try {
      const {
        specFilePath,
        brokenCode,
        failedStep,
        domSnapshot,
        targetUrl,
        llmConfig,
      } = req.body;

      if (!failedStep || !brokenCode) {
        return res.status(400).json({ error: 'failedStep and brokenCode are required' });
      }

      const result = await runHealerAgent({
        specFilePath: specFilePath || path.join(process.cwd(), 'tests', 'e2e', 'test-1.spec.ts'),
        brokenCode,
        failedStep,
        domSnapshot,
        targetUrl: targetUrl || 'https://example.com',
        llmConfig: llmConfig || {
          baseUrl: 'http://localhost:11434/v1',
          model: 'llama3.3',
          provider: 'ollama',
        },
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/reports: List cached execution reports
  app.get('/api/reports', (req: Request, res: Response) => {
    res.json(listAllReports());
  });

  // GET /api/reports/:id: Retrieve report details
  app.get('/api/reports/:id', (req: Request, res: Response) => {
    const report = getReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json(report);
  });

  // GET /api/reports/:id/html: Serve standalone interactive Playwright HTML Report
  app.get('/api/reports/:id/html', (req: Request, res: Response) => {
    const report = getReportById(req.params.id);
    if (!report) {
      return res.status(404).send('<h2>Report not found</h2>');
    }
    const html = generatePlaywrightHtmlReport(report);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  // GET /api/reports/:id/export/jira: Export report as Jira markdown
  app.get('/api/reports/:id/export/jira', (req: Request, res: Response) => {
    const report = getReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    const markdown = generateJiraExport(report);
    res.json({ markdown, fileName: `jira-bug-${report.id}.txt` });
  });

  // GET /api/reports/:id/export/github: Export report as GitHub issue markdown
  app.get('/api/reports/:id/export/github', (req: Request, res: Response) => {
    const report = getReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    const markdown = generateGitHubExport(report);
    res.json({ markdown, fileName: `github-issue-${report.id}.md` });
  });

  // GET /api/generated-code: Inspect generated spec files on disk
  app.get('/api/generated-code', (req: Request, res: Response) => {
    try {
      const e2eDir = path.join(process.cwd(), 'tests', 'e2e');
      if (!fs.existsSync(e2eDir)) {
        return res.json({ files: [] });
      }

      const files = fs.readdirSync(e2eDir).map((f) => {
        const full = path.join(e2eDir, f);
        const stat = fs.statSync(full);
        return {
          fileName: f,
          relativePath: `tests/e2e/${f}`,
          sizeBytes: stat.size,
          updatedAt: stat.mtime.toISOString(),
          code: fs.readFileSync(full, 'utf-8'),
        };
      });

      res.json({ files });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Global or scoped Server-Sent Events (SSE) stream for terminal output in real time
  app.get('/api/terminal/stream', (req: Request, res: Response) => {
    const jobId = (req.query.jobId as string) || 'all';
    terminalStreamService.registerSSEClient(req, res, jobId);
  });

  // Dedicated per-job SSE stream for test execution logs
  app.get('/api/planner/stream/:jobId', (req: Request, res: Response) => {
    const { jobId } = req.params;
    terminalStreamService.registerSSEClient(req, res, jobId);
  });

  // Terminal streaming status & connected clients
  app.get('/api/terminal/status', (req: Request, res: Response) => {
    res.json(terminalStreamService.getStatus());
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Playwright Agent Studio] Server & WebSocket running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
