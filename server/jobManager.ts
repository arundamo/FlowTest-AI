import EventEmitter from 'events';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { LLMConfig, ParsedSpecPlan, PlannerJob, TestStep, TestExecutionReport } from './types';
import { runPlannerAgent } from './plannerAgent';
import { fetchAvailableModels } from './llmRouter';

class JobManager extends EventEmitter {
  private jobs: Map<string, PlannerJob> = new Map();

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  createJob(requirement: string, targetUrl: string, llmConfig: LLMConfig): PlannerJob {
    const id = crypto.randomUUID();
    const job: PlannerJob = {
      id,
      requirement,
      targetUrl,
      llmConfig,
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      logs: [],
    };

    this.jobs.set(id, job);
    this.emitJobUpdate(job);

    // Kick off execution asynchronously
    this.processJob(job).catch((err) => {
      console.error(`[JobManager] Error executing job ${id}:`, err);
    });

    return job;
  }

  getJob(id: string): PlannerJob | undefined {
    return this.jobs.get(id);
  }

  listJobs(): PlannerJob[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  addLog(jobId: string, message: string, level: 'info' | 'warn' | 'error' = 'info') {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const entry = {
      timestamp: new Date().toISOString(),
      message,
      level,
    };
    job.logs.push(entry);
    job.updatedAt = new Date().toISOString();

    this.emit(`log:${jobId}`, entry);
    this.emit('job_log', { jobId, log: entry });
  }

  updateJobApproval(
    jobId: string,
    steps: TestStep[],
    rawMarkdown?: string,
    notes?: string,
    title?: string
  ): PlannerJob {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (!job.plan) {
      throw new Error(`Cannot approve job without a generated plan`);
    }

    job.plan.steps = steps;
    if (rawMarkdown) {
      job.plan.rawMarkdown = rawMarkdown;
    }
    if (title) {
      job.plan.title = title;
    }
    job.status = 'approved';
    job.updatedAt = new Date().toISOString();

    // Persist updated spec file to sandbox if path exists
    if (job.plan.filePath) {
      try {
        const dir = path.dirname(job.plan.filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(job.plan.filePath, job.plan.rawMarkdown, 'utf-8');
        this.addLog(jobId, `Updated test plan markdown saved to sandbox: ${job.plan.fileName}`, 'info');
      } catch (err: any) {
        this.addLog(jobId, `Notice: Could not write spec to sandbox: ${err.message}`, 'warn');
      }
    }

    const approvedCount = steps.filter((s) => s.isApproved).length;
    const noteText = notes && notes.trim() ? ` Notes: "${notes.trim()}"` : '';
    this.addLog(
      jobId,
      `Plan approved by reviewer (${approvedCount}/${steps.length} steps approved). Ready for Playwright Generator agent.${noteText}`,
      'info'
    );
    this.emitJobUpdate(job);
    return job;
  }

  setGeneratedCode(jobId: string, spec: import('./types').GeneratedTestSpec): PlannerJob {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.generatedCode = spec;
    job.status = 'code_generated';
    job.updatedAt = new Date().toISOString();
    this.addLog(
      jobId,
      `[Phase 2: Code Generator] Spec ${spec.fileName} generated successfully (${spec.executionTimeMs}ms). Saved to ${spec.relativeFilePath}`,
      'info'
    );
    this.emitJobUpdate(job);
    return job;
  }

  updateGeneratedCode(jobId: string, newCode: string): PlannerJob {
    const job = this.jobs.get(jobId);
    if (!job || !job.generatedCode) {
      throw new Error(`Job ${jobId} or generated code not found`);
    }

    job.generatedCode.code = newCode;
    job.generatedCode.status = 'edited';
    job.generatedCode.updatedAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();

    // Write back to file on disk
    if (job.generatedCode.filePath) {
      try {
        fs.writeFileSync(job.generatedCode.filePath, newCode, 'utf-8');
        this.addLog(
          jobId,
          `[File System] Manual edits saved to: ${job.generatedCode.relativeFilePath}`,
          'info'
        );
      } catch (err: any) {
        this.addLog(
          jobId,
          `[File System] Warning: could not persist edits: ${err.message}`,
          'warn'
        );
      }
    }

    this.emitJobUpdate(job);
    return job;
  }

  recordTestExecution(
    jobId: string,
    result: {
      status: 'passed' | 'failed' | 'healed';
      durationMs: number;
      passedSteps: number;
      totalSteps: number;
      outputLogs: string[];
      error?: string;
      healedCount?: number;
      report?: TestExecutionReport;
    }
  ): PlannerJob {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (result.report) {
      job.executionReport = result.report;
      if (result.report.repairedSpecCode && job.generatedCode) {
        job.generatedCode.code = result.report.repairedSpecCode;
      }
    }

    if (job.generatedCode) {
      job.generatedCode.status = result.status === 'healed' ? 'healed' : result.status;
      job.generatedCode.testResult = {
        status: result.status,
        durationMs: result.durationMs,
        passedSteps: result.passedSteps,
        totalSteps: result.totalSteps,
        outputLogs: result.outputLogs,
        error: result.error,
        healedCount: result.healedCount,
        reportId: result.report?.id,
        timestamp: new Date().toISOString(),
      };
    }

    job.status =
      result.status === 'healed'
        ? 'test_healed'
        : result.status === 'passed'
        ? 'test_passed'
        : 'test_failed';
    job.updatedAt = new Date().toISOString();
    this.emitJobUpdate(job);
    return job;
  }

  setJobStatus(jobId: string, status: PlannerJob['status']) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = status;
    job.updatedAt = new Date().toISOString();
    this.emitJobUpdate(job);
  }

  private async processJob(job: PlannerJob) {
    job.status = 'running';
    job.updatedAt = new Date().toISOString();
    this.emitJobUpdate(job);

    this.addLog(job.id, `Starting Planner Agent execution for: "${job.requirement}"`, 'info');
    this.addLog(job.id, `Configured LLM endpoint: ${job.llmConfig.baseUrl} (Model: ${job.llmConfig.model})`, 'info');

    try {
      const plan = await runPlannerAgent(job.requirement, job.targetUrl, job.llmConfig, {
        onLog: (msg, level) => {
          this.addLog(job.id, msg, level);
        },
      });

      job.plan = plan;
      job.status = 'completed';
      job.updatedAt = new Date().toISOString();
      this.addLog(job.id, `Test plan generated successfully: ${plan.title} (${plan.fileName})`, 'info');
      this.emitJobUpdate(job);
    } catch (err: any) {
      job.status = 'failed';
      job.error = err.message || 'Unknown execution error occurred';
      job.updatedAt = new Date().toISOString();
      this.addLog(job.id, `Execution failed: ${job.error}`, 'error');
      this.emitJobUpdate(job);
    }
  }

  private emitJobUpdate(job: PlannerJob) {
    this.emit(`job:${job.id}`, job);
    this.emit('job:change', job);
    this.emit('job_status', { jobId: job.id, job });
  }
}

export const jobManager = new JobManager();


/**
 * Tests connectivity to an OpenAI-compatible LLM endpoint (Ollama, vLLM, OpenAI, etc.)
 */
export async function testLLMConnection(config: LLMConfig): Promise<{
  success: boolean;
  latencyMs: number;
  message: string;
  models?: string[];
  source?: string;
  isLocalhostCloudMismatch?: boolean;
}> {
  return fetchAvailableModels(config);
}

