import React from 'react';
import { Bot, FileText, Code2, Wrench, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';

export const ArchitectureOverview: React.FC = () => {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Bot className="w-4 h-4 text-indigo-400" />
            Playwright Test Agents SaaS Lifecycle
          </h3>
          <p className="text-xs text-slate-400">
            Autonomous browser testing architecture with Human-in-the-Loop checkpoints
          </p>
        </div>
        <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-medium flex items-center gap-1.5 shadow-sm shadow-amber-500/10">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Phase 3 Active
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {/* Phase 1: Planner */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
              Phase 1 (Completed)
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-indigo-400" />
            <h4 className="text-xs font-bold text-slate-100">Planner Agent & LLM Router</h4>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Spawns isolated sandbox, routes prompt to on-prem OpenAI-compatible LLM (Ollama/vLLM), generates and parses <code className="text-indigo-300">specs/*.md</code>, and pauses for user checklist review.
          </p>
        </div>

        {/* Phase 2: Generator */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
              Phase 2 (Completed)
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <Code2 className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold text-slate-100">Code Generator & AST Builder</h4>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Synthesizes standalone Playwright TypeScript spec (<code className="text-cyan-300">tests/e2e/test-1.spec.ts</code>) using semantic ARIA role locators (<code className="text-cyan-300">getByRole</code>) and manual code editor.
          </p>
        </div>

        {/* Phase 3: Healer */}
        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/40 relative shadow-md shadow-amber-950/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
              Phase 3 (Active Now)
            </span>
            <CheckCircle2 className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <Wrench className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-slate-100">Self-Healing Runtime & Reports</h4>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Executes headless test engine, captures DOM snapshots on locator failures, autonomous Healer Agent patches spec in place, re-executes tests, and exports HTML/Jira/GitHub reports.
          </p>
        </div>
      </div>
    </div>
  );
};
