import 'dotenv/config';
import { PgBoss } from 'pg-boss';
import { WELCOME_QUEUE, CLEANUP_QUEUE, PAYSTACK_QUEUE, EMAIL_QUEUE } from './jobs.service.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const boss = new PgBoss({ connectionString: process.env.DATABASE_URL, max: 2, supervise: false, schedule: false });
boss.on('error', error => console.error(error.message));
try {
  await boss.start();
  await boss.createQueue('launch-dead-letter');
  await boss.createQueue(WELCOME_QUEUE, { retryLimit: 5, retryDelay: 5, retryBackoff: true, deadLetter: 'launch-dead-letter', retentionSeconds: 7 * 86400 });
  await boss.updateQueue(WELCOME_QUEUE, { retryLimit: 5, retryDelay: 5, retryBackoff: true, deadLetter: 'launch-dead-letter', retentionSeconds: 7 * 86400 });
  await boss.createQueue(CLEANUP_QUEUE);
  const emailOptions = { retryLimit: 8, retryDelay: 30, retryBackoff: true, deadLetter: 'launch-dead-letter', retentionSeconds: 7 * 86400 };
  await boss.createQueue(EMAIL_QUEUE, emailOptions);
  await boss.updateQueue(EMAIL_QUEUE, emailOptions);
  await boss.createQueue(PAYSTACK_QUEUE, { retryLimit: 8, retryDelay: 10, retryBackoff: true, deadLetter: 'launch-dead-letter', retentionSeconds: 7 * 86400 });
  await boss.updateQueue(PAYSTACK_QUEUE, { retryLimit: 8, retryDelay: 10, retryBackoff: true, deadLetter: 'launch-dead-letter', retentionSeconds: 7 * 86400 });
} finally { await boss.stop(); }
