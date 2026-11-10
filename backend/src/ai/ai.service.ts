import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

// Provider, model and key come from the environment so the model can be
// swapped without code changes:
//   AI_PROVIDER=gemini             (default) Google Gemini generateContent API
//   AI_PROVIDER=openai-compatible  any /chat/completions API (OpenAI, OpenRouter, Groq, ...) at AI_BASE_URL
export type AiPart = { type: 'text'; text: string } | { type: 'file'; mimeType: string; data: Buffer };
export type AiJsonRequest = { system: string; parts: AiPart[]; schemaName: string; schema: Record<string, unknown> };
export type AiJsonResponse<T> = { data: T; provider: string; model: string; latencyMs: number };

const defaults: Record<string, { model: string; baseUrl: string }> = {
  // gemini-2.5-flash-lite is closed to new API keys; Google points to 3.5 Flash-Lite.
  gemini: { model: 'gemini-3.5-flash-lite', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  'openai-compatible': { model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' },
};

export class AiOutputError extends Error {}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  get config() {
    const provider = (process.env.AI_PROVIDER?.trim().toLowerCase() || 'gemini');
    const fallback = defaults[provider];
    if (!fallback) throw new ServiceUnavailableException(`Unsupported AI_PROVIDER "${provider}"`);
    return {
      provider,
      model: process.env.AI_MODEL?.trim() || fallback.model,
      baseUrl: (process.env.AI_BASE_URL?.trim() || fallback.baseUrl).replace(/\/$/, ''),
      apiKey: process.env.AI_API_KEY?.trim() ?? '',
      timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 30_000),
    };
  }

  get configured() {
    try { return Boolean(this.config.apiKey); } catch { return false; }
  }

  async generateJson<T>(request: AiJsonRequest): Promise<AiJsonResponse<T>> {
    const config = this.config;
    if (!config.apiKey) throw new ServiceUnavailableException('AI_API_KEY is not configured');
    const started = Date.now();
    const text = config.provider === 'gemini' ? await this.gemini(config, request) : await this.openAiCompatible(config, request);
    let data: T;
    try { data = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')) as T; } catch { throw new AiOutputError('The AI model returned malformed JSON'); }
    return { data, provider: config.provider, model: config.model, latencyMs: Date.now() - started };
  }

  private async gemini(config: AiService['config'], request: AiJsonRequest) {
    const parts = request.parts.map(part => part.type === 'text' ? { text: part.text } : { inlineData: { mimeType: part.mimeType, data: part.data.toString('base64') } });
    const payload = await this.post<{ candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>; promptFeedback?: { blockReason?: string } }>(
      `${config.baseUrl}/models/${encodeURIComponent(config.model)}:generateContent`,
      { 'x-goog-api-key': config.apiKey },
      {
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', responseJsonSchema: request.schema },
      },
      config.timeoutMs,
    );
    if (payload.promptFeedback?.blockReason) throw new AiOutputError(`The AI model blocked the request (${payload.promptFeedback.blockReason})`);
    const candidate = payload.candidates?.[0];
    const text = candidate?.content?.parts?.map(part => part.text ?? '').join('') ?? '';
    if (!text) throw new AiOutputError(`The AI model returned no content (${candidate?.finishReason ?? 'unknown reason'})`);
    return text;
  }

  private async openAiCompatible(config: AiService['config'], request: AiJsonRequest) {
    const content = request.parts.map(part => part.type === 'text'
      ? { type: 'text', text: part.text }
      : { type: 'image_url', image_url: { url: `data:${part.mimeType};base64,${part.data.toString('base64')}` } });
    const payload = await this.post<{ choices?: Array<{ finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }> }>(
      `${config.baseUrl}/chat/completions`,
      { Authorization: `Bearer ${config.apiKey}` },
      {
        model: config.model,
        temperature: 0,
        messages: [{ role: 'system', content: request.system }, { role: 'user', content }],
        response_format: { type: 'json_schema', json_schema: { name: request.schemaName, schema: request.schema } },
      },
      config.timeoutMs,
    );
    const message = payload.choices?.[0]?.message;
    if (message?.refusal) throw new AiOutputError(`The AI model declined the request: ${message.refusal}`);
    if (!message?.content) throw new AiOutputError(`The AI model returned no content (${payload.choices?.[0]?.finish_reason ?? 'unknown reason'})`);
    return message.content;
  }

  private async post<T>(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<T> {
    // Providers return these briefly under load, so they get a short retry before a proof falls back to a person.
    const retryDelaysMs = [1_000, 3_000];
    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await fetch(url, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
      } catch (cause) {
        this.logger.error(`AI request failed for ${new URL(url).host}`, cause instanceof Error ? cause.stack : undefined);
        throw new ServiceUnavailableException('The AI service is temporarily unavailable');
      }
      const payload = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
      if (response.ok) return payload;
      this.logger.warn(`AI provider rejected the request with status ${response.status}: ${payload.error?.message ?? 'No message'}`);
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt >= retryDelaysMs.length) {
        throw new ServiceUnavailableException(`The AI service rejected the request (${response.status})`);
      }
      await new Promise(resolve => setTimeout(resolve, retryDelaysMs[attempt]));
    }
  }
}
