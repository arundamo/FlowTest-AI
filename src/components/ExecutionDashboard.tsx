import React, { useState, useEffect } from 'react';
import {
  TestExecutionReport,
  ExecutionStepResult,
  HealingRecord,
  GeneratedTestSpec,
  LLMConfig,
} from '../types';
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Download,
  Terminal,
  FileCode,
  Share2,
  Bug,
  Copy,
  Check,
  ChevronRight,
  Maximize2,
  RotateCcw,
  Zap,
  Sliders,
  ChevronDown,
  Layers,
  Eye,
  Video,
  Monitor,
  Globe,
  ArrowLeft,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { cleanStepTitle, getStepScreenshot } from '../utils/screenshotGenerator';

interface ExecutionDashboardProps {
  report?: TestExecutionReport;
  generatedSpec?: GeneratedTestSpec;
  jobId?: string;
  targetUrl: string;
  isRunning?: boolean;
  browserMode?: 'headless' | 'headed';
  onToggleBrowserMode?: (mode: 'headless' | 'headed') => void;
  onRunTest: (options?: { simulateFailure?: boolean; selfHealing?: boolean; headless?: boolean }) => Promise<void>;
  onViewSpec?: () => void;
  onViewLogs?: () => void;
}

export const ExecutionDashboard: React.FC<ExecutionDashboardProps> = ({
  report,
  generatedSpec,
  jobId,
  targetUrl,
  isRunning = false,
  browserMode = 'headed',
  onToggleBrowserMode,
  onRunTest,
  onViewSpec,
  onViewLogs,
}) => {
  // Browser View & Headed Execution State
  const [internalBrowserMode, setInternalBrowserMode] = useState<'headless' | 'headed'>(browserMode);
  const [activeStageTab, setActiveStageTab] = useState<'headed_browser' | 'video_scrubber'>('headed_browser');
  const [browserRenderMode, setBrowserRenderMode] = useState<'capture_frame' | 'interactive_web'>('capture_frame');
  const [iframeReloadKey, setIframeReloadKey] = useState<number>(0);

  // Video player state
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [selectedStep, setSelectedStep] = useState<ExecutionStepResult | null>(null);

  // Export modals
  const [showJiraModal, setShowJiraModal] = useState<boolean>(false);
  const [showGithubModal, setShowGithubModal] = useState<boolean>(false);
  const [jiraMarkdown, setJiraMarkdown] = useState<string>('');
  const [githubMarkdown, setGithubMarkdown] = useState<string>('');
  const [copiedJira, setCopiedJira] = useState<boolean>(false);
  const [copiedGithub, setCopiedGithub] = useState<boolean>(false);

  // Trace & DOM inspection
  const [showDomModal, setShowDomModal] = useState<boolean>(false);
  const [activeDomSnapshot, setActiveDomSnapshot] = useState<string>('');

  const steps = report?.steps || [];
  const healings = report?.healings || [];
  const totalFrames = steps.length;

  useEffect(() => {
    if (browserMode) {
      setInternalBrowserMode(browserMode);
    }
  }, [browserMode]);

  // Sync selected step with current frame index
  useEffect(() => {
    if (steps.length > 0 && steps[currentFrameIndex]) {
      setSelectedStep(steps[currentFrameIndex]);
    } else if (steps.length > 0) {
      setSelectedStep(steps[0]);
    }
  }, [currentFrameIndex, report]);

  // Video playback timer
  useEffect(() => {
    let interval: any;
    if (isPlaying && totalFrames > 1) {
      interval = setInterval(() => {
        setCurrentFrameIndex((prev) => {
          if (prev >= totalFrames - 1) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1400 / playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, totalFrames, playbackSpeed]);

  // Fetch Jira Export
  const handleOpenJira = async () => {
    if (!report) return;
    try {
      const res = await fetch(`/api/reports/${report.id}/export/jira`);
      const data = await res.json();
      setJiraMarkdown(data.markdown || '');
      setShowJiraModal(true);
    } catch (err) {
      console.error('Failed to generate Jira export:', err);
    }
  };

  // Fetch GitHub Export
  const handleOpenGithub = async () => {
    if (!report) return;
    try {
      const res = await fetch(`/api/reports/${report.id}/export/github`);
      const data = await res.json();
      setGithubMarkdown(data.markdown || '');
      setShowGithubModal(true);
    } catch (err) {
      console.error('Failed to generate GitHub export:', err);
    }
  };

  const copyToClipboard = async (text: string, type: 'jira' | 'github') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'jira') {
        setCopiedJira(true);
        setTimeout(() => setCopiedJira(false), 2000);
      } else {
        setCopiedGithub(true);
        setTimeout(() => setCopiedGithub(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const currentStep = selectedStep || steps[0];
  const isHealed = report?.status === 'healed';
  const isPassed = report?.status === 'passed';
  const isFailed = report?.status === 'failed';

  return (
    <div className="space-y-6">
      {/* Top Banner: Execution Status & Metrics */}
      <div
        className={`p-5 rounded-2xl border shadow-xl relative overflow-hidden transition-all ${
          isHealed
            ? 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/40 shadow-amber-500/10'
            : isPassed
            ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/30 shadow-emerald-500/10'
            : isFailed
            ? 'bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border-rose-500/30 shadow-rose-500/10'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                isHealed
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : isPassed
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : isFailed
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              }`}
            >
              {isRunning ? (
                <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              ) : isHealed ? (
                <Sparkles className="w-6 h-6 animate-pulse text-amber-400" />
              ) : isPassed ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              ) : isFailed ? (
                <XCircle className="w-6 h-6 text-rose-400" />
              ) : (
                <Play className="w-6 h-6 text-cyan-400" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  {isRunning
                    ? 'Playwright Test Execution in Progress...'
                    : isHealed
                    ? 'Self-Healed & Passed Successfully'
                    : isPassed
                    ? 'Test Suite Passed Successfully'
                    : isFailed
                    ? 'Test Execution Failed'
                    : 'Phase 3: Ready for Test Execution'}
                </h3>
                {report && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider ${
                      isHealed
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : isPassed
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {isHealed ? 'SELF-HEALED & PASS' : report.status}
                  </span>
                )}
                {report?.executionMode && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase font-bold flex items-center gap-1 ${
                      report.executionMode === 'headed'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {report.executionMode === 'headed' ? (
                      <>
                        <Monitor className="w-3 h-3 text-cyan-400" />
                        <span>Headed Browser</span>
                      </>
                    ) : (
                      <>
                        <Terminal className="w-3 h-3" />
                        <span>Headless</span>
                      </>
                    )}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                <span>Target: <span className="text-slate-300">{targetUrl}</span></span>
                <span>•</span>
                <span>
                  Duration: <strong className="text-slate-200">{report ? `${report.durationMs}ms` : '0ms'}</strong>
                </span>
                <span>•</span>
                <span>
                  Steps: <strong className="text-emerald-400">{report?.passedSteps || 0} passed</strong>
                  {healings.length > 0 && (
                    <strong className="text-amber-400 ml-1">({healings.length} auto-healed)</strong>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Execution Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Mode Switcher Pill */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => {
                  setInternalBrowserMode('headless');
                  onToggleBrowserMode?.('headless');
                }}
                className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  internalBrowserMode === 'headless'
                    ? 'bg-slate-800 text-slate-100 shadow-sm border border-slate-700 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Headless Mode: background execution without visible browser GUI"
              >
                <Terminal className="w-3 h-3" />
                <span>Headless</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInternalBrowserMode('headed');
                  onToggleBrowserMode?.('headed');
                  setActiveStageTab('headed_browser');
                }}
                className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  internalBrowserMode === 'headed'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Headed Mode: View live interactive browser window during test execution"
              >
                <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                <span>View Browser (Headed)</span>
              </button>
            </div>

            {/* Standalone Window Popup Button */}
            {targetUrl && (
              <button
                type="button"
                onClick={() =>
                  window.open(
                    targetUrl,
                    'PlaywrightHeadedBrowser',
                    'width=1280,height=720,menubar=no,toolbar=no,location=yes,status=no'
                  )
                }
                className="px-2.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
                title="Open live target web application in dedicated 1280x720 window"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Launch Browser</span>
              </button>
            )}

            {report && (
              <a
                href={`/api/reports/${report.id}/html`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                title="View full standalone Playwright HTML Report"
              >
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>HTML Report</span>
              </a>
            )}

            <button
              type="button"
              onClick={() => onRunTest({ selfHealing: true, headless: internalBrowserMode === 'headless' })}
              disabled={isRunning}
              className={`px-4 py-2 rounded-xl disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md ${
                internalBrowserMode === 'headed'
                  ? 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/25'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
              }`}
            >
              {isRunning ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Executing ({internalBrowserMode === 'headed' ? 'Headed' : 'Headless'})...</span>
                </>
              ) : internalBrowserMode === 'headed' ? (
                <>
                  <Monitor className="w-3.5 h-3.5 text-cyan-100" />
                  <span>Run Headed (View Browser)</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Headless Test</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onRunTest({ simulateFailure: true, selfHealing: true, headless: internalBrowserMode === 'headless' })}
              disabled={isRunning}
              className="px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Simulates an outdated locator failure to demonstrate autonomous self-healing in real time"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulate Outdated Selector</span>
            </button>
          </div>
        </div>
      </div>

      {/* Autonomous Healer Callout Card (Shows exact repairs made) */}
      {healings.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 shadow-lg shadow-amber-950/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              <h4 className="text-xs font-bold text-amber-200 uppercase tracking-wider font-mono">
                Autonomous Self-Healing Diagnostics ({healings.length} repair completed)
              </h4>
            </div>
            <span className="text-[11px] font-mono text-amber-400/90 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
              Zero Human Intervention Required
            </span>
          </div>

          <div className="space-y-3">
            {healings.map((h, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 text-xs font-mono space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-amber-400 font-semibold">
                    Step {h.stepNumber} Fault: {h.errorType}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Confidence:</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                      {Math.round(h.confidence * 100)}%
                    </span>
                  </div>
                </div>

                {/* Diff View */}
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1 text-[11px]">
                  <div className="flex items-center gap-2 text-rose-400/90">
                    <span className="select-none font-bold text-rose-500">-</span>
                    <span className="line-through">{h.brokenLocator}</span>
                    <span className="text-[10px] text-rose-500/80">(Broken / Outdated Selector)</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <span className="select-none font-bold text-emerald-500">+</span>
                    <span className="font-semibold">{h.healedLocator}</span>
                    <span className="text-[10px] text-emerald-500/80">(Repaired Semantic ARIA Role)</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-300 font-sans leading-relaxed">
                  <strong className="text-amber-300 font-mono">Agent Reasoning: </strong>
                  {h.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Interactive Video Player Stage (Left 7 cols) & Step Feed (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Browser Viewport Stage / Video Scrubber */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
            {/* Stage View Mode Tabs */}
            <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-slate-950/80 border-b border-slate-800 text-xs gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveStageTab('headed_browser')}
                  className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                    activeStageTab === 'headed_browser'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Live Test Browser (Headed)</span>
                  {internalBrowserMode === 'headed' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStageTab('video_scrubber')}
                  className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                    activeStageTab === 'video_scrubber'
                      ? 'bg-slate-800 text-slate-100 border border-slate-700 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Video className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Step Timeline & Scrubber</span>
                  {steps.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 rounded font-mono text-slate-400">
                      {steps.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (currentStep?.domSnapshot) {
                      setActiveDomSnapshot(currentStep.domSnapshot);
                    }
                    setShowDomModal(true);
                  }}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Inspect DOM</span>
                </button>
              </div>

              {/* In Headed Browser tab: Switch between Live Interactive Page vs Synchronized Step Capture */}
              {activeStageTab === 'headed_browser' && (
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-0.5 font-mono text-[11px]">
                  <button
                    type="button"
                    onClick={() => setBrowserRenderMode('capture_frame')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      browserRenderMode === 'capture_frame'
                        ? 'bg-slate-800 text-cyan-300 font-bold border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="High-resolution verified step render with cursor, selection rings & DOM action banners"
                  >
                    Verified Capture
                  </button>
                  <button
                    type="button"
                    onClick={() => setBrowserRenderMode('interactive_web')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      browserRenderMode === 'interactive_web'
                        ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Live interactive web session of the target URL inside the test container"
                  >
                    Live Web View
                  </button>
                </div>
              )}
            </div>

            {/* Browser Chrome Header */}
            <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {/* Traffic lights */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>

                {/* Navigation controls */}
                <div className="flex items-center gap-1 shrink-0 ml-1">
                  <button
                    type="button"
                    onClick={() => setCurrentFrameIndex((p) => Math.max(0, p - 1))}
                    disabled={currentFrameIndex === 0}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 transition-colors"
                    title="Previous step action"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentFrameIndex((p) => Math.min(totalFrames - 1, p + 1))}
                    disabled={currentFrameIndex >= totalFrames - 1}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 transition-colors"
                    title="Next step action"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIframeReloadKey((k) => k + 1)}
                    className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    title="Reload browser viewport"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* URL Address Bar */}
                <div className="px-3 py-1 rounded-md bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center gap-2 flex-1 min-w-[200px] max-w-lg">
                  <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">{targetUrl}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-slate-400 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      targetUrl,
                      'PlaywrightHeadedBrowser',
                      'width=1280,height=720,menubar=no,toolbar=no,location=yes,status=no'
                    )
                  }
                  className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                  title="Pop-out into standalone 1280x720 browser window"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span className="hidden sm:inline">Pop-out Window</span>
                </button>

                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                  <span className={`w-2 h-2 rounded-full ${internalBrowserMode === 'headed' ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`} />
                  <span>{internalBrowserMode === 'headed' ? 'Headed' : 'Headless'}</span>
                  <span className="text-slate-600">|</span>
                  <span>1280x720</span>
                </div>
              </div>
            </div>

            {/* Viewport Frame / Screen */}
            <div className="relative aspect-[16/9] bg-slate-950 flex items-center justify-center overflow-hidden group">
              {activeStageTab === 'headed_browser' && browserRenderMode === 'interactive_web' ? (
                <div className="w-full h-full relative">
                  <iframe
                    key={iframeReloadKey}
                    src={targetUrl}
                    title="Headed Test Browser Viewport"
                    className="w-full h-full border-0 bg-white"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  />

                  {/* Floating Headed Automation HUD */}
                  {currentStep && (
                    <div className="absolute top-3 left-3 right-3 p-3 rounded-xl bg-slate-950/90 backdrop-blur-md border border-cyan-500/40 text-xs flex items-center justify-between gap-3 shadow-xl">
                      <div className="flex items-center gap-2 truncate">
                        <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono text-[10px] font-bold uppercase shrink-0">
                          Headed Action
                        </span>
                        <span className="text-slate-200 font-semibold truncate">
                          Step {currentStep.stepNumber}: {cleanStepTitle(currentStep.title)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                        <span className="text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {currentStep.locator}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              targetUrl,
                              'PlaywrightTarget',
                              'width=1280,height=720,menubar=no,toolbar=no'
                            )
                          }
                          className="px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-sans text-[11px] flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Dedicated Window</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : currentStep ? (
                <img
                  src={getStepScreenshot(currentStep, targetUrl)}
                  alt={cleanStepTitle(currentStep.title)}
                  className="w-full h-full object-cover transition-transform duration-300"
                />
              ) : (
                <div className="text-center p-8 text-slate-500 font-mono text-xs">
                  <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <span>Execute test in Headed or Headless mode to capture browser viewport states</span>
                </div>
              )}

              {/* Action Overlay Label on Video (for capture mode) */}
              {(browserRenderMode === 'capture_frame' || activeStageTab === 'video_scrubber') && currentStep && (
                <div className="absolute bottom-3 left-3 right-3 p-2.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 text-xs flex items-center justify-between gap-3">
                  <div className="truncate flex items-center gap-2">
                    <span className="text-cyan-400 font-mono font-bold">
                      Step {currentStep.stepNumber}:
                    </span>
                    <span className="text-slate-200 font-medium truncate">{cleanStepTitle(currentStep.title)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                      {currentStep.locator}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        currentStep.status === 'healed'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : currentStep.status === 'passed'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {currentStep.status}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Video Playback & Scrubber Controls */}
            <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex flex-col gap-2">
              {/* Scrubber Slider */}
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={Math.max(totalFrames - 1, 0)}
                  value={currentFrameIndex}
                  onChange={(e) => {
                    setCurrentFrameIndex(parseInt(e.target.value, 10));
                    setIsPlaying(false);
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    disabled={totalFrames <= 1}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    {isPlaying ? <span className="font-mono text-xs font-bold px-1">❚❚</span> : <Play className="w-3.5 h-3.5 fill-current" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentFrameIndex((p) => Math.max(0, p - 1));
                      setIsPlaying(false);
                    }}
                    disabled={currentFrameIndex === 0}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors disabled:opacity-40"
                  >
                    ⏮
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentFrameIndex((p) => Math.min(totalFrames - 1, p + 1));
                      setIsPlaying(false);
                    }}
                    disabled={currentFrameIndex >= totalFrames - 1}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors disabled:opacity-40"
                  >
                    ⏭
                  </button>

                  <span className="font-mono text-[11px] text-slate-400 ml-1">
                    Frame {currentFrameIndex + 1} of {Math.max(totalFrames, 1)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">Speed:</span>
                  {[0.5, 1, 2].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPlaybackSpeed(s)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        playbackSpeed === s
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Current Step Detailed Inspector Card */}
          {currentStep && (
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-200 flex items-center gap-2">
                  <span className="text-cyan-400 font-mono">Step {currentStep.stepNumber} Inspection</span>
                  <span>•</span>
                  <span>{cleanStepTitle(currentStep.title)}</span>
                </h4>
                {currentStep.domSnapshot && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDomSnapshot(currentStep.domSnapshot || '');
                      setShowDomModal(true);
                    }}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    <span>View DOM Snapshot</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11px]">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-slate-500 block mb-1">Evaluated Locator:</span>
                  <span className="text-amber-300 break-all">{currentStep.locator}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-slate-500 block mb-1">Action / Assertion:</span>
                  <span className="text-emerald-300">{currentStep.action}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Step-by-Step Live Execution Feed & Export Tools */}
        <div className="lg:col-span-5 space-y-4">
          {/* Action Export Bar */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 ml-1">
              <Share2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export & Bug Reports</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenJira}
                disabled={!report}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700 disabled:opacity-40"
              >
                <Bug className="w-3.5 h-3.5 text-blue-400" />
                <span>Jira</span>
              </button>
              <button
                type="button"
                onClick={handleOpenGithub}
                disabled={!report}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700 disabled:opacity-40"
              >
                <FileCode className="w-3.5 h-3.5 text-purple-400" />
                <span>GitHub</span>
              </button>
              {onViewSpec && (
                <button
                  type="button"
                  onClick={onViewSpec}
                  className="px-2.5 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-xs font-semibold flex items-center gap-1 transition-colors border border-cyan-500/30"
                >
                  <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Spec</span>
                </button>
              )}
            </div>
          </div>

          {/* Live Step Execution Feed */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col min-h-[460px] max-h-[620px]">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
                  Execution Feed ({steps.length} Steps)
                </h4>
              </div>
              {onViewLogs && (
                <button
                  type="button"
                  onClick={onViewLogs}
                  className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <Terminal className="w-3 h-3" />
                  <span>Terminal Logs</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {steps.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center text-slate-500 p-6">
                  <Play className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-xs font-mono">Click "Run Headless Test" to trigger live execution stream.</p>
                </div>
              ) : (
                steps.map((step, idx) => {
                  const isSelected = currentFrameIndex === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setCurrentFrameIndex(idx);
                        setSelectedStep(step);
                        setIsPlaying(false);
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800 border-cyan-500/50 shadow-md'
                          : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 ${
                              step.status === 'healed'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : step.status === 'passed'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {step.status === 'healed' ? '⚠' : step.status === 'passed' ? '✔' : '✖'}
                          </span>
                          <span className="text-xs font-semibold text-slate-200 truncate">
                            {cleanStepTitle(step.title)}
                          </span>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold shrink-0 ${
                            step.status === 'healed'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : step.status === 'passed'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-rose-500/15 text-rose-300'
                          }`}
                        >
                          {step.status === 'healed' ? 'HEALED' : step.status}
                        </span>
                      </div>

                      <div className="mt-2 text-[11px] font-mono text-slate-400 truncate">
                        {step.locator}
                      </div>

                      {step.healingDetails && (
                        <div className="mt-2 p-2 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[10px] font-mono text-amber-300">
                          <strong>Repaired:</strong> {step.healingDetails.brokenLocator} → {step.healingDetails.healedLocator}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Jira Export Modal */}
      {showJiraModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Bug className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-100">Export Bug Report to Jira</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowJiraModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕ Close
              </button>
            </div>
            <div className="p-4">
              <textarea
                value={jiraMarkdown}
                readOnly
                rows={12}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 resize-none leading-relaxed"
              />
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <span className="text-xs text-slate-400">Includes reproduction steps, healed locator diffs, and logs.</span>
              <button
                type="button"
                onClick={() => copyToClipboard(jiraMarkdown, 'jira')}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                {copiedJira ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedJira ? 'Copied!' : 'Copy Jira Markdown'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GitHub Issue Export Modal */}
      {showGithubModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-slate-100">Export Bug Issue to GitHub</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGithubModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕ Close
              </button>
            </div>
            <div className="p-4">
              <textarea
                value={githubMarkdown}
                readOnly
                rows={12}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 resize-none leading-relaxed"
              />
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <span className="text-xs text-slate-400">Formatted in standard GitHub Markdown issue syntax.</span>
              <button
                type="button"
                onClick={() => copyToClipboard(githubMarkdown, 'github')}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                {copiedGithub ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedGithub ? 'Copied!' : 'Copy GitHub Issue'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOM Snapshot Modal */}
      {showDomModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-100">Captured DOM Snapshot</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDomModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕ Close
              </button>
            </div>
            <div className="p-4">
              <pre className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 max-h-[360px] overflow-auto leading-relaxed whitespace-pre-wrap">
                {activeDomSnapshot}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
