import React, { useState } from 'react';
import { GeneratedTestSpec } from '../types';
import {
  Code2,
  Play,
  Edit3,
  Save,
  RotateCcw,
  Copy,
  Check,
  Download,
  FileCode,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Terminal,
  ExternalLink,
  Layers,
  Cpu,
} from 'lucide-react';

interface CodePreviewEditorProps {
  spec: GeneratedTestSpec;
  jobId?: string;
  targetUrl: string;
  isGenerating?: boolean;
  isRunningTest?: boolean;
  onRunTest: () => void;
  onSaveCode: (newCode: string) => Promise<void>;
  onRegenerate: () => void;
  onViewTerminalLogs?: () => void;
}

export const CodePreviewEditor: React.FC<CodePreviewEditorProps> = ({
  spec,
  jobId,
  targetUrl,
  isGenerating = false,
  isRunningTest = false,
  onRunTest,
  onSaveCode,
  onRegenerate,
  onViewTerminalLogs,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(spec.code);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync edited code when spec changes (e.g. regenerated)
  React.useEffect(() => {
    setEditedCode(spec.code);
    setIsEditing(false);
  }, [spec.code, spec.id]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(isEditing ? editedCode : spec.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([isEditing ? editedCode : spec.code], { type: 'text/typescript' });
    element.href = URL.createObjectURL(file);
    element.download = spec.fileName || 'test-1.spec.ts';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveCode(editedCode);
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedCode(spec.code);
    setIsEditing(false);
  };

  // Split code into numbered lines
  const displayCode = isEditing ? editedCode : spec.code;
  const lines = displayCode.split('\n');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
      {/* Header Bar */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <FileCode className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-200">
                {spec.relativeFilePath || spec.fileName}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                  spec.status === 'healed'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                    : spec.status === 'passed'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : spec.status === 'failed'
                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    : spec.status === 'edited'
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                    : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                }`}
              >
                {spec.status === 'healed'
                  ? 'HEALED & PASS'
                  : spec.status === 'passed'
                  ? 'PASS'
                  : spec.status === 'failed'
                  ? 'FAIL'
                  : spec.status === 'edited'
                  ? 'MANUAL EDITS'
                  : 'SYNTHESIZED'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span>{lines.length} lines</span>
              <span>•</span>
              <span className="font-mono text-slate-500">Model: {spec.modelUsed}</span>
              <span>•</span>
              <span>{spec.executionTimeMs}ms synthesis</span>
            </div>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700/60"
                title="Edit generated code manually"
              >
                <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Edit Code</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs transition-colors border border-slate-700/60"
                title="Copy to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs transition-colors border border-slate-700/60"
                title="Download .spec.ts"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              {/* Run Headless Test Trigger */}
              <button
                type="button"
                onClick={onRunTest}
                disabled={isRunningTest || isGenerating}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
                title="Trigger Phase 3: Run headless Chromium test execution"
              >
                {isRunningTest ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Running Test...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Headless Test</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Test Execution Status Banner (if run) */}
      {spec.testResult && (
        <div
          className={`px-4 py-2.5 border-b text-xs flex items-center justify-between gap-3 ${
            spec.testResult.status === 'passed'
              ? 'bg-emerald-950/30 border-emerald-500/20 text-emerald-300'
              : 'bg-rose-950/30 border-rose-500/20 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {spec.testResult.status === 'passed' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <div>
              <span className="font-semibold">
                Test Execution {spec.testResult.status.toUpperCase()}:
              </span>{' '}
              {spec.testResult.passedSteps} of {spec.testResult.totalSteps} steps verified in{' '}
              {spec.testResult.durationMs}ms against <span className="font-mono">{targetUrl}</span>
            </div>
          </div>
          {onViewTerminalLogs && (
            <button
              type="button"
              onClick={onViewTerminalLogs}
              className="text-[11px] underline flex items-center gap-1 hover:text-white"
            >
              <Terminal className="w-3 h-3" />
              <span>View Terminal Logs</span>
            </button>
          )}
        </div>
      )}

      {/* Editor & Code Area */}
      <div className="relative flex-1 min-h-[420px] max-h-[620px] flex flex-col bg-slate-950">
        {isEditing ? (
          <div className="flex-1 flex flex-col p-2">
            <div className="text-[11px] text-indigo-400 font-mono mb-1 px-2 flex items-center justify-between">
              <span>TypeScript Editor Mode (Manual Adjustments)</span>
              <span>Changes will be saved to disk at {spec.relativeFilePath}</span>
            </div>
            <textarea
              value={editedCode}
              onChange={(e) => setEditedCode(e.target.value)}
              spellCheck={false}
              className="w-full flex-1 p-3 bg-slate-900 border border-indigo-500/40 rounded-xl font-mono text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none leading-relaxed"
              rows={22}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-auto flex font-mono text-xs text-slate-200">
            {/* Line Numbers Gutter */}
            <div className="py-4 px-3 select-none text-right text-slate-600 bg-slate-950/90 border-r border-slate-800/80 shrink-0 font-mono text-xs leading-relaxed min-w-[48px]">
              {lines.map((_, i) => (
                <div key={i} className="leading-relaxed">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Code Body with syntax styling */}
            <div className="p-4 overflow-x-auto flex-1 leading-relaxed bg-slate-950">
              <pre className="m-0 font-mono text-xs leading-relaxed text-slate-300">
                {lines.map((line, idx) => {
                  return (
                    <div key={idx} className="leading-relaxed whitespace-pre hover:bg-slate-900/60 px-1 rounded">
                      {renderSyntaxLine(line)}
                    </div>
                  );
                })}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2.5 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-cyan-400">
            <Cpu className="w-3.5 h-3.5" />
            <span>Playwright TypeScript AST</span>
          </span>
          <span>•</span>
          <span className="text-slate-500">Semantic Role Priority Locators Active</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isGenerating}
            className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[11px]"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Regenerate Spec</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Lightweight, zero-dependency token highlighter for Playwright TypeScript syntax
 */
function renderSyntaxLine(line: string): React.ReactNode {
  // Empty line
  if (!line.trim()) {
    return <span> </span>;
  }

  // Comments
  if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
    return <span className="text-slate-500 italic">{line}</span>;
  }

  // Highlight key Playwright tokens
  const tokens = line.split(
    /(import|from|export|test|expect|await|async|getByRole|getByLabel|getByText|getByTestId|getByPlaceholder|goto|toBeVisible|toBeEnabled|toHaveURL|toHaveTitle|toHaveText|toHaveValue|click|fill|step|describe|beforeEach|setViewportSize|timeout|waitForLoadState)/g
  );

  return (
    <>
      {tokens.map((token, i) => {
        if (!token) return null;

        if (['import', 'from', 'export', 'await', 'async'].includes(token)) {
          return (
            <span key={i} className="text-purple-400 font-bold">
              {token}
            </span>
          );
        }
        if (['test', 'expect', 'describe', 'step', 'beforeEach'].includes(token)) {
          return (
            <span key={i} className="text-cyan-400 font-semibold">
              {token}
            </span>
          );
        }
        if (
          [
            'getByRole',
            'getByLabel',
            'getByText',
            'getByTestId',
            'getByPlaceholder',
            'goto',
            'click',
            'fill',
            'setViewportSize',
            'waitForLoadState',
          ].includes(token)
        ) {
          return (
            <span key={i} className="text-amber-300 font-medium">
              {token}
            </span>
          );
        }
        if (
          [
            'toBeVisible',
            'toBeEnabled',
            'toHaveURL',
            'toHaveTitle',
            'toHaveText',
            'toHaveValue',
          ].includes(token)
        ) {
          return (
            <span key={i} className="text-emerald-400 font-medium">
              {token}
            </span>
          );
        }

        // Color string literals inside the remaining segment
        return <span key={i}>{highlightStrings(token)}</span>;
      })}
    </>
  );
}

function highlightStrings(text: string): React.ReactNode {
  // Matches '...' or "..." or `...`
  const parts = text.split(/('[^']*'|"[^"]*"|`[^`]*`)/g);

  return parts.map((part, index) => {
    if (
      (part.startsWith("'") && part.endsWith("'")) ||
      (part.startsWith('"') && part.endsWith('"')) ||
      (part.startsWith('`') && part.endsWith('`'))
    ) {
      return (
        <span key={index} className="text-emerald-300">
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}
