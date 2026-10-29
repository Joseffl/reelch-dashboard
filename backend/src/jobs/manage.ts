import 'dotenv/config';
import { PgBoss } from 'pg-boss';
import { CLEANUP_QUEUE, PAYSTACK_QUEUE, WELCOME_QUEUE, EMAIL_QUEUE } from './jobs.service.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const boss = new PgBoss({ connectionString: process.env.DATABASE_URL, max: 2, migrate: false, createSchema: false, supervise: false, schedule: false });
boss.on('error', error => console.error(error.message));
const command = process.argv[2] ?? 'status';
try {
  await boss.start();
  if (command === 'status') {
    for (const queue of [WELCOME_QUEUE, PAYSTACK_QUEUE, EMAIL_QUEUE, CLEANUP_QUEUE, 'launch-dead-letter']) {
      console.log(JSON.stringify({ queue, stats: await boss.getQueueStats(queue) }));
    }
  } else if (command === 'redrive') {
    const id = process.argv[3];
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Usage: jobs:manage redrive <dead-letter-job-uuid>');
    // Redrive one reviewed job at a time; preserve the original payload/source.
    console.log(JSON.stringify({ redriven: await boss.redrive('launch-dead-letter', { ids: [id], limit: 1 }) }));
  } else {
    throw new Error('Supported commands: status, redrive <dead-letter-job-uuid>');
  }
} finally { await boss.stop(); }
