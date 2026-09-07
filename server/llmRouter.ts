import { GoogleGenAI } from '@google/genai';
import { LLMConfig } from './types';

export interface NormalizedLLMInfo {
  origin: string;
  openAiBase: string;
  openAiChatUrl: string;
  openAiModelsUrl: string;
  ollamaChatUrl: string;
  ollamaTagsUrl: string;
  isOllama: boolean;
  isLocalhost: boolean;
}

/**
 * Normalizes any user-entered Ollama or OpenAI URL into standard endpoints.
 * Handles inputs like:
 *  - "http://localhost:11434/api/tags" -> strips /api/tags
 *  - "http://localhost:11434/api"
 *  - "http://localhost:11434/v1"
 *  - "localhost:11434"
 *  - "https://my-tunnel.ngrok-free.app/v1"
 */
export function normalizeLLMUrl(rawUrl: string, provider?: string): NormalizedLLMInfo {
  let clean = (rawUrl || '').trim();

  // Prepend protocol if omitted
  if (clean && !clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `http://${clean}`;
  }

  // Strip trailing slashes
  clean = clean.replace(/\/+$/, '');

  // Strip specific endpoint suffixes to find the origin/base
  clean = clean
    .replace(/\/api\/tags\/?$/i, '')
    .replace(/\/api\/chat\/?$/i, '')
    .replace(/\/api\/generate\/?$/i, '')
    .replace(/\/api\/?$/i, '')
    .replace(/\/v1\/chat\/completions\/?$/i, '')
    .replace(/\/v1\/models\/?$/i, '')
    .replace(/\/v1\/?$/i, '')
    .replace(/\/+$/, '');

  if (!clean) {
    clean = 'http://localhost:11434';
  }

  const isOllama =
    provider === 'ollama' ||
    clean.includes('11434') ||
    (rawUrl || '').toLowerCase().includes('tags') ||
    (rawUrl || '').toLowerCase().includes('ollama');

  const isLocalhost =
    clean.includes('localhost') ||
    clean.includes('127.0.0.1') ||
    clean.includes('0.0.0.0');

  return {
    origin: clean,
    openAiBase: `${clean}/v1`,
    openAiChatUrl: `${clean}/v1/chat/completions`,
    openAiModelsUrl: `${clean}/v1/models`,
    ollamaChatUrl: `${clean}/api/chat`,
    ollamaTagsUrl: `${clean}/api/tags`,
    isOllama,
    isLocalhost,
  };
}

/**
 * Query available models from Ollama (/api/tags) and/or OpenAI (/v1/models)
 */
export async function fetchAvailableModels(config: LLMConfig): Promise<{
  success: boolean;
  latencyMs: number;
  message: string;
  models?: string[];
  source?: string;
  isLocalhostCloudMismatch?: boolean;
}> {
  const start = Date.now();

  // 1. Google Gemini
  if (config.provider === 'gemini' || config.model.toLowerCase().includes('gemini')) {
    try {
      const apiKey = config.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return {
          success: false,
          latencyMs: 0,
          message: 'Missing GEMINI_API_KEY. Configure in environment or settings.',
        };
      }
      const ai = new GoogleGenAI({ apiKey });
      await ai.models.generateContent({
        model: config.model || 'gemini-3.8-flash',
        contents: 'Ping',
      });
      return {
        success: true,
        latencyMs: Date.now() - start,
        message: 'Successfully reached Google Gemini API.',
        models: ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-pro'],
        source: 'gemini',
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        message: `Gemini connection failed: ${err.message}`,
      };
    }
  }

  // 2. Ollama / OpenAI-compatible endpoint
  const norm = normalizeLLMUrl(config.baseUrl, config.provider);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  // If Ollama, prioritize /api/tags
  if (norm.isOllama) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(norm.ollamaTagsUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as any;
        const modelsList: string[] = [];
        if (Array.isArray(data.models)) {
          for (const m of data.models) {
            const name = m.name || m.model;
            if (name && !modelsList.includes(name)) {
              modelsList.push(name);
            }
          }
        }
        const latencyMs = Date.now() - start;
        return {
          success: true,
          latencyMs,
          message: `Connected to Ollama native router (${latencyMs}ms). Found ${modelsList.length} models.`,
          models: modelsList,
          source: 'ollama_tags',
        };
      }
    } catch (err: any) {
      // Continue to try /v1/models fallback below
    }
  }

  // Try /v1/models
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(norm.openAiModelsUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - start;
    if (res.ok) {
      const data = (await res.json()) as any;
      const modelList: string[] = [];
      if (Array.isArray(data.data)) {
        modelList.push(...data.data.map((m: any) => m.id || m.name));
      } else if (Array.isArray(data.models)) {
        modelList.push(...data.models.map((m: any) => m.name || m.id));
      }

      return {
        success: true,
        latencyMs,
        message: `Connected successfully (${latencyMs}ms). Found ${modelList.length} models.`,
        models: modelList.slice(0, 20),
        source: 'openai_models',
      };
    } else {
      return {
        success: false,
        latencyMs,
        message: `HTTP ${res.status}: ${res.statusText} from ${norm.openAiModelsUrl}`,
      };
    }
  } catch (err: any) {
    const latencyMs = Date.now() - start;

    // Detect if this is localhost being called from a Cloud container
    if (norm.isLocalhost) {
      return {
        success: false,
        latencyMs,
        isLocalhostCloudMismatch: true,
        message:
          `Unable to reach "${norm.origin}" from Cloud Run container. ` +
          `Localhost in the cloud container is isolated from your Windows host. ` +
          `Use ngrok (e.g. "ngrok http 11434") or browser-direct dispatch.`,
      };
    }

    return {
      success: false,
      latencyMs,
      message: `Connection error: ${err.message || 'Host unreachable'}`,
    };
  }
}

