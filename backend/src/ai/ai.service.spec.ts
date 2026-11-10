import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiService } from './ai.service.js';

const reply = (status: number) => new Response(JSON.stringify({ ok: status === 200 }), { status });
const post = (service: AiService) => (service as unknown as { post(url: string, headers: object, body: unknown, timeoutMs: number): Promise<unknown> })
  .post('https://ai.test/generate', {}, {}, 1000);

describe('AI request retries', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('retries a temporary provider error', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(503)).mockResolvedValueOnce(reply(200));
    vi.stubGlobal('fetch', fetchMock);
    const result = post(new AiService());
    await vi.runAllTimersAsync();
    await expect(result).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after three attempts', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(async () => reply(503));
    vi.stubGlobal('fetch', fetchMock);
    const result = post(new AiService()).catch((error: Error) => error.message);
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe('The AI service rejected the request (503)');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry a rejected request', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => reply(400));
    vi.stubGlobal('fetch', fetchMock);
    await expect(post(new AiService())).rejects.toThrow('(400)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
