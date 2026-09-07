import React, { useState } from 'react';
import { Play, Sparkles, Globe, Settings, Wand2, HelpCircle } from 'lucide-react';
import { LLMConfig } from '../types';

interface PromptFormProps {
  onSubmit: (requirement: string, targetUrl: string) => void;
  isRunning: boolean;
  llmConfig: LLMConfig;
  onOpenConfig: () => void;
}

export const PromptForm: React.FC<PromptFormProps> = ({
  onSubmit,
  isRunning,
  llmConfig,
  onOpenConfig,
}) => {
  const [requirement, setRequirement] = useState('');
  const [targetUrl, setTargetUrl] = useState('https://ecommerce-playground.lambdatest.io');

  const presets = [
    {
      label: 'Guest Checkout + Promo',
      url: 'https://ecommerce-playground.lambdatest.io',
      prompt:
        'Verify guest checkout flow: Add a featured laptop to cart, proceed to checkout as a guest, apply promo code "SAVE20", verify discount calculation in subtotal, and assert the order review screen is displayed.',
    },
    {
      label: 'TodoMVC Full Lifecycle',
      url: 'https://demo.playwright.dev/todomvc',
      prompt:
        'Verify Todo list lifecycle: Create 3 tasks ("Buy groceries", "Write Playwright tests", "Review pull request"), mark the second task as completed, filter by "Active", verify count displays "2 items left", and clear completed items.',
    },
    {
      label: 'Auth & Form Validation',
      url: 'https://the-internet.herokuapp.com/login',
      prompt:
        'Test authentication edge cases: Attempt login with invalid credentials and verify red error alert banner appears. Then submit valid credentials (username: tomsmith, password: SuperSecretPassword!), and assert redirect to /secure with green success banner.',
    },
    {
      label: 'Search & Table Filter',
      url: 'https://datatables.net/examples/basic_init/zero_configuration.html',
      prompt:
        'Search and filter table records: Search for "London", verify all matching rows display "London" in the Office column, change pagination dropdown to show 25 entries, and assert the table entries counter updates accordingly.',
    },
  ];

  const handleApplyPreset = (preset: typeof presets[0]) => {
    setRequirement(preset.prompt);
    setTargetUrl(preset.url);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requirement.trim()) return;
    onSubmit(requirement.trim(), targetUrl.trim());
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-indigo-400" />
            Plain English Test Requirement
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Describe the end-to-end user scenario you want the Playwright Planner agent to architect
          </p>
        </div>

        {/* LLM Status badge */}
        <button
          type="button"
          onClick={onOpenConfig}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-300 transition-colors self-start sm:self-auto"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-mono text-indigo-300 font-semibold">{llmConfig.model}</span>
          <span className="text-slate-500">|</span>
          <Settings className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      {/* Preset Chips */}
      <div>
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Quick Test Templates
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handleApplyPreset(p)}
              className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/70 text-xs font-medium text-slate-300 transition-colors flex items-center gap-1.5"
            >
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Target URL */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              Target Application Base URL
            </span>
            <span className="text-[11px] text-slate-400 font-normal">Playwright browser target</span>
          </label>
          <input
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://your-app.example.com"
            required
            className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Plain English Requirement */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
            <span>Natural Language Test Scenario</span>
            <span className="text-[11px] text-slate-400 font-normal">Actions, data inputs, and expected outcomes</span>
          </label>
          <textarea
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            rows={4}
            placeholder="e.g. Verify user signup: navigate to /register, input valid username and password, toggle terms of service checkbox, submit form, and assert dashboard welcome banner appears."
            required
            className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
          />
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            Runs Planner agent inside isolated sandbox and extracts <code className="text-indigo-300">specs/*.md</code>
          </div>

          <button
            type="submit"
            disabled={isRunning || !requirement.trim()}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Running Planner Agent...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Generate Test Plan</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
