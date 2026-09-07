import React, { useState } from 'react';
import { BookOpen, X, Copy, Check, Terminal, Server, Cpu, CheckCircle } from 'lucide-react';

interface SetupInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SetupInstructionsModal: React.FC<SetupInstructionsModalProps> = ({ isOpen, onClose }) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Setup & Deployment Instructions</h2>
              <p className="text-xs text-slate-400">
                Guide for configuring on-premise LLMs (Ollama, vLLM) and running the Planner Agent module
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* Section 1: Ollama */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                1. Setting Up On-Premise Ollama (Default: localhost:11434)
              </h3>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    `# Install and start Ollama\nollama serve\n\n# Pull recommended coding/planning models\nollama pull llama3.3\nollama pull qwen2.5-coder:32b`,
                    'ollama'
                  )
                }
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-mono flex items-center gap-1.5"
              >
                {copiedSection === 'ollama' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Commands
              </button>
            </div>
            <p className="text-slate-400 leading-relaxed">
              To keep all test requirements private inside your on-premise infrastructure, run Ollama locally. The Planner Agent LLM Router uses the standard OpenAI-compatible <code className="text-indigo-300">/v1/chat/completions</code> endpoint.
            </p>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-indigo-200">
              # Start Ollama service<br />
              ollama serve<br /><br />
              # Pull your model of choice<br />
              ollama pull llama3.3<br />
              # (Optional) pull Qwen2.5 Coder for code tasks<br />
              ollama pull qwen2.5-coder:32b
            </div>
          </div>

          {/* Section 2: vLLM */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                2. Running vLLM for Enterprise Serving
              </h3>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    `python -m vllm.entrypoints.openai.api_server \\\n  --model meta-llama/Llama-3.3-70B-Instruct \\\n  --port 8000 \\\n  --api-key your_optional_key`,
                    'vllm'
                  )
                }
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-mono flex items-center gap-1.5"
              >
                {copiedSection === 'vllm' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Commands
              </button>
            </div>
            <p className="text-slate-400 leading-relaxed">
              If running on a Kubernetes GPU cluster or on-premise server with vLLM, launch the OpenAI-compatible server:
            </p>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-cyan-200">
              python -m vllm.entrypoints.openai.api_server \<br />
              &nbsp;&nbsp;--model meta-llama/Llama-3.3-70B-Instruct \<br />
              &nbsp;&nbsp;--port 8000
            </div>
            <p className="text-slate-400 text-[11px]">
              Set the Base URL in the LLM Configuration modal to <code className="text-cyan-300">http://localhost:8000/v1</code>.
            </p>
          </div>

          {/* Section 3: Programmatic Node.js Usage */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                3. Programmatic Usage in Node.js / Express Services
              </h3>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    `import { runPlannerAgent } from './server/plannerAgent';\n\nconst specPlan = await runPlannerAgent(\n  'Verify guest checkout with promo code SAVE20',\n  'https://my-store.example.com',\n  {\n    baseUrl: 'http://localhost:11434/v1',\n    model: 'llama3.3',\n    provider: 'ollama'\n  },\n  {\n    timeoutMs: 60000,\n    onLog: (line) => console.log(line)\n  }\n);\n\nconsole.log(specPlan.title, specPlan.steps);`,
                    'code'
                  )
                }
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-mono flex items-center gap-1.5"
              >
                {copiedSection === 'code' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Code
              </button>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-200 overflow-x-auto">
              import &#123; runPlannerAgent &#125; from './server/plannerAgent';<br /><br />
              const plan = await runPlannerAgent(<br />
              &nbsp;&nbsp;'Verify guest checkout with promo code',<br />
              &nbsp;&nbsp;'https://my-store.example.com',<br />
              &nbsp;&nbsp;&#123; baseUrl: 'http://localhost:11434/v1', model: 'llama3.3' &#125;,<br />
              &nbsp;&nbsp;&#123; onLog: (msg) =&gt; console.log(msg) &#125;<br />
              );
            </div>
          </div>

          {/* Section 4: Architecture Highlights */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-indigo-400" />
              Core Architecture Highlights
            </h4>
            <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
              <li>
                <strong>Subprocess & LLM Router Isolation:</strong> Runs inside a dedicated temporary sandbox folder (<code className="text-slate-300">/tmp/playwright-planner-&lt;uuid&gt;</code>) preventing cross-test pollution.
              </li>
              <li>
                <strong>Strict Specs Standard:</strong> Ensures deterministic, robust Markdown plans saved to <code className="text-slate-300">specs/*.md</code> conforming to Playwright guidelines.
              </li>
              <li>
                <strong>Human-in-the-Loop Gateway:</strong> Execution halts until human testers review, edit, and approve the step checklist before generating Playwright code.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
