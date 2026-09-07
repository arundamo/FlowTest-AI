/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { LLMConfig, PlannerJob, TestStep, GeneratedTestSpec, TestExecutionReport } from './types';
import { PromptForm } from './components/PromptForm';
import { TerminalLogs } from './components/TerminalLogs';
import { PlanReviewer } from './components/PlanReviewer';
import { CodePreviewEditor } from './components/CodePreviewEditor';
import { ExecutionDashboard } from './components/ExecutionDashboard';
import { LLMConfigModal } from './components/LLMConfigModal';
import { SetupInstructionsModal } from './components/SetupInstructionsModal';
import { ArchitectureOverview } from './components/ArchitectureOverview';
import {
  Layers,
  Settings,
  BookOpen,
  History,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  Code2,
  FileText,
  Play,
  Wrench,
  Activity,
  Zap,
} from 'lucide-react';

export default function App() {
  // Default to Ollama on-premise endpoint or Gemini if user chooses
  const [llmConfig, setLlmConfig] = useState<LLMConfig>({
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.3',
    provider: 'ollama',
    temperature: 0.2,
  });

  const [activeJob, setActiveJob] = useState<PlannerJob | null>(null);
  const [jobsHistory, setJobsHistory] = useState<PlannerJob[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<'plan' | 'code' | 'execution'>('plan');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [streamingProtocol, setStreamingProtocol] = useState<'websocket' | 'sse' | 'idle'>('idle');

  // Load past jobs on mount
  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/planner/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobsHistory(data);
        // If there are existing jobs and none selected, select the first
        if (!activeJob && data.length > 0) {
          setActiveJob(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load past jobs:', err);
    }
  };

  // Submit test requirement to create async planning job
  const handleRunPlanner = async (requirement: string, targetUrl: string) => {
    setIsRunning(true);
    try {
      const res = await fetch('/api/planner/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirement,
          targetUrl,
          llmConfig,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to start planning task');
      }

      const job: PlannerJob = await res.json();
      setActiveJob(job);
      setJobsHistory((prev) => [job, ...prev]);

      // Connect to Server-Sent Events stream for live terminal logs
      subscribeToJobStream(job.id);
    } catch (err: any) {
      console.error('Planner launch error:', err);
      setIsRunning(false);
      if (activeJob) {
        setActiveJob({
          ...activeJob,
          status: 'failed',
          error: err.message,
          logs: [
            ...activeJob.logs,
            {
              timestamp: new Date().toISOString(),
              message: `Error initiating planner: ${err.message}`,
              level: 'error',
            },
          ],
        });
      }
    }
  };

  // Dual-protocol real-time streaming subscriber: WebSocket first with seamless SSE fallback
  const subscribeToJobStream = (jobId: string) => {
    const isHttps = window.location.protocol === 'https:';
    const wsProtocol = isHttps ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/terminal?jobId=${jobId}`;

    let socket: WebSocket | null = null;
    let sseSource: EventSource | null = null;
    let wsConnected = false;

    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        wsConnected = true;
        setStreamingProtocol('websocket');
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'log' && data.log) {
            setActiveJob((prev) => {
              if (!prev || prev.id !== jobId) return prev;
              return {
                ...prev,
                logs: [...prev.logs, data.log],
              };
            });
          } else if (data.type === 'status') {
            setActiveJob((prev) => {
              if (!prev || prev.id !== jobId) return prev;
              return {
                ...prev,
                status: data.status,
                plan: data.plan || prev.plan,
                error: data.error || prev.error,
              };
            });
            if (data.status === 'completed' || data.status === 'failed' || data.status === 'approved') {
              setIsRunning(false);
              setStreamingProtocol('idle');
              fetchJobs();
            }
          } else if (data.type === 'history' && data.logs) {
            setActiveJob((prev) => {
              if (!prev || prev.id !== jobId) return prev;
              return {
                ...prev,
                logs: data.logs,
                status: data.status || prev.status,
                plan: data.plan || prev.plan,
              };
            });
          }
        } catch (err) {
          console.error('WS message parse error', err);
        }
      };

      socket.onerror = () => {
        if (!wsConnected) {
          fallbackToSSE();
        }
      };

      socket.onclose = () => {
        if (isRunning && !wsConnected) {
          fallbackToSSE();
        } else {
          setStreamingProtocol('idle');
        }
      };
    } catch {
      fallbackToSSE();
    }

    function fallbackToSSE() {
      if (socket) {
        try {
          socket.close();
        } catch {}
        socket = null;
      }
      setStreamingProtocol('sse');
      sseSource = new EventSource(`/api/planner/stream/${jobId}`);

      sseSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'init' && data.job) {
            setActiveJob(data.job);
          } else if (data.type === 'log' && data.entry) {
            setActiveJob((prev) => {
              if (!prev || prev.id !== jobId) return prev;
              return {
                ...prev,
                logs: [...prev.logs, data.entry],
              };
            });
          } else if (data.type === 'status' && data.job) {
            setActiveJob(data.job);
            setJobsHistory((prev) => prev.map((j) => (j.id === jobId ? data.job : j)));
          } else if (data.type === 'done') {
            setIsRunning(false);
            setStreamingProtocol('idle');
            sseSource?.close();
            fetchJobs();
          }
        } catch (err) {
          console.error('Failed to parse SSE payload:', err);
        }
      };

      sseSource.onerror = () => {
        setIsRunning(false);
        setStreamingProtocol('idle');
        sseSource?.close();
      };
    }
  };

  // Human-in-the-Loop plan approval handler
  const handleApprovePlan = async (
    steps: TestStep[],
    rawMarkdown?: string,
    notes?: string,
    title?: string
  ) => {
    if (!activeJob) return;
    setIsApproving(true);
    try {
      const res = await fetch(`/api/planner/jobs/${activeJob.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps, rawMarkdown, notes, title }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Approval failed');
      }

      const updatedJob = await res.json();
      setActiveJob(updatedJob);
      setJobsHistory((prev) => prev.map((j) => (j.id === updatedJob.id ? updatedJob : j)));

      // Seamlessly trigger Phase 2 Code Generator Agent upon plan approval
      await handleGenerateCode(steps, rawMarkdown, notes, title, activeJob.id);
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setIsApproving(false);
    }
  };

  // Phase 2: Trigger Playwright Code Generator Agent
  const handleGenerateCode = async (
    steps: TestStep[],
    rawMarkdown?: string,
    notes?: string,
    title?: string,
    jobId?: string
  ) => {
    const targetJobId = jobId || activeJob?.id;
    const targetUrl = activeJob?.targetUrl || 'https://example.com';
    setIsGeneratingCode(true);
    setActiveViewTab('code');

    try {
      if (targetJobId) {
        subscribeToJobStream(targetJobId);
      }

      const res = await fetch('/api/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: targetJobId,
          title: title || activeJob?.plan?.title || 'Automated End-to-End Test',
          targetUrl,
          steps,
          rawMarkdown,
          notes,
          llmConfig,
          outputPath: 'tests/e2e/test-1.spec.ts',
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Code generation failed');
      }

      const data = await res.json();
      const spec: GeneratedTestSpec = data.spec;

      setActiveJob((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'code_generated',
          generatedCode: spec,
        };
      });

      setJobsHistory((prev) =>
        prev.map((j) =>
          j.id === targetJobId
            ? { ...j, status: 'code_generated', generatedCode: spec }
            : j
        )
      );
    } catch (err: any) {
      console.error('Code generation error:', err);
      if (activeJob) {
        setActiveJob((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            logs: [
              ...prev.logs,
              {
                timestamp: new Date().toISOString(),
                message: `[Phase 2 Error] Failed to generate Playwright code: ${err.message}`,
                level: 'error',
              },
            ],
          };
        });
      }
    } finally {
      setIsGeneratingCode(false);
    }
  };

  // Phase 3 Runtime: Trigger headless Playwright test execution with Self-Healing Loop
  const handleRunHeadlessTest = async (options?: { simulateFailure?: boolean; selfHealing?: boolean }) => {
    if (!activeJob) return;
    setIsRunningTest(true);
    setActiveViewTab('execution');

    try {
      subscribeToJobStream(activeJob.id);

      const res = await fetch('/api/run-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: activeJob.id,
          targetUrl: activeJob.targetUrl,
          selfHealingEnabled: options?.selfHealing !== false,
          simulateFailureScenario: options?.simulateFailure === true,
          specFilePath: activeJob.generatedCode?.filePath,
          specCode: activeJob.generatedCode?.code,
          llmConfig,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Test execution failed');
      }

      const data = await res.json();
      const report: TestExecutionReport = data.report;
      const finalStatus =
        report.status === 'healed'
          ? 'test_healed'
          : report.status === 'passed'
          ? 'test_passed'
          : 'test_failed';

      setActiveJob((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: finalStatus,
          executionReport: report,
          generatedCode: prev.generatedCode
            ? {
                ...prev.generatedCode,
                code: report.repairedSpecCode || prev.generatedCode.code,
                status: report.status === 'healed' ? 'healed' : report.status,
                testResult: {
                  status: report.status,
                  durationMs: report.durationMs,
                  passedSteps: report.passedSteps,
                  totalSteps: report.totalSteps,
                  outputLogs: report.outputLogs,
                  healedCount: report.healedSteps,
                  reportId: report.id,
                  timestamp: new Date().toISOString(),
                },
              }
            : undefined,
        };
      });

      setJobsHistory((prev) =>
        prev.map((j) =>
          j.id === activeJob.id
            ? {
                ...j,
                status: finalStatus,
                executionReport: report,
                generatedCode: j.generatedCode
                  ? {
                      ...j.generatedCode,
                      code: report.repairedSpecCode || j.generatedCode.code,
                      status: report.status === 'healed' ? 'healed' : report.status,
                      testResult: {
                        status: report.status,
                        durationMs: report.durationMs,
                        passedSteps: report.passedSteps,
                        totalSteps: report.totalSteps,
                        outputLogs: report.outputLogs,
                        healedCount: report.healedSteps,
                        reportId: report.id,
                        timestamp: new Date().toISOString(),
                      },
                    }
                  : undefined,
              }
            : j
        )
      );
    } catch (err: any) {
      console.error('Test run error:', err);
      setActiveJob((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'test_failed',
          logs: [
            ...prev.logs,
            {
              timestamp: new Date().toISOString(),
              message: `[Phase 3 Execution Error] ${err.message}`,
              level: 'error',
            },
          ],
        };
      });
    } finally {
      setIsRunningTest(false);
    }
  };

  // Phase 2: Save manual edits to generated code
  const handleSaveCodeEdit = async (newCode: string) => {
    if (!activeJob || !activeJob.generatedCode) return;

    const res = await fetch('/api/generate-code/save', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: activeJob.id,
        code: newCode,
        filePath: activeJob.generatedCode.relativeFilePath,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save code');
    }

    setActiveJob((prev) => {
      if (!prev || !prev.generatedCode) return prev;
      return {
        ...prev,
        generatedCode: {
          ...prev.generatedCode,
          code: newCode,
          status: 'edited',
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base text-slate-100">Playwright Agent Studio</h1>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  Phase 2 Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                AI-driven browser test automation with on-premise LLM routing, code synthesis & live execution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                showHistory
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
              }`}
              title="Test Spec History"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History ({jobsHistory.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSetupOpen(true)}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Setup & Docs"
            >
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Setup Guide</span>
            </button>

            <button
              type="button"
              onClick={() => setIsConfigOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600/10 border border-indigo-500/30 hover:bg-indigo-600/20 text-indigo-300 text-xs font-medium flex items-center gap-2 transition-colors"
            >
              <Settings className="w-4 h-4 text-indigo-400" />
              <div className="text-left hidden sm:block">
                <span className="block text-[10px] text-indigo-300/70 font-mono">LLM Router</span>
                <span className="block font-semibold text-xs text-indigo-200 truncate max-w-[120px]">
                  {llmConfig.model}
                </span>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Architecture Overview */}
        <ArchitectureOverview />

        {/* History Drawer / Panel if toggled */}
        {showHistory && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-400" />
                Generated Test Plans History
              </h3>
              <button
                type="button"
                onClick={fetchJobs}
                className="p-1 rounded text-slate-400 hover:text-slate-200"
                title="Refresh history"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            {jobsHistory.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">No past test plans generated yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {jobsHistory.map((job) => {
                  const isSelected = activeJob?.id === job.id;
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => setActiveJob(job)}
                      className={`p-3 rounded-xl border text-left text-xs transition-all ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                          : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[10px] text-slate-500">
                          {new Date(job.createdAt).toLocaleTimeString()}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-semibold ${
                            job.status === 'completed' || job.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : job.status === 'failed'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-indigo-500/20 text-indigo-400 animate-pulse'
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>
                      <p className="font-medium text-slate-200 line-clamp-1">{job.requirement}</p>
                      {job.plan && (
                        <p className="text-[11px] text-indigo-400/80 mt-1 truncate">
                          {job.plan.title} ({job.plan.steps.length} steps)
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Global Lifecycle Phase Switcher Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-2.5 rounded-2xl shadow-xl">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveViewTab('plan')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                activeViewTab === 'plan'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-4 h-4 text-indigo-300" />
              <span>1. Test Plan (specs/*.md)</span>
              {activeJob?.plan && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-indigo-200">
                  {activeJob.plan.steps.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveViewTab('code')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                activeViewTab === 'code'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Code2 className="w-4 h-4 text-cyan-300" />
              <span>2. Playwright Spec (.spec.ts)</span>
              {activeJob?.generatedCode && (
                <span className="w-2 h-2 rounded-full bg-cyan-300" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveViewTab('execution')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                activeViewTab === 'execution'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Wrench className="w-4 h-4 text-amber-300" />
              <span>3. Live Runner & Healer Agent</span>
              {isRunningTest ? (
                <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : activeJob?.status === 'test_healed' || activeJob?.executionReport?.status === 'healed' ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  HEALED
                </span>
              ) : activeJob?.status === 'test_passed' || activeJob?.executionReport?.status === 'passed' ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  PASS
                </span>
              ) : activeJob?.status === 'test_failed' ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  FAIL
                </span>
              ) : null}
            </button>
          </div>

          {/* Quick Header Execution Controls */}
          {activeJob && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleRunHeadlessTest({ simulateFailure: true, selfHealing: true })}
                disabled={isRunningTest}
                className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Simulate an outdated selector to trigger autonomous Healer Agent repair in real-time"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Test Self-Healing</span>
              </button>

              <button
                type="button"
                onClick={() => handleRunHeadlessTest({ selfHealing: true })}
                disabled={isRunningTest}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shadow-emerald-600/20"
              >
                {isRunningTest ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Executing...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>Run Headless</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Workspace: Execution Dashboard (Full Width) vs Dual-Column Workspace */}
        {activeViewTab === 'execution' ? (
          <div className="space-y-6">
            <ExecutionDashboard
              report={activeJob?.executionReport}
              generatedSpec={activeJob?.generatedCode}
              jobId={activeJob?.id}
              targetUrl={activeJob?.targetUrl || 'https://example.com'}
              isRunning={isRunningTest}
              onRunTest={handleRunHeadlessTest}
              onViewSpec={() => setActiveViewTab('code')}
              onViewLogs={() => {
                setActiveViewTab('plan');
                window.scrollTo({ top: 350, behavior: 'smooth' });
              }}
            />

            {/* Collapsible Live Subprocess Logs while in Execution Mode */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Terminal Logs (Streaming Execution & Autonomous Healer Traces)
                </span>
                {activeJob && (
                  <span className="text-[11px] font-mono text-slate-500">Job: {activeJob.id.slice(0, 8)}</span>
                )}
              </div>
              <TerminalLogs
                logs={activeJob?.logs || []}
                isRunning={isRunningTest || isRunning}
                streamingProtocol={streamingProtocol}
                onClear={() => {
                  if (activeJob) {
                    setActiveJob({ ...activeJob, logs: [] });
                  }
                }}
              />
            </div>
          </div>
        ) : (
          /* Form and Terminal Grid (Plan & Code Tabs) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Form & Requirement (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <PromptForm
                onSubmit={handleRunPlanner}
                isRunning={isRunning}
                llmConfig={llmConfig}
                onOpenConfig={() => setIsConfigOpen(true)}
              />

              {/* Terminal Live Logs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Live Agent Subprocess Logs
                  </span>
                  {activeJob && (
                    <span className="text-[11px] font-mono text-slate-500">Job ID: {activeJob.id.slice(0, 8)}</span>
                  )}
                </div>
                <TerminalLogs
                  logs={activeJob?.logs || []}
                  isRunning={isRunning}
                  streamingProtocol={streamingProtocol}
                  onClear={() => {
                    if (activeJob) {
                      setActiveJob({ ...activeJob, logs: [] });
                    }
                  }}
                />
              </div>
            </div>

            {/* Right Column: Spec Plan Reviewer / Generated Code Preview (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              {activeJob?.plan ? (
                <div className="space-y-4">
                  {/* View Switcher Tabs inside right column */}
                  <div className="flex flex-wrap items-center justify-between bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl gap-2 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveViewTab('plan')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                          activeViewTab === 'plan'
                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Test Plan</span>
                        <span className="text-[10px] opacity-75 font-mono">
                          ({activeJob.plan.steps.length})
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveViewTab('code')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                          activeViewTab === 'code'
                            ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/25'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                      >
                        <Code2 className="w-3.5 h-3.5" />
                        <span>Generated Spec (.spec.ts)</span>
                        {activeJob.generatedCode ? (
                          <span className="w-2 h-2 rounded-full bg-cyan-300" />
                        ) : isGeneratingCode ? (
                          <div className="w-2.5 h-2.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        ) : null}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveViewTab('execution')}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Open Phase 3 Execution Dashboard & Video Scrubber"
                    >
                      <Wrench className="w-3 h-3 text-amber-400" />
                      <span>Healer View</span>
                    </button>
                  </div>

                  {/* View Content */}
                  {activeViewTab === 'code' && activeJob.generatedCode ? (
                    <CodePreviewEditor
                      spec={activeJob.generatedCode}
                      jobId={activeJob.id}
                      targetUrl={activeJob.targetUrl}
                      isGenerating={isGeneratingCode}
                      isRunningTest={isRunningTest}
                      onRunTest={handleRunHeadlessTest}
                      onSaveCode={handleSaveCodeEdit}
                      onRegenerate={() =>
                        handleGenerateCode(
                          activeJob.plan?.steps || [],
                          activeJob.plan?.rawMarkdown,
                          '',
                          activeJob.plan?.title,
                          activeJob.id
                        )
                      }
                      onViewTerminalLogs={() => {
                        window.scrollTo({ top: 350, behavior: 'smooth' });
                      }}
                    />
                  ) : (
                    <PlanReviewer
                      plan={activeJob.plan}
                      jobStatus={activeJob.status}
                      onApprove={handleApprovePlan}
                      isApproving={isApproving}
                      onGenerateCode={(steps, rawMarkdown, notes, title) =>
                        handleGenerateCode(steps, rawMarkdown, notes, title, activeJob.id)
                      }
                      isGeneratingCode={isGeneratingCode}
                      hasGeneratedCode={Boolean(activeJob.generatedCode)}
                      onViewGeneratedCode={() => setActiveViewTab('code')}
                    />
                  )}
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-3 min-h-[420px]">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-200">No Test Plan Active</h3>
                  <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                    Enter a test requirement on the left and click <strong>Generate Test Plan</strong>. The Planner agent will isolate a sandbox, execute against your configured LLM endpoint, and render an editable checklist here.
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-[11px] text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Execution creates specs/*.md inside temporary sandbox</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Playwright Test Agents SaaS Platform • Phase 3 Self-Healing Execution Engine, Trace Viewer & Extended Reporting</span>
          <span className="font-mono text-[11px] text-slate-600">OpenAI-Compatible, AST Patching & Playwright MCP Ready</span>
        </div>
      </footer>

      {/* Modals */}
      <LLMConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        config={llmConfig}
        onSave={(newCfg) => setLlmConfig(newCfg)}
      />

      <SetupInstructionsModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
      />
    </div>
  );
}
