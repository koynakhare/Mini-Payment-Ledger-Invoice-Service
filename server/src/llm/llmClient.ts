export type JsonSchema = Record<string, unknown>;

export interface LlmGenerateOptions {
  prompt: string;
  responseSchema?: JsonSchema;
  /** Optional multimodal parts (Tier 3). Text-only callers can omit. */
  inlineData?: Array<{ mimeType: string; dataBase64: string }>;
  temperature?: number;
  timeoutMs?: number;
}

export interface LlmClient {
  generate(options: LlmGenerateOptions): Promise<unknown>;
}

export class LlmClientError extends Error {
  readonly code: 'TIMEOUT' | 'RATE_LIMIT' | 'API_ERROR' | 'PARSE_ERROR' | 'NOT_CONFIGURED';

  constructor(
    code: LlmClientError['code'],
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'LlmClientError';
    this.code = code;
  }
}

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_TIMEOUT_MS = 20_000;

function summarizeGeminiError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string; status?: string };
    };
    return parsed.error?.message?.trim() || '';
  } catch {
    return raw.trim().slice(0, 180);
  }
}

function getApiKey(): string {
  return process.env.GEMINI_API_KEY?.trim() ?? '';
}

function getModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

async function callGeminiApi(options: LlmGenerateOptions): Promise<unknown> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new LlmClientError(
      'NOT_CONFIGURED',
      'GEMINI_API_KEY is not configured. AI review is unavailable.'
    );
  }

  // Gemini docs: put media parts before the text instruction for document/PDF inputs.
  const parts: Array<Record<string, unknown>> = [];
  for (const item of options.inlineData ?? []) {
    const data = item.dataBase64.replace(/\s/g, '').replace(/^data:[^;]+;base64,/, '');
    parts.push({
      inline_data: {
        mime_type: item.mimeType,
        data,
      },
    });
  }
  parts.push({ text: options.prompt });

  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? 0.2,
  };
  if (options.responseSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = options.responseSchema;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${getModel()}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig,
      }),
      signal: controller.signal,
    });

    if (response.status === 429) {
      throw new LlmClientError('RATE_LIMIT', 'Gemini API rate limit exceeded.');
    }

    if (!response.ok) {
      let detail = '';
      try {
        detail = await response.text();
      } catch {
        detail = '';
      }
      const shortDetail = summarizeGeminiError(detail);
      console.error('Gemini API error:', response.status, detail.slice(0, 800));
      throw new LlmClientError(
        'API_ERROR',
        shortDetail
          ? `Gemini API request failed (${response.status}): ${shortDetail}`
          : `Gemini API request failed (${response.status}).`,
        detail.slice(0, 500)
      );
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();

    if (!text) {
      throw new LlmClientError('PARSE_ERROR', 'Gemini returned an empty response.');
    }

    if (options.responseSchema) {
      try {
        return JSON.parse(text) as unknown;
      } catch (error) {
        throw new LlmClientError('PARSE_ERROR', 'Gemini returned invalid JSON.', error);
      }
    }

    return text;
  } catch (error) {
    if (error instanceof LlmClientError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LlmClientError('TIMEOUT', 'Gemini API request timed out.');
    }
    throw new LlmClientError(
      'API_ERROR',
      'Gemini API request failed.',
      error instanceof Error ? error.message : error
    );
  } finally {
    clearTimeout(timer);
  }
}

const defaultClient: LlmClient = {
  generate: callGeminiApi,
};

let activeClient: LlmClient = defaultClient;

/** Returns the shared LLM client (overridable in tests). */
export function getLlmClient(): LlmClient {
  return activeClient;
}

/** Swap the LLM client for tests or alternate providers. */
export function setLlmClient(client: LlmClient): void {
  activeClient = client;
}

/** Restore the default Gemini-backed client. */
export function resetLlmClient(): void {
  activeClient = defaultClient;
}

/** Convenience wrapper used by services. */
export async function llmGenerate(options: LlmGenerateOptions): Promise<unknown> {
  return getLlmClient().generate(options);
}
