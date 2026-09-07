import React, { useState } from 'react';
import { LLMConfig } from '../types';
import {
  Server,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Zap,
  Shield,
  HelpCircle,
  ExternalLink,
  Cpu,
  Terminal,
  Layers,
} from 'lucide-react';

interface LLMConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LLMConfig;
  onSave: (config: LLMConfig) => void;
}

export const LLMConfigModal: React.FC<LLMConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
}) => {
  const [formData, setFormData] = useState<LLMConfig>({ ...config });
  const [testing, setTesting] = useState(false);
  const [detectedModels, setDetectedModels] = useState<string[]>([]);
  const [browserProbeSuccess, setBrowserProbeSuccess] = useState<boolean | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs?: number;
    message: string;
    models?: string[];
    source?: string;
    isLocalhostCloudMismatch?: boolean;
  } | null>(null);

  if (!isOpen) return null;

  const presets = [
    {
      name: 'Ollama: Qwen 2.5 Coder',
      provider: 'ollama' as const,
      baseUrl: 'http://localhost:11434/v1',
      model: 'qwen2.5-coder:32b',
      badge: 'Local Coding Specialist',
      note: '32.8B parameter code specialist from local Ollama',
    },
    {
      name: 'Ollama: Llama 3.3',
      provider: 'ollama' as const,
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.3:latest',
      badge: 'Local 70B Reasoning',
      note: '70.6B flagship model from local Ollama tags',
    },
    {
      name: 'Ollama: Llama 3.2',
      provider: 'ollama' as const,
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.2:latest',
      badge: 'Local Fast 3.2B',
      note: '3.2B lightweight fast test synthesizer',
    },
    {
      name: 'Google Gemini Flash',
      provider: 'gemini' as const,
      baseUrl: 'https://generativelanguage.googleapis.com',
      model: 'gemini-3.8-flash',
      badge: 'Zero-Config Cloud',
      note: 'Ultra-fast multimodal reasoning with zero latency overhead',
    },
  ];

  const handleApplyPreset = (preset: typeof presets[0]) => {
    setFormData((prev) => ({
      ...prev,
      provider: preset.provider,
      baseUrl: preset.baseUrl,
      model: preset.model,
    }));
    setTestResult(null);
    setBrowserProbeSuccess(null);
  };

  const handleBaseUrlChange = (val: string) => {
    let clean = val.trim();
    // If user pasted http://localhost:11434/api/tags, auto-clean it
    if (clean.includes('/api/tags')) {
      clean = clean.replace(/\/api\/tags\/?$/i, '/v1');
    }
    setFormData((prev) => ({ ...prev, baseUrl: clean }));
  };

  const handleSelectModel = (modelName: string) => {
    setFormData((prev) => ({ ...prev, model: modelName }));
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setBrowserProbeSuccess(null);

    const isLocalhost =
      formData.baseUrl.includes('localhost') ||
      formData.baseUrl.includes('127.0.0.1') ||
      formData.baseUrl.includes('11434');

    // 1. Direct browser probe to http://localhost:11434/api/tags
    // Since the browser runs on the user's machine, it can reach localhost directly!
    let browserFoundModels: string[] = [];
    if (isLocalhost) {
      try {
        const origin = formData.baseUrl
          .replace(/\/v1\/?$/, '')
          .replace(/\/api\/?$/, '')
          .replace(/\/+$/, '');
        const probeUrl = `${origin}/api/tags`;
        const controller = new AbortController();
        const probeTimeout = setTimeout(() => controller.abort(), 2500);

        const probeRes = await fetch(probeUrl, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(probeTimeout);

        if (probeRes.ok) {
          const probeData = await probeRes.json();
          if (Array.isArray(probeData.models)) {
            browserFoundModels = probeData.models.map((m: any) => m.name || m.model);
            setDetectedModels(browserFoundModels);
            setBrowserProbeSuccess(true);
          }
        }
      } catch (probeErr) {
        // May be blocked by CORS if OLLAMA_ORIGINS is not set, handled gracefully below
        console.debug('Direct browser probe to Ollama:', probeErr);
      }
    }

    // 2. Server-side test route /api/llm/test-connection
    try {
      const res = await fetch('/api/llm/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      // Merge any models detected via browser probe
      if (browserFoundModels.length > 0) {
        data.models = Array.from(new Set([...(data.models || []), ...browserFoundModels]));
      }

      if (data.models && data.models.length > 0) {
        setDetectedModels(data.models);
      }

      setTestResult(data);
    } catch (err: any) {
      if (browserFoundModels.length > 0) {
        setTestResult({
          success: true,
          message: `Browser directly reached your local Ollama instance with ${browserFoundModels.length} models detected.`,
          models: browserFoundModels,
        });
      } else {
        setTestResult({
          success: false,
          message: err.message || 'Failed to reach test route.',
        });
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAndClose = () => {
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                LLM Router Configuration
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  Multi-Endpoint Active
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Route Playwright agents (Planner, Generator, Healer) to local Ollama or Cloud LLMs
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

        {/* Modal Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-6">
          {/* Quick Model Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                Select Engine / Model Preset
              </label>
              <span className="text-[11px] text-slate-400">Detected from your local setup</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {presets.map((preset) => {
                const isSelected =
                  formData.baseUrl.includes(preset.baseUrl.replace(/\/v1$/, '')) &&
                  formData.model === preset.model;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-100 shadow-sm ring-1 ring-indigo-500/40'
                        : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-100">{preset.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/80 text-indigo-300 font-mono">
                        {preset.badge}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-1 truncate">
                      {preset.model}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{preset.note}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Configuration Form */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                  Base URL (Ollama / vLLM / OpenAI Compatible)
                </label>
                <span className="text-[11px] text-slate-400">Accepts origin or /v1 or /api/tags</span>
              </div>
              <input
                type="text"
                value={formData.baseUrl}
                onChange={(e) => handleBaseUrlChange(e.target.value)}
                placeholder="http://localhost:11434/v1"
                className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span>
                  The LLM router auto-normalizes URLs. Whether you enter{' '}
                  <code className="text-indigo-300 bg-slate-800 px-1 py-0.5 rounded">http://localhost:11434</code>,{' '}
                  <code className="text-indigo-300 bg-slate-800 px-1 py-0.5 rounded">/v1</code>, or{' '}
                  <code className="text-indigo-300 bg-slate-800 px-1 py-0.5 rounded">/api/tags</code>, it routes both OpenAI and Ollama formats.
                </span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Target Model Name
                </label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="e.g. qwen2.5-coder:32b, llama3.3:latest"
                  className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  API Key (Optional for local Ollama)
                </label>
                <input
                  type="password"
                  value={formData.apiKey || ''}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="Leave empty for local Ollama"
                  className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Clickable Detected Model Chips */}
            {detectedModels.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/80">
                <div className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  Available Models Detected (Click to select):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {detectedModels.map((m) => {
                    const isCurrent = formData.model === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleSelectModel(m)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                          isCurrent
                            ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                            : 'bg-slate-700/70 hover:bg-slate-700 text-slate-300 hover:text-white'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Sampling Temperature ({formData.temperature ?? 0.2})
                </label>
                <span className="text-[11px] text-slate-400">0.1 - 0.2 recommended for Playwright code generation</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={formData.temperature ?? 0.2}
                onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500"
              />
            </div>
          </div>

          {/* Test Connection Banner */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <Shield className="w-4 h-4 text-emerald-400" />
                Ollama & LLM Router Diagnostic
              </div>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-medium transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                {testing ? 'Probing Endpoints...' : 'Ping & Detect Models'}
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3.5 rounded-xl text-xs flex flex-col gap-2 border ${
                  testResult.success
                    ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                    : 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  )}
                  <div className="flex-1">
                    <div className="font-semibold text-slate-100">
                      {testResult.success ? 'Endpoint Reachable & Ready' : 'Connection Notice'}
                    </div>
                    <div className="text-[11px] opacity-90 mt-0.5">{testResult.message}</div>
                  </div>
                </div>

                {/* Cloud Run Localhost Notice & Helper */}
                {testResult.isLocalhostCloudMismatch && (
                  <div className="mt-2 pt-2.5 border-t border-amber-800/40 text-[11px] text-slate-300 space-y-2">
                    <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                      Connecting Localhost (Windows) with Cloud Run Container:
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      Because this web app runs inside an isolated Cloud Run container,{' '}
                      <code className="text-amber-200 bg-slate-900/80 px-1 py-0.5 rounded">localhost</code> refers
                      to the cloud container. To connect your local machine's Ollama instance, choose either option:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                        <div className="font-semibold text-indigo-300 flex items-center gap-1">
                          <Terminal className="w-3 h-3" /> Option 1: Instant Tunnel
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Run in PowerShell:
                          <br />
                          <code className="text-slate-200 select-all block mt-0.5 bg-slate-950 px-1.5 py-0.5 rounded">
                            ngrok http 11434
                          </code>
                          Paste the resulting <code className="text-indigo-300">https://...ngrok-free.app/v1</code> URL above.
                        </p>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                        <div className="font-semibold text-emerald-300 flex items-center gap-1">
                          <Zap className="w-3 h-3" /> Option 2: Fallback to Cloud Gemini
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Select <strong>Google Gemini Flash</strong> above for instant zero-config Playwright test generation without installing tunnels.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex justify-between items-center">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Target model: <strong className="text-slate-200 font-mono">{formData.model}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white shadow-lg shadow-indigo-600/20 transition-colors"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
