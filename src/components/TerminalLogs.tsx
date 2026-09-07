import React, { useEffect, useRef, useState } from 'react';
import { Terminal, Copy, Check, Trash2, ArrowDown, ShieldCheck, Radio, Wifi } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

interface TerminalLogsProps {
  logs: LogEntry[];
  onClear?: () => void;
  isRunning?: boolean;
  streamingProtocol?: 'websocket' | 'sse' | 'idle';
}

export const TerminalLogs: React.FC<TerminalLogsProps> = ({
  logs,
  onClear,
  isRunning,
  streamingProtocol = 'idle',
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [filterLevel, setFilterLevel] = useState<'all' | 'info' | 'warn' | 'error'>('all');

  useEffect(() => {
    if (autoScroll) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleCopyLogs = () => {
    const raw = logs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLogs = logs.filter((log) => {
    if (filterLevel === 'all') return true;
    return log.level === filterLevel;
  });

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl flex flex-col h-full overflow-hidden shadow-xl">
      {/* Console Header */}
      <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <div className="flex items-center gap-2 pl-2 text-xs font-mono font-medium text-slate-300">
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span>Agent Sandbox Terminal</span>
          </div>

          {/* Protocol Badge */}
          {streamingProtocol === 'websocket' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-mono border border-emerald-500/30">
              <Wifi className="w-2.5 h-2.5 animate-pulse" />
              WS Real-Time
            </span>
          )}
          {streamingProtocol === 'sse' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 text-[10px] font-mono border border-cyan-500/30">
              <Radio className="w-2.5 h-2.5 animate-pulse" />
              SSE Stream
            </span>
          )}

          {isRunning && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              Streaming logs
            </span>
          )}
        </div>

        {/* Action Controls & Filters */}
        <div className="flex items-center gap-2">
          {/* Filter Pills */}
          <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-lg p-0.5 text-[10px] font-mono">
            {(['all', 'info', 'warn', 'error'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setFilterLevel(lvl)}
                className={`px-2 py-0.5 rounded uppercase font-semibold transition-colors ${
                  filterLevel === lvl
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <div className="h-3.5 w-px bg-slate-800" />

          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-colors ${
              autoScroll ? 'bg-slate-800 text-indigo-400' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle autoscroll"
          >
            <ArrowDown className="w-3 h-3" />
            Auto-scroll
          </button>
          <button
            type="button"
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40"
            title="Copy logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              disabled={logs.length === 0}
              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors disabled:opacity-40"
              title="Clear terminal"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal Output Body */}
      <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-slate-300 space-y-1.5 select-text min-h-[200px] max-h-[440px]">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center py-12">
            <ShieldCheck className="w-8 h-8 mb-2 opacity-30 text-indigo-400" />
            <p className="text-xs">
              {logs.length === 0
                ? 'No active terminal session.'
                : `No logs match filter "${filterLevel.toUpperCase()}".`}
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Submit a prompt above to launch the Planner agent inside an isolated sandbox.
            </p>
          </div>
        ) : (
          filteredLogs.map((item, idx) => {
            let textColor = 'text-slate-300';
            if (item.level === 'warn') textColor = 'text-amber-300';
            if (item.level === 'error') textColor = 'text-rose-400 font-semibold';
            if (item.message.includes('stdout')) textColor = 'text-cyan-300';
            if (item.message.includes('Found generated spec') || item.message.includes('completed successfully')) {
              textColor = 'text-emerald-400 font-semibold';
            }

            return (
              <div key={idx} className="flex items-start gap-2 leading-relaxed break-all">
                <span className="text-slate-600 select-none shrink-0 text-[10px]">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-slate-500 select-none shrink-0">$</span>
                <span className={`${textColor} flex-1`}>{item.message}</span>
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