/**
 * Dispatches an LLM chat completion request with auto-retry and multi-endpoint fallback.
 * Attempts:
 *  1. /v1/chat/completions (OpenAI standard)
 *  2. /api/chat (Ollama native format)
 *  3. Model tag resolution (e.g. "llama3.3" <-> "llama3.3:latest", "qwen2.5-coder" <-> "qwen2.5-coder:32b")
 */
export async function executeLLMChatCompletion(options: {
  config: LLMConfig;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
  log?: (msg: string, level?: 'info' | 'warn' | 'error') => void;
}): Promise<{
  text: string;
  modelUsed: string;
  tokensUsed?: { promptTokens: number; completionTokens: number; totalTokens: number };
}> {
  const { config, systemPrompt, userPrompt, temperature = 0.2, jsonMode = false, timeoutMs = 70000, log = () => {} } = options;

  // 1. Google Gemini native path
  const isGemini =
    config.provider === 'gemini' ||
    config.model.toLowerCase().includes('gemini') ||
    (config.baseUrl || '').includes('generativelanguage.googleapis.com');

  if (isGemini) {
    const apiKey = config.apiKey || process.env.GEMINI_API_KEY;
    if (apiKey) {
      log(`Routing query to Google Gemini model: ${config.model || 'gemini-3.8-flash'}`);
      const ai = new GoogleGenAI({ apiKey });
      const promptContent = `${systemPrompt}\n\n${userPrompt}`;
      try {
        const res = await ai.models.generateContent({
          model: config.model || 'gemini-3.8-flash',
          contents: promptContent,
          config: {
            temperature,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
          },
        });
        return {
          text: res.text || '',
          modelUsed: config.model || 'gemini-3.8-flash',
          tokensUsed: {
            promptTokens: res.usageMetadata?.promptTokenCount || 0,
            completionTokens: res.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: res.usageMetadata?.totalTokenCount || 0,
          },
        };
      } catch (geminiErr: any) {
        log(`Gemini primary call encountered spike (${geminiErr.message}). Retrying with gemini-3.1-flash-lite...`, 'warn');
        const fallbackRes = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: promptContent,
          config: {
            temperature,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
          },
        });
        return {
          text: fallbackRes.text || '',
          modelUsed: 'gemini-3.1-flash-lite',
        };
      }
    }
  }

  // 2. Ollama / OpenAI endpoint
  const norm = normalizeLLMUrl(config.baseUrl, config.provider);
  let targetModel = config.model || 'llama3.3:latest';

  log(`[LLM Router] Dispatching to endpoint: ${norm.openAiChatUrl} (${targetModel})`);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  // Prepare standard OpenAI payload
  const openAiPayload: any = {
    model: targetModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
  };
  if (jsonMode) {
    openAiPayload.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Attempt A: /v1/chat/completions
    const res = await fetch(norm.openAiChatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(openAiPayload),
      signal: controller.signal,
    });

    if (res.ok) {
      clearTimeout(timer);
      const data = (await res.json()) as any;
      const content = data.choices?.[0]?.message?.content || '';
      return {
        text: content,
        modelUsed: targetModel,
        tokensUsed: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens || 0,
              completionTokens: data.usage.completion_tokens || 0,
              totalTokens: data.usage.total_tokens || 0,
            }
          : undefined,
      };
    }

    const errStatus = res.status;
    const errText = await res.text().catch(() => '');

    // Check if model not found and retry with :latest alias
    if (errText.includes('not found') && !targetModel.includes(':')) {
      const aliasModel = `${targetModel}:latest`;
      log(`Model "${targetModel}" not found on Ollama. Retrying with alias "${aliasModel}"...`, 'warn');
      const retryRes = await fetch(norm.openAiChatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...openAiPayload, model: aliasModel }),
      });
      if (retryRes.ok) {
        clearTimeout(timer);
        const retryData = (await retryRes.json()) as any;
        return {
          text: retryData.choices?.[0]?.message?.content || '',
          modelUsed: aliasModel,
        };
      }
    }

    // Attempt B: Ollama native /api/chat endpoint fallback
    if (norm.isOllama || errStatus === 404 || errStatus === 405) {
      log(`Retrying via Ollama native endpoint: ${norm.ollamaChatUrl}...`, 'info');
      const ollamaPayload = {
        model: targetModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        options: {
          temperature,
        },
        ...(jsonMode ? { format: 'json' } : {}),
      };

      const nativeRes = await fetch(norm.ollamaChatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(ollamaPayload),
      });

      if (nativeRes.ok) {
        clearTimeout(timer);
        const nativeData = (await nativeRes.json()) as any;
        return {
          text: nativeData.message?.content || '',
          modelUsed: targetModel,
          tokensUsed: nativeData.prompt_eval_count
            ? {
                promptTokens: nativeData.prompt_eval_count || 0,
                completionTokens: nativeData.eval_count || 0,
                totalTokens: (nativeData.prompt_eval_count || 0) + (nativeData.eval_count || 0),
              }
            : undefined,
        };
      }
    }

    throw new Error(`LLM endpoint returned HTTP ${errStatus}: ${errText}`);
  } catch (err: any) {
    clearTimeout(timer);

    if (norm.isLocalhost) {
      log(
        `[LLM Router Warning] Failed to reach local Ollama (${norm.origin}) from Cloud container: ${err.message}. ` +
          `Localhost inside Cloud Run does not connect directly to host OS without a tunnel.`,
        'warn'
      );
    }

    throw err;
  }
}
