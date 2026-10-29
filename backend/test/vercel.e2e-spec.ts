import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

describe('Vercel entrypoint', () => {
  let entry: typeof import('../src/main.js');
  let app: INestApplication;

  beforeAll(async () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('JOBS_ENABLED', 'false');
    vi.stubEnv('DOTENV_CONFIG_PATH', '/dev/null');
    vi.stubEnv('PAYSTACK_SECRET_KEY', 'test-only-signature-secret');
    vi.stubEnv('DATABASE_URL', 'postgresql://unused@127.0.0.1:1/unused');
    entry = await import('../src/main.js');
    const [first, second] = await Promise.all([entry.getApplication(), entry.getApplication()]);
    expect(first).toBe(second);
    app = first;
  });

  afterAll(async () => { await app?.close(); vi.unstubAllEnvs(); });

  it('serves the original API path through the exported function without a standalone listener', async () => {
    expect(app.getHttpServer().listening).toBe(false);
    await request(entry.default).get('/api/v1/health').expect(200);
    await request(entry.default).get('/api/api/v1/health').expect(404);
  });

  it('preserves raw request bytes for signed webhooks', async () => {
    const body = '{ "event": "test.ignored" }';
    const signature = createHmac('sha512', 'test-only-signature-secret').update(body).digest('hex');
    await request(entry.default).post('/api/v1/webhooks/paystack').set('Content-Type', 'application/json')
      .set('x-paystack-signature', signature).send(body).expect(200);
    await request(entry.default).post('/api/v1/webhooks/paystack').set('Content-Type', 'application/json')
      .set('x-paystack-signature', 'invalid').send(body).expect(401);
  });
});
