export interface LLMConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  provider?: 'ollama' | 'vllm' | 'openai' | 'gemini' | 'custom';
}

export interface TestStep {
  id: string;
  stepNumber: number;
  description: string;
  action: string;
  expectedAssertion: string;
  selectorHint?: string;
  isApproved: boolean;
}

export interface ParsedSpecPlan {
  id: string;
  title: string;
  targetUrl: string;
  preconditions: string[];
  steps: TestStep[];
  edgeCases: string[];
  rawMarkdown: string;
  fileName: string;
  filePath: string;
  sandboxDir: string;
  createdAt: string;
  executionTimeMs: number;
  tokensUsed?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  modelUsed: string;
}

export interface PlannerExecutionOptions {
  sandboxDir?: string;
  timeoutMs?: number;
  agentExecutable?: string;
  preserveSandbox?: boolean;
  onLog?: (log: string, level?: 'info' | 'warn' | 'error') => void;
  executionMode?: 'auto' | 'subprocess' | 'direct_llm';
}

export interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

export interface HealingRecord {
  stepNumber: number;
  brokenLocator: string;
  healedLocator: string;
  errorType: 'TimeoutError' | 'SelectorNotFound' | 'StaleElementReference' | 'DOMMutation' | 'LocatorMismatch';
  errorMessage: string;
  reason: string;
  confidence: number;
  healedAt: string;
  originalCodeSnippet: string;
  repairedCodeSnippet: string;
}

export interface ExecutionStepResult {
  stepNumber: number;
  title: string;
  action: string;
  locator: string;
  status: 'passed' | 'failed' | 'healed' | 'running' | 'queued';
  durationMs: number;
  screenshotUrl?: string;
  domSnapshot?: string;
  error?: string;
  healingDetails?: HealingRecord;
  timestamp: string;
}

export interface TraceArtifacts {
  traceZipUrl?: string;
  htmlReportUrl?: string;
  videoUrl?: string;
  videoFrames?: { stepNumber: number; title: string; image: string; timestampMs: number }[];
  screenshots?: { stepNumber: number; title: string; image: string; timestampMs: number }[];
  timeline?: { timeMs: number; event: string; status: 'ok' | 'fail' | 'healed'; details: string }[];
}

export interface TestExecutionReport {
  id: string;
  jobId: string;
  testName: string;
  specFileName: string;
  status: 'passed' | 'failed' | 'healed';
  targetUrl: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  totalSteps: number;
  passedSteps: number;
  healedSteps: number;
  failedSteps: number;
  steps: ExecutionStepResult[];
  healings: HealingRecord[];
  artifacts: TraceArtifacts;
  outputLogs: string[];
  repairedSpecCode?: string;
  error?: string;
}

export interface GeneratedTestSpec {
  id: string;
  testName: string;
  fileName: string;
  filePath: string;
  relativeFilePath: string;
  code: string;
  createdAt: string;
  updatedAt?: string;
  executionTimeMs: number;
  modelUsed: string;
  status: 'generated' | 'edited' | 'executing' | 'passed' | 'failed' | 'healed';
  testResult?: {
    status: 'passed' | 'failed' | 'running' | 'healed';
    durationMs: number;
    passedSteps: number;
    totalSteps: number;
    outputLogs: string[];
    error?: string;
    timestamp: string;
    healedCount?: number;
    reportId?: string;
  };
}

export interface GeneratorExecutionOptions {
  outputPath?: string;
  timeoutMs?: number;
  agentExecutable?: string;
  onLog?: (log: string, level?: 'info' | 'warn' | 'error') => void;
  executionMode?: 'auto' | 'subprocess' | 'direct_llm';
}

export interface PlannerJob {
  id: string;
  requirement: string;
  targetUrl: string;
  llmConfig: LLMConfig;
  status:
    | 'queued'
    | 'running'
    | 'completed'
    | 'failed'
    | 'approved'
    | 'generating_code'
    | 'code_generated'
    | 'executing_test'
    | 'test_passed'
    | 'test_failed'
    | 'test_healed';
  createdAt: string;
  updatedAt: string;
  logs: LogEntry[];
  plan?: ParsedSpecPlan;
  generatedCode?: GeneratedTestSpec;
  executionReport?: TestExecutionReport;
  error?: string;
}
