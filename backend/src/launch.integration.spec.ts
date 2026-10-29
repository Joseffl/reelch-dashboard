import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import request from 'supertest';
import { createHmac, randomUUID } from 'node:crypto';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { DatabaseService } from './database/database.service.js';
import { RateLimitGuard } from './common/rate-limit.guard.js';
import { JobsService, WELCOME_QUEUE, CLEANUP_QUEUE, PAYSTACK_QUEUE, EMAIL_QUEUE } from './jobs/jobs.service.js';
import { EmailService } from './email/email.service.js';
import { JobHandlersService } from './jobs/job-handlers.service.js';
import { PlatformService } from './platform/platform.service.js';
import { PaystackService } from './platform/paystack.service.js';

// Explicit opt-in only. Never loads backend/.env or connects to the hosted DB.
const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl && !['127.0.0.1', 'localhost'].includes(new URL(testUrl).hostname)) {
  throw new Error('Launch integration tests require an isolated localhost database');
}

describe.skipIf(!testUrl)('launch integration (isolated PostgreSQL)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let consumer: PgBoss;
  let jobs: JobsService;
  let handlers: JobHandlersService;
  const run = randomUUID();

  beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', testUrl!);
    vi.stubEnv('JOBS_ENABLED', 'true');
    vi.stubEnv('EMAIL_ENABLED', 'false');
    vi.stubEnv('JWT_SECRET', 'isolated-test-secret-with-at-least-32-characters');
    vi.stubEnv('PAYSTACK_SECRET_KEY', 'isolated-paystack-secret');
    vi.stubEnv('RATE_LIMIT_REGISTER_ACCOUNT_MAX', '100');
    app = await NestFactory.create(AppModule, { logger: false, rawBody: true });
    configureApp(app, { frontendUrl: 'http://localhost:3000', nodeEnv: 'test' });
    await app.init();
    database = app.get(DatabaseService);
    jobs = app.get(JobsService);
    handlers = new JobHandlersService(database, app.get(PlatformService));
    consumer = new PgBoss({ connectionString: testUrl, max: 2, supervise: false, schedule: false });
    consumer.on('error', () => undefined);
    await consumer.start();
    await consumer.createQueue('launch-dead-letter');
    await consumer.createQueue(WELCOME_QUEUE, { retryLimit: 5, deadLetter: 'launch-dead-letter' });
    await consumer.createQueue(CLEANUP_QUEUE);
    await consumer.createQueue(PAYSTACK_QUEUE, { retryLimit: 8, deadLetter: 'launch-dead-letter' });
    await consumer.createQueue(EMAIL_QUEUE, { retryLimit: 8, deadLetter: 'launch-dead-letter' });
  });

  afterAll(async () => {
    await consumer?.stop();
    await app?.close();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('allows exactly one concurrent signup for an email, then supports login', async () => {
    const email = `race-${run}@example.test`;
    const body = { email, password: 'Strong-test-password42', displayName: 'Launch test', role: 'business' };
    const responses = await Promise.all(Array.from({ length: 6 }, () => request(app.getHttpServer()).post('/api/v1/auth/register').send(body)));
    expect(responses.map(response => response.status).sort()).toEqual([201, 409, 409, 409, 409, 409]);
    const result = await database.executeSql('SELECT count(*)::int AS count FROM users WHERE email=$1', [email]);
    expect(result.rows[0].count).toBe(1);
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password: body.password });
    expect(login.status).toBe(201);
    expect(login.body.accessToken).toBeTypeOf('string');
    const userId = login.body.user.id;
    const queued = await database.executeSql('SELECT id FROM pgboss.job WHERE name=$1 AND data->>\'userId\'=$2', [WELCOME_QUEUE, userId]);
    expect(queued.rows).toHaveLength(1);
    expect((await request(app.getHttpServer()).get('/api/v1/ready')).status).toBe(200);
  }, 20_000);

  it('rolls back a job with the account transaction', async () => {
    await jobs.ready();
    const id = randomUUID();
    await expect(database.transaction(async (_tx, client) => {
      await client.query('INSERT INTO users (id,email,password_hash,display_name) VALUES ($1,$2,$3,$4)', [id, `${id}@example.test`, 'test-only', 'Rollback test']);
      await jobs.enqueueWelcome(id, client);
      throw new Error('rollback');
    })).rejects.toThrow('rollback');
    expect((await database.executeSql('SELECT id FROM users WHERE id=$1', [id])).rows).toHaveLength(0);
    expect((await database.executeSql('SELECT id FROM pgboss.job WHERE data->>\'userId\'=$1', [id])).rows).toHaveLength(0);
  });

  it('shares atomic rate limits across independent API guards and ignores spoofed forwarding headers', async () => {
    vi.stubEnv('RATE_LIMIT_CONTACT_IP_MAX', '2');
    const otherDatabase = new DatabaseService();
    const guards = [new RateLimitGuard(database), new RateLimitGuard(otherDatabase)];
    const headers: Record<string, string> = {};
    const fakeContext = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST', path: '/api/v1/contact', ip: `integration-${run}`, headers: { 'x-forwarded-for': randomUUID() }, body: {}, socket: {} }),
        getResponse: () => ({ setHeader: (key: string, value: string) => { headers[key] = value; } }),
      }),
    } as unknown as ExecutionContext;
    try {
      const results = await Promise.allSettled(Array.from({ length: 10 }, (_, index) => guards[index % 2].canActivate(fakeContext)));
      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(2);
      expect(results.filter(result => result.status === 'rejected')).toHaveLength(8);
      expect(Number(headers['Retry-After'])).toBeGreaterThan(0);
      await database.executeSql('UPDATE request_rate_limits SET expires_at=now()-interval \'1 second\' WHERE key IN (SELECT key FROM request_rate_limits WHERE hits=10)');
      expect(await guards[0].canActivate(fakeContext)).toBe(true);
    } finally { await otherDatabase.onModuleDestroy(); }
  });

  it('enforces limits through HTTP despite changing forwarding headers and route casing', async () => {
    const responses = [];
    for (let index = 0; index < 3; index += 1) {
      responses.push(await request(app.getHttpServer()).post(index === 2 ? '/API/V1/CONTACT/' : '/api/v1/contact')
        .set('X-Forwarded-For', `192.0.2.${index + 1}`).send({}));
    }
    expect(responses.map(response => response.status)).toEqual([400, 400, 429]);
    expect(responses[2].headers['retry-after']).toBeDefined();
  });

  it('durably deduplicates signed payment webhooks and credits a deposit once under concurrent delivery', async () => {
    const reference = `payment-${run}`;
    const payload = JSON.stringify({ event: 'charge.success', data: { reference } });
    const signature = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!).update(payload).digest('hex');
    const invalid = await request(app.getHttpServer()).post('/api/v1/webhooks/paystack').set('Content-Type', 'application/json').set('x-paystack-signature', 'invalid').send(payload);
    expect(invalid.status).toBe(401);
    const responses = await Promise.all(Array.from({ length: 6 }, () => request(app.getHttpServer()).post('/api/v1/webhooks/paystack')
      .set('Content-Type', 'application/json').set('x-paystack-signature', signature).send(payload)));
    expect(responses.every(response => response.status === 200)).toBe(true);
    const receipts = await database.executeSql("SELECT id FROM inbound_webhook_events WHERE provider='paystack' AND external_id=$1", [reference]);
    expect(receipts.rows).toHaveLength(1);
    const queued = await database.executeSql("SELECT id FROM pgboss.job WHERE name=$1 AND data->>'reference'=$2", [PAYSTACK_QUEUE, reference]);
    expect(queued.rows).toHaveLength(1);
    const business = await database.executeSql('SELECT id, owner_user_id FROM businesses WHERE owner_user_id IN (SELECT id FROM users WHERE email=$1)', [`race-${run}@example.test`]);
    const customerCode = `customer-${run}`;
    await database.executeSql(`INSERT INTO virtual_accounts (business_id, provider_customer_code, provider_account_id, account_name, account_number, bank_name, bank_slug)
      VALUES ($1,$2,$3,'Test account',$4,'Test bank','test-bank')`, [business.rows[0].id, customerCode, run, run]);
    const verify = vi.spyOn(app.get(PaystackService), 'verify').mockResolvedValue({ reference, status: 'success', amount: 10000, currency: 'NGN', customer: { customer_code: customerCode } });
    try {
      await Promise.all(Array.from({ length: 6 }, () => handlers.paystack(reference, receipts.rows[0].id)));
    } finally { verify.mockRestore(); }
    expect((await database.executeSql('SELECT id FROM ledger_transactions WHERE idempotency_key=$1', [`paystack-wallet:${reference}`])).rows).toHaveLength(1);
    expect((await database.executeSql("SELECT id FROM notifications WHERE type='wallet_funded' AND data->>'reference'=$1", [reference])).rows).toHaveLength(1);
    expect((await database.executeSql('SELECT status, attempts FROM inbound_webhook_events WHERE id=$1', [receipts.rows[0].id])).rows[0]).toEqual({ status: 'processed', attempts: 6 });
    await consumer.cancel(PAYSTACK_QUEUE, queued.rows[0].id);
  });

  it('queues waitlist/account emails atomically and retries Resend without duplicate sends', async () => {
    vi.stubEnv('EMAIL_ENABLED', 'true'); vi.stubEnv('RESEND_API_KEY', 'mock-resend-key');
    vi.stubEnv('EMAIL_FROM', 'Reelch <hello@example.test>');
    const body = { fullName: 'Waitlist User', email: `waitlist-${run}@example.test`, phone: '+2348000000000', country: 'NG', primaryPlatform: 'instagram', platforms: ['Instagram', 'Other'], otherPlatform: 'Bluesky', profiles: [{ platform: 'Instagram', profileUrl: 'instagram.com/test' }, { platform: 'Other', profileUrl: 'bsky.app/profile/test' }], audienceSize: 100, niches: [] };
    const responses = await Promise.all([1, 2].map(() => request(app.getHttpServer()).post('/api/v1/waitlist/promoters').send(body)));
    expect(responses.map(response => response.status)).toEqual([201, 201]);
    const savedWaitlist = await database.executeSql('SELECT platforms, profiles, niches, profile_url FROM promoter_waitlist WHERE id=$1', [responses[0].body.entry.id]);
    expect(savedWaitlist.rows[0]).toMatchObject({ platforms: ['Instagram', 'Bluesky'], profiles: [{platform:'Instagram',profileUrl:'https://instagram.com/test'}, {platform:'Bluesky',profileUrl:'https://bsky.app/profile/test'}], niches: [], profile_url: 'https://instagram.com/test' });
    const key = `waitlist-confirmation/${responses[0].body.entry.id}`;
    const deliveries = await database.executeSql('SELECT id FROM email_deliveries WHERE delivery_key=$1', [key]);
    expect(deliveries.rows).toHaveLength(1);
    const deliveryId = deliveries.rows[0].id;
    expect((await database.executeSql("SELECT id FROM pgboss.job WHERE name=$1 AND data->>'deliveryId'=$2", [EMAIL_QUEUE, deliveryId])).rows).toHaveLength(1);
    const signup = await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: `email-account-${run}@example.test`, password: 'Test-password42!', displayName: 'Email User', role: 'business' });
    expect(signup.status).toBe(201);
    expect((await database.executeSql('SELECT id FROM email_deliveries WHERE delivery_key=$1', [`account-welcome/${signup.body.user.id}`])).rows).toHaveLength(1);
    const send = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('{}', { status: 503 })).mockImplementation(async () => new Response(JSON.stringify({ id: 'resend-test-id' }), { status: 200 }));
    vi.stubGlobal('fetch', send);
    const service = new EmailService(database);
    try {
      await expect(service.process(deliveryId)).rejects.toThrow('HTTP 503');
      await Promise.all([service.process(deliveryId), service.process(deliveryId)]);
      expect(send).toHaveBeenCalledTimes(2);
      expect(new Headers(send.mock.calls[0][1]?.headers).get('Idempotency-Key')).toBe(new Headers(send.mock.calls[1][1]?.headers).get('Idempotency-Key'));
      expect(send.mock.calls[0][1]?.body).toBe(send.mock.calls[1][1]?.body);
      expect((await database.executeSql('SELECT provider_message_id FROM email_deliveries WHERE id=$1', [deliveryId])).rows[0].provider_message_id).toBe('resend-test-id');
      await database.executeSql("UPDATE email_deliveries SET accepted_at=NULL, first_attempt_at=now()-interval '24 hours' WHERE id=$1", [deliveryId]);
      await expect(service.process(deliveryId)).rejects.toThrow('retry window expired');
      expect(send).toHaveBeenCalledTimes(2);
    } finally { vi.unstubAllGlobals(); vi.stubEnv('EMAIL_ENABLED', 'false'); }
  });

  it('recovers from worker failure and delivers retries once', async () => {
    const userId = randomUUID();
    await database.executeSql('INSERT INTO users (id,email,password_hash,display_name) VALUES ($1,$2,$3,$4)', [userId, `${userId}@example.test`, 'test-only', 'Worker test']);
    const id = await consumer.send(WELCOME_QUEUE, { userId }, { retryLimit: 2, retryDelay: 1 });
    let attempts = 0;
    await consumer.work<{ userId: string }>(WELCOME_QUEUE, { pollingIntervalSeconds: 0.5 }, async ([job]) => {
      await handlers.welcome(job.data.userId);
      if (job.id === id && attempts++ === 0) throw new Error('simulated crash after delivery');
    });
    await expect.poll(async () => {
      const rows = await database.executeSql('SELECT state FROM pgboss.job WHERE id=$1', [id]);
      return rows.rows[0]?.state;
    }, { timeout: 15_000 }).toBe('completed');
    expect(attempts).toBe(2);
    expect((await database.executeSql("SELECT id FROM notifications WHERE user_id=$1 AND type='welcome'", [userId])).rows).toHaveLength(1);
  }, 20_000);
});
