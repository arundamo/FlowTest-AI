import React, { useState, useEffect, useRef } from 'react';
import { ParsedSpecPlan, TestStep } from '../types';
import {
  CheckCircle,
  FileCode,
  ListOrdered,
  Download,
  Copy,
  Check,
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  Folder,
  Clock,
  Sparkles,
  ArrowRight,
  Save,
  Columns,
  Eye,
  RotateCcw,
  GitCompare,
  AlertTriangle,
  Maximize2,
  Minimize2,
  ArrowUp,
  ArrowDown,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  Sliders,
  Code2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Markdown from 'react-markdown';
import {
  parseMarkdownToPlan,
  convertPlanToMarkdown,
  validatePlan,
} from '../utils/markdownParser';

interface PlanReviewerProps {
  plan: ParsedSpecPlan;
  jobStatus: string;
  onApprove: (
    steps: TestStep[],
    rawMarkdown?: string,
    notes?: string,
    title?: string
  ) => void;
  isApproving?: boolean;
  onGenerateCode?: (
    steps: TestStep[],
    rawMarkdown?: string,
    notes?: string,
    title?: string
  ) => void;
  isGeneratingCode?: boolean;
  hasGeneratedCode?: boolean;
  onViewGeneratedCode?: () => void;
}

type TabMode = 'checklist' | 'editor' | 'preview' | 'diff';
type EditorLayout = 'split' | 'editor-only' | 'preview-only';

export const PlanReviewer: React.FC<PlanReviewerProps> = ({
  plan,
  jobStatus,
  onApprove,
  isApproving = false,
  onGenerateCode,
  isGeneratingCode = false,
  hasGeneratedCode = false,
  onViewGeneratedCode,
}) => {
  // Navigation & View States
  const [activeTab, setActiveTab] = useState<TabMode>('checklist');
  const [editorLayout, setEditorLayout] = useState<EditorLayout>('split');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Content States
  const [title, setTitle] = useState(plan.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [steps, setSteps] = useState<TestStep[]>(plan.steps || []);
  const [preconditions, setPreconditions] = useState<string[]>(plan.preconditions || []);
  const [edgeCases, setEdgeCases] = useState<string[]>(plan.edgeCases || []);
  const [markdown, setMarkdown] = useState<string>(plan.rawMarkdown);
  const [originalMarkdown] = useState<string>(plan.rawMarkdown);

  // Review & Editing States
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'markdown-modified' | 'checklist-modified'>('synced');
  const [showValidationDetails, setShowValidationDetails] = useState(false);

  // New item inputs
  const [newPrecondition, setNewPrecondition] = useState('');
  const [newEdgeCase, setNewEdgeCase] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state when incoming plan changes
  useEffect(() => {
    setTitle(plan.title);
    setSteps(plan.steps || []);
    setPreconditions(plan.preconditions || []);
    setEdgeCases(plan.edgeCases || []);
    setMarkdown(plan.rawMarkdown);
    setSyncStatus('synced');
  }, [plan.id]);

  // Validation results
  const validation = validatePlan(steps, markdown);
  const approvedCount = steps.filter((s) => s.isApproved).length;
  const isDirty = markdown !== originalMarkdown;

  // Sync Checklist changes into Markdown representation
  const syncChecklistToMarkdown = (
    currentTitle = title,
    currentPreconditions = preconditions,
    currentSteps = steps,
    currentEdgeCases = edgeCases
  ) => {
    const updated = convertPlanToMarkdown(
      currentTitle,
      plan.targetUrl,
      currentPreconditions,
      currentSteps,
      currentEdgeCases
    );
    setMarkdown(updated);
    setSyncStatus('synced');
  };

  // Sync Markdown edits into Checklist representation
  const syncMarkdownToChecklist = () => {
    const parsed = parseMarkdownToPlan(markdown, plan.targetUrl, steps);
    setTitle(parsed.title);
    setPreconditions(parsed.preconditions);
    setSteps(parsed.steps);
    setEdgeCases(parsed.edgeCases);
    setSyncStatus('synced');
  };

  // --- Step Manipulation Handlers ---
  const handleToggleStep = (stepId: string) => {
    const updated = steps.map((s) => (s.id === stepId ? { ...s, isApproved: !s.isApproved } : s));
    setSteps(updated);
    setSyncStatus('checklist-modified');
  };

  const handleToggleAllSteps = () => {
    const allApproved = steps.every((s) => s.isApproved);
    const updated = steps.map((s) => ({ ...s, isApproved: !allApproved }));
    setSteps(updated);
    setSyncStatus('checklist-modified');
  };

  const handleUpdateStep = (stepId: string, field: keyof TestStep, value: any) => {
    const updated = steps.map((s) => (s.id === stepId ? { ...s, [field]: value } : s));
    setSteps(updated);
    setSyncStatus('checklist-modified');
  };

  const handleAddStep = () => {
    const newStepNumber = steps.length + 1;
    const newStep: TestStep = {
      id: `custom-step-${Date.now()}`,
      stepNumber: newStepNumber,
      description: `Step ${newStepNumber}: Interact with target element`,
      action: 'page.click("[data-testid=\'action-btn\']")',
      expectedAssertion: 'expect(page.locator(".result")).toBeVisible()',
      selectorHint: 'data-testid="action-btn"',
      isApproved: true,
    };
    const updated = [...steps, newStep];
    setSteps(updated);
    setEditingStepId(newStep.id);
    setSyncStatus('checklist-modified');
  };

  const handleDeleteStep = (stepId: string) => {
    const filtered = steps.filter((s) => s.id !== stepId);
    const renumbered = filtered.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
    setSteps(renumbered);
    setSyncStatus('checklist-modified');
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;

    const copy = [...steps];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);

    const renumbered = copy.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
    setSteps(renumbered);
    setSyncStatus('checklist-modified');
  };

  // Preconditions & Edge Cases
  const handleAddPrecondition = () => {
    if (!newPrecondition.trim()) return;
    const updated = [...preconditions, newPrecondition.trim()];
    setPreconditions(updated);
    setNewPrecondition('');
    setSyncStatus('checklist-modified');
  };

  const handleDeletePrecondition = (idx: number) => {
    const updated = preconditions.filter((_, i) => i !== idx);
    setPreconditions(updated);
    setSyncStatus('checklist-modified');
  };

  const handleAddEdgeCase = () => {
    if (!newEdgeCase.trim()) return;
    const updated = [...edgeCases, newEdgeCase.trim()];
    setEdgeCases(updated);
    setNewEdgeCase('');
    setSyncStatus('checklist-modified');
  };

  const handleDeleteEdgeCase = (idx: number) => {
    const updated = edgeCases.filter((_, i) => i !== idx);
    setEdgeCases(updated);
    setSyncStatus('checklist-modified');
  };

  // Markdown Editor Helpers
  const handleMarkdownChange = (newText: string) => {
    setMarkdown(newText);
    setSyncStatus('markdown-modified');
  };

  const insertMarkdownSnippet = (snippet: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMarkdown((prev) => prev + '\n' + snippet);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = markdown.substring(0, start);
    const after = markdown.substring(end);
    const updated = `${before}${snippet}${after}`;
    setMarkdown(updated);
    setSyncStatus('markdown-modified');

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 0);
  };

  const handleResetToOriginal = () => {
    if (window.confirm('Reset all edits back to the initial AI-generated specification?')) {
      setMarkdown(originalMarkdown);
      const parsed = parseMarkdownToPlan(originalMarkdown, plan.targetUrl, plan.steps);
      setTitle(parsed.title);
      setPreconditions(parsed.preconditions);
      setSteps(parsed.steps);
      setEdgeCases(parsed.edgeCases);
      setSyncStatus('synced');
    }
  };

  // Export & Copy
  const handleDownload = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', plan.fileName || 'playwright-spec.md');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Approval Submission
  const handleSubmitApproval = () => {
    // If markdown was modified without syncing, sync first to ensure steps match
    let finalSteps = steps;
    if (syncStatus === 'markdown-modified') {
      const parsed = parseMarkdownToPlan(markdown, plan.targetUrl, steps);
      finalSteps = parsed.steps;
    }
    onApprove(finalSteps, markdown, reviewerNotes, title);
  };

  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-4 z-50 bg-slate-950/95 backdrop-blur-xl border-indigo-500/40 shadow-2xl overflow-y-auto'
          : 'relative'
      }`}
    >
      {/* Header Bar */}
      <div className="p-5 border-b border-slate-800 bg-slate-900/95 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 text-xs font-medium flex items-center gap-1.5 border border-indigo-500/25">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              Planner Agent Spec
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3 text-slate-500" />
              {(plan.executionTimeMs / 1000).toFixed(2)}s
            </span>
            <span className="text-xs font-mono text-slate-300 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
              {plan.modelUsed}
            </span>
            {isDirty && (
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <Edit2 className="w-2.5 h-2.5" />
                Modified
              </span>
            )}
            {jobStatus === 'approved' && (
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle className="w-2.5 h-2.5" />
                Approved
              </span>
            )}
          </div>

          {/* Title Editor */}
          {isEditingTitle ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setSyncStatus('checklist-modified');
                }}
                className="px-3 py-1.5 bg-slate-950 border border-indigo-500 rounded-lg text-lg font-bold text-slate-100 flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setIsEditingTitle(false);
                  syncChecklistToMarkdown(title);
                }}
                className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
                title="Save title"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h2 className="text-xl font-bold text-slate-100 tracking-tight">{title}</h2>
              <button
                type="button"
                onClick={() => setIsEditingTitle(true)}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-400 transition-opacity"
                title="Edit plan title"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-400">
            <span className="flex items-center gap-1 font-mono text-indigo-300">
              <ExternalLink className="w-3 h-3 text-indigo-400" />
              <a
                href={plan.targetUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:underline hover:text-indigo-200"
              >
                {plan.targetUrl}
              </a>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-mono text-slate-400" title={plan.filePath}>
              <Folder className="w-3 h-3 text-slate-500" />
              {plan.fileName}
            </span>
          </div>
        </div>

        {/* View Switchers & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Main Tabs */}
          <div className="bg-slate-950/80 p-1 rounded-xl flex items-center border border-slate-800">
            <button
              type="button"
              onClick={() => {
                if (syncStatus === 'markdown-modified') {
                  syncMarkdownToChecklist();
                }
                setActiveTab('checklist');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'checklist'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              Checklist ({approvedCount}/{steps.length})
            </button>
            <button
              type="button"
              onClick={() => {
                if (syncStatus === 'checklist-modified') {
                  syncChecklistToMarkdown();
                }
                setActiveTab('editor');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'editor'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              Markdown Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('diff')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'diff'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              Changes
              {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
            </button>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopy}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Copy Markdown Spec"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Download spec file"
            >
              <Download className="w-4 h-4" />
            </button>
            {isDirty && (
              <button
                type="button"
                onClick={handleResetToOriginal}
                className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors"
                title="Reset to AI Original"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title={isFullscreen ? 'Exit full screen' : 'Expand full screen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Sync / Warning Notification Bar */}
      {syncStatus !== 'synced' && (
        <div className="px-5 py-2 bg-indigo-950/40 border-b border-indigo-900/50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-indigo-300">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>
              {syncStatus === 'markdown-modified'
                ? 'Markdown has been edited directly. Switch to Checklist to automatically parse updates.'
                : 'Checklist has been modified. Sync to regenerate markdown.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (syncStatus === 'markdown-modified') {
                syncMarkdownToChecklist();
              } else {
                syncChecklistToMarkdown();
              }
            }}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-medium"
          >
            {syncStatus === 'markdown-modified' ? 'Sync to Checklist' : 'Sync to Markdown'}
          </button>
        </div>
      )}

      {/* Main Body */}
      <div className="p-6 flex-1 overflow-y-auto">
        {/* TAB 1: INTERACTIVE CHECKLIST */}
        {activeTab === 'checklist' && (
          <div className="space-y-6">
            {/* Guidance banner */}
            <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/40 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div className="flex-1 text-xs">
                <div className="font-semibold text-indigo-200">
                  Human-in-the-Loop Spec Reviewer
                </div>
                <p className="text-slate-400 mt-0.5 leading-relaxed">
                  Review and customize the Planner’s step-by-step test sequence. You can reorder
                  steps, refine actions, adjust locator hints, and toggle assertions on or off before
                  handing off to the Playwright Generator agent.
                </p>
              </div>
            </div>

            {/* Quality & Assertion Validation Bar */}
            <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-300 font-medium">Quality Check:</span>
                  <span className="font-mono text-emerald-300">
                    {validation.stats.stepsWithAssertions}/{validation.stats.totalSteps} Assertions
                  </span>
                </div>
                <div className="h-3 w-px bg-slate-800" />
                <div className="text-slate-400 font-mono text-[11px]">
                  Selectors defined: {validation.stats.stepsWithSelectors}/{validation.stats.totalSteps}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {validation.warnings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowValidationDetails(!showValidationDetails)}
                    className="flex items-center gap-1 text-amber-400 hover:text-amber-300 text-[11px] font-medium"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {validation.warnings.length} warning(s)
                    {showValidationDetails ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleToggleAllSteps}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                >
                  {steps.every((s) => s.isApproved) ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>

            {/* Collapsible Validation Warnings */}
            {showValidationDetails && validation.warnings.length > 0 && (
              <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl text-xs space-y-1 text-amber-300">
                {validation.warnings.map((w, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Preconditions Section */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Preconditions & Initial State ({preconditions.length})
                </h4>
              </div>
              <ul className="space-y-2">
                {preconditions.map((prec, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-slate-300 flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/50 border border-slate-800/80 group"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                      <span>{prec}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePrecondition(idx)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                      title="Remove precondition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              {/* Add Precondition Input */}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800/60">
                <input
                  type="text"
                  value={newPrecondition}
                  onChange={(e) => setNewPrecondition(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddPrecondition();
                  }}
                  placeholder="Add a precondition (e.g., User authenticated as Admin)"
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddPrecondition}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  Add
                </button>
              </div>
            </div>

            {/* Test Execution Sequence Steps */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Test Execution Sequence ({steps.length} steps)
                </h4>
                <button
                  type="button"
                  onClick={handleAddStep}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-xs font-medium text-indigo-300 border border-indigo-500/30 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Step
                </button>
              </div>

              <div className="space-y-3">
                {steps.map((step, idx) => {
                  const isEditing = editingStepId === step.id;

                  return (
                    <div
                      key={step.id}
                      className={`p-4 rounded-xl border transition-all ${
                        step.isApproved
                          ? 'bg-slate-950/60 border-slate-800/90'
                          : 'bg-slate-950/20 border-slate-900 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Approval Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleStep(step.id)}
                          className={`w-5 h-5 mt-0.5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                            step.isApproved
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-slate-800 border-slate-600 text-transparent'
                          }`}
                          title={step.isApproved ? 'Step approved' : 'Step excluded'}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>

                        {/* Step Details & Inline Editor */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-indigo-400 font-mono">
                                Step {step.stepNumber}
                              </span>
                              {step.selectorHint && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                  {step.selectorHint}
                                </span>
                              )}
                            </div>

                            {/* Controls: Reorder, Edit, Delete */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveStep(idx, 'up')}
                                disabled={idx === 0}
                                className="p-1 rounded text-slate-500 hover:text-slate-200 disabled:opacity-20"
                                title="Move step up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveStep(idx, 'down')}
                                disabled={idx === steps.length - 1}
                                className="p-1 rounded text-slate-500 hover:text-slate-200 disabled:opacity-20"
                                title="Move step down"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingStepId(isEditing ? null : step.id)
                                }
                                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                                title="Edit step"
                              >
                                {isEditing ? (
                                  <Save className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Edit2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStep(step.id)}
                                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                                title="Remove step"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {isEditing ? (
                            <div className="space-y-2.5 mt-2.5 pt-2 border-t border-slate-800">
                              <div>
                                <label className="block text-[11px] text-slate-400 mb-0.5 font-medium">
                                  Step Summary / Intent
                                </label>
                                <input
                                  type="text"
                                  value={step.description}
                                  onChange={(e) =>
                                    handleUpdateStep(step.id, 'description', e.target.value)
                                  }
                                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 font-medium focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[11px] text-cyan-400 mb-0.5 font-medium">
                                    Action (Interaction Code / Intent)
                                  </label>
                                  <input
                                    type="text"
                                    value={step.action}
                                    onChange={(e) =>
                                      handleUpdateStep(step.id, 'action', e.target.value)
                                    }
                                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-cyan-300 font-mono focus:ring-1 focus:ring-indigo-500"
                                    placeholder="page.click('button#submit')"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] text-emerald-400 mb-0.5 font-medium">
                                    Expected Assertion / Verification
                                  </label>
                                  <input
                                    type="text"
                                    value={step.expectedAssertion}
                                    onChange={(e) =>
                                      handleUpdateStep(step.id, 'expectedAssertion', e.target.value)
                                    }
                                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-emerald-300 font-mono focus:ring-1 focus:ring-indigo-500"
                                    placeholder="expect(page.locator('.alert')).toBeVisible()"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[11px] text-slate-400 mb-0.5 font-medium">
                                  Selector Hint / Locator (Optional)
                                </label>
                                <input
                                  type="text"
                                  value={step.selectorHint || ''}
                                  onChange={(e) =>
                                    handleUpdateStep(step.id, 'selectorHint', e.target.value)
                                  }
                                  className="w-full px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 font-mono focus:ring-1 focus:ring-indigo-500"
                                  placeholder='data-testid="todo-input" or button:has-text("Submit")'
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="mt-1 space-y-1.5">
                              <div className="text-sm font-semibold text-slate-200">
                                {step.description}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                                  <span className="text-[10px] uppercase font-bold text-cyan-400 block mb-0.5">
                                    Action
                                  </span>
                                  <span className="font-mono text-cyan-300 text-[11px] break-all">
                                    {step.action}
                                  </span>
                                </div>
                                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                                  <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">
                                    Expected Assertion
                                  </span>
                                  <span className="font-mono text-emerald-300 text-[11px] break-all">
                                    {step.expectedAssertion}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Edge Cases Section */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-amber-300/90 uppercase tracking-wider">
                  Edge Cases & Self-Healing Notes ({edgeCases.length})
                </h4>
              </div>
              <ul className="space-y-2">
                {edgeCases.map((ec, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-slate-300 flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/50 border border-slate-800/80 group"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span>{ec}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteEdgeCase(idx)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                      title="Remove edge case"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              {/* Add Edge Case Input */}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800/60">
                <input
                  type="text"
                  value={newEdgeCase}
                  onChange={(e) => setNewEdgeCase(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddEdgeCase();
                  }}
                  placeholder="Add self-healing note or edge case (e.g., Handle slow network 3G profile)"
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddEdgeCase}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MARKDOWN EDITOR (Split Screen / Live Preview) */}
        {activeTab === 'editor' && (
          <div className="space-y-4">
            {/* Editor Toolbar */}
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              {/* Layout toggles */}
              <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditorLayout('split')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                    editorLayout === 'split'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Split view (Editor + Preview)"
                >
                  <Columns className="w-3 h-3" />
                  Split View
                </button>
                <button
                  type="button"
                  onClick={() => setEditorLayout('editor-only')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                    editorLayout === 'editor-only'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Editor only"
                >
                  <FileCode className="w-3 h-3" />
                  Editor
                </button>
                <button
                  type="button"
                  onClick={() => setEditorLayout('preview-only')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                    editorLayout === 'preview-only'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Preview only"
                >
                  <Eye className="w-3 h-3" />
                  Preview
                </button>
              </div>

              {/* Snippet Insertion buttons */}
              <div className="flex items-center gap-1 overflow-x-auto">
                <button
                  type="button"
                  onClick={() =>
                    insertMarkdownSnippet(
                      `\n### Step ${steps.length + 1}: New Test Action\n- **Action**: page.click('[data-testid="submit"]')\n- **Expectation**: expect(page.locator('.status')).toBeVisible()\n- **Status**: Approved\n`
                    )
                  }
                  className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-slate-800 rounded text-[11px] font-mono flex items-center gap-1"
                  title="Insert step snippet"
                >
                  <Plus className="w-3 h-3" />
                  + Step
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertMarkdownSnippet(
                      `- **Action**: page.fill('[data-testid="input"]', 'test-value')\n`
                    )
                  }
                  className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 rounded text-[11px] font-mono"
                  title="Insert Action snippet"
                >
                  + Action
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertMarkdownSnippet(
                      `- **Expectation**: await expect(page.locator('.alert')).toHaveText('Success')\n`
                    )
                  }
                  className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-800 rounded text-[11px] font-mono"
                  title="Insert Expectation snippet"
                >
                  + Assert
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertMarkdownSnippet(
                      `- **Precondition**: User is logged in with active session\n`
                    )
                  }
                  className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded text-[11px] font-mono"
                >
                  + Precond
                </button>
                <button
                  type="button"
                  onClick={() =>
                    insertMarkdownSnippet(
                      `- **Healing Note**: If button is detached, retry with soft assertion\n`
                    )
                  }
                  className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 rounded text-[11px] font-mono"
                >
                  + Edge
                </button>
              </div>

              {/* Stats */}
              <div className="text-[11px] font-mono text-slate-500">
                {validation.stats.wordCount} words • {validation.stats.charCount} chars
              </div>
            </div>

            {/* Editor / Preview Panes */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Pane: Code/Textarea Editor */}
              {(editorLayout === 'split' || editorLayout === 'editor-only') && (
                <div
                  className={`${
                    editorLayout === 'split' ? 'lg:col-span-6' : 'lg:col-span-12'
                  } flex flex-col bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-inner`}
                >
                  <div className="px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                      Markdown Source Editor
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Live sync enabled
                    </span>
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={markdown}
                    onChange={(e) => handleMarkdownChange(e.target.value)}
                    className="w-full h-[540px] p-4 bg-slate-950 font-mono text-xs text-slate-200 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50 selection:bg-indigo-600 selection:text-white"
                    placeholder="Enter Playwright specification in Markdown format..."
                    spellCheck={false}
                  />
                </div>
              )}

              {/* Right Pane: Live Rendered Preview */}
              {(editorLayout === 'split' || editorLayout === 'preview-only') && (
                <div
                  className={`${
                    editorLayout === 'split' ? 'lg:col-span-6' : 'lg:col-span-12'
                  } flex flex-col bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-inner`}
                >
                  <div className="px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-emerald-400" />
                      Live Rendered Markdown Preview
                    </span>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Real-time
                    </span>
                  </div>
                  <div className="h-[540px] overflow-y-auto p-5 font-mono text-xs text-slate-300">
                    <div className="markdown-body prose prose-invert max-w-none space-y-4">
                      <Markdown>{markdown}</Markdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: DIFF / CHANGES VIEW */}
        {activeTab === 'diff' && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-slate-200">Specification Modification History</span>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Comparing current test specification against the initial AI Planner agent baseline.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isDirty ? (
                  <span className="px-2.5 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-mono">
                    Custom modifications detected
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 text-[11px] font-mono">
                    Identical to original baseline
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleResetToOriginal}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                >
                  Revert Changes
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 font-mono text-xs">
              {/* Baseline Original */}
              <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 overflow-x-auto max-h-[500px]">
                <div className="text-[11px] uppercase font-bold text-slate-500 mb-2 border-b border-slate-800 pb-1">
                  Original AI-Generated Spec
                </div>
                <pre className="text-slate-400 whitespace-pre-wrap leading-relaxed">
                  {originalMarkdown}
                </pre>
              </div>

              {/* Current Edited */}
              <div className="bg-slate-950 rounded-xl border border-indigo-950/80 p-4 overflow-x-auto max-h-[500px]">
                <div className="text-[11px] uppercase font-bold text-indigo-400 mb-2 border-b border-slate-800 pb-1">
                  Current Edited Version (Ready for Approval)
                </div>
                <pre className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {markdown}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reviewer Notes & Approval Footer */}
      <div className="p-5 border-t border-slate-800 bg-slate-900/95 flex flex-col gap-4">
        {/* Optional Reviewer Notes / Generator Directives */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0 font-medium">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span>Reviewer Directives (Optional):</span>
          </div>
          <input
            type="text"
            value={reviewerNotes}
            onChange={(e) => setReviewerNotes(e.target.value)}
            placeholder="e.g. Focus on mobile viewport (375x812), use data-testid locators, disable headless mode"
            className="flex-1 w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                approvedCount > 0 ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            <span>
              {approvedCount} of {steps.length} steps selected for Playwright code generation.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {hasGeneratedCode && onViewGeneratedCode && (
              <button
                type="button"
                onClick={onViewGeneratedCode}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
              >
                <Code2 className="w-4 h-4 text-cyan-400" />
                <span>View Spec (.spec.ts)</span>
              </button>
            )}

            {onGenerateCode && (jobStatus === 'approved' || hasGeneratedCode) ? (
              <button
                type="button"
                onClick={() => onGenerateCode(steps, markdown, reviewerNotes, title)}
                disabled={isGeneratingCode || approvedCount === 0}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-600/25"
              >
                {isGeneratingCode ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Generating Playwright Spec...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-cyan-200" />
                    <span>Generate Playwright Code (Phase 2)</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitApproval}
                disabled={isApproving || approvedCount === 0}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${
                  jobStatus === 'approved'
                    ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25 disabled:opacity-50'
                }`}
              >
                {isApproving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Approving & Queueing Generator...</span>
                  </>
                ) : jobStatus === 'approved' ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-200" />
                    <span>Plan Approved (Phase 2 Ready)</span>
                  </>
                ) : (
                  <>
                    <span>Approve Plan & Generate Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
