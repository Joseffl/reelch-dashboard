import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { PgBoss } from 'pg-boss';
import { createServer } from 'node:http';
import { WorkerModule } from './jobs/worker.module.js';
import { WELCOME_QUEUE, CLEANUP_QUEUE, PAYSTACK_QUEUE, EMAIL_QUEUE, PROOF_REVIEW_QUEUE, PAYOUT_SYNC_QUEUE } from './jobs/jobs.service.js';
import { EmailService } from './email/email.service.js';
import { JobHandlersService } from './jobs/job-handlers.service.js';
import { DatabaseService } from './database/database.service.js';
import { positiveInteger } from './common/settings.js';
import { readEnvironment } from './config/environment.js';

process.env.REELCH_WORKER = 'true';
process.env.SERVICE_NAME ??= 'reelch-worker';
readEnvironment(process.env);
if (process.env.JOBS_ENABLED !== 'true') throw new Error('Set JOBS_ENABLED=true before starting a worker');
const app = await NestFactory.createApplicationContext(WorkerModule);
const database = app.get(DatabaseService);
const handlers = app.get(JobHandlersService);
const boss = new PgBoss({ db: { executeSql: database.executeSql }, migrate: false, createSchema: false });
let healthy = false;
boss.on('error', error => console.error(JSON.stringify({ event: 'worker_error', message: error.message })));
await boss.start();
await boss.work<{ userId: string }>(WELCOME_QUEUE, {
  localConcurrency: positiveInteger('WORKER_CONCURRENCY', 4, 32),
  pollingIntervalSeconds: 1,
}, async ([job]) => {
  await handlers.welcome(job.data.userId);
});
await boss.work(CLEANUP_QUEUE, async () => {
  // Bounded deletes avoid long transactions when catching up after an outage.
  await database.executeSql(`DELETE FROM request_rate_limits WHERE key IN
    (SELECT key FROM request_rate_limits WHERE expires_at < now() - interval '1 hour' LIMIT 10000)`);
});
await boss.work<{ reference: string; receiptId: string }>(PAYSTACK_QUEUE, {
  localConcurrency: positiveInteger('PAYMENT_WORKER_CONCURRENCY', 2, 16), pollingIntervalSeconds: 1,
}, async ([job]) => {
  await handlers.paystack(job.data.reference, job.data.receiptId);
});
await boss.work<{ proofId: string }>(PROOF_REVIEW_QUEUE, {
  localConcurrency: positiveInteger('AI_WORKER_CONCURRENCY', 2, 16), pollingIntervalSeconds: 1,
}, async ([job]) => {
  await handlers.proofReview(job.data.proofId);
});
await boss.work<{ withdrawalId: string }>(PAYOUT_SYNC_QUEUE, { pollingIntervalSeconds: 5 }, async ([job]) => {
  await handlers.payoutSync(job.data.withdrawalId);
});
await boss.schedule(CLEANUP_QUEUE, '*/10 * * * *');
if (process.env.EMAIL_ENABLED === 'true') {
  await boss.work<{ deliveryId: string }>(EMAIL_QUEUE, {
    localConcurrency: positiveInteger('EMAIL_WORKER_CONCURRENCY', 1, 8), pollingIntervalSeconds: 1,
  }, async ([job]) => app.get(EmailService).process(job.data.deliveryId));
}
healthy = true;
let sampling = false;
const metrics = setInterval(() => {
  if (sampling) return;
  sampling = true;
  void Promise.all([boss.getQueueStats(WELCOME_QUEUE), boss.getQueueStats(PAYSTACK_QUEUE), ...(process.env.EMAIL_ENABLED === 'true' ? [boss.getQueueStats(EMAIL_QUEUE)] : []), boss.getQueueStats('launch-dead-letter')]).then(stats => {
    console.log(JSON.stringify({ event: 'worker_metrics', pool: database.poolStats(), queue: stats, rssBytes: process.memoryUsage().rss }));
  }).catch(error => console.error(JSON.stringify({ event: 'worker_metrics_error', message: String(error) })))
    .finally(() => { sampling = false; });
}, 30_000);
metrics.unref();
const server = createServer(async (request, response) => {
  if (!['/health', '/ready'].includes(request.url ?? '')) { response.writeHead(404).end(); return; }
  const ready = healthy && (request.url === '/health' || await database.ping());
  response.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ status: ready ? 'ready' : 'unavailable', service: 'reelch-worker' }));
});
// Vercel daemons pull work; HTTP probes remain available for other hosts.
if (process.env.WORKER_HTTP_ENABLED !== 'false') {
  server.listen(positiveInteger('WORKER_PORT', 4001, 65535), '0.0.0.0');
}
console.log(JSON.stringify({ event: 'worker_ready', service: 'reelch-worker', httpEnabled: process.env.WORKER_HTTP_ENABLED !== 'false' }));
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  healthy = false;
  clearInterval(metrics);
  if (server.listening) server.close();
  await boss.stop({ graceful: true, timeout: 30_000 });
  await app.close();
}
process.once('SIGTERM', () => { void stop(); });
process.once('SIGINT', () => { void stop(); });
