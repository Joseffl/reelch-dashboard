import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';

const databaseUrl = process.env.TEST_DATABASE_URL;
const baseUrl = process.env.LOCAL_BASE_URL ?? 'http://localhost:3100';
const local = value => ['localhost', '127.0.0.1'].includes(new URL(value).hostname);
if (!databaseUrl || !local(databaseUrl) || !local(baseUrl)) {
  throw new Error('Use an isolated localhost TEST_DATABASE_URL and LOCAL_BASE_URL');
}
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const boss = new PgBoss({ connectionString: databaseUrl, max: 2, migrate: false, createSchema: false, supervise: false, schedule: false });
boss.on('error', error => console.error(error.message));
const run = randomUUID();
const latencies = [];

async function eventually(operation) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await operation()) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Worker delivery did not complete within 15 seconds');
}

try {
  assert.equal((await fetch(`${baseUrl}/api/v1/ready`)).status, 200);
  const accounts = await Promise.all(Array.from({ length: 8 }, async (_, index) => {
    const start = performance.now();
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `stack-${run}-${index}@example.test`, password: 'Local-stack-test-Password42!', displayName: 'Local stack check', role: 'business' }),
    });
    latencies.push(Math.round(performance.now() - start));
    assert.equal(response.status, 201, 'Local registration failed');
    // Fetch a fresh session through login to exercise hashing and session issuance.
    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `stack-${run}-${index}@example.test`, password: 'Local-stack-test-Password42!' }),
    });
    assert.equal(login.status, 201);
    const session = await login.json();
    const profile = await fetch(`${baseUrl}/api/v1/auth/profile`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
    assert.equal(profile.status, 200);
    assert.equal((await profile.json()).user.id, session.user.id);
    return session.user.id;
  }));
  await eventually(async () => {
    const result = await pool.query("SELECT count(*)::int AS total FROM notifications WHERE type='welcome' AND user_id=ANY($1::uuid[])", [accounts]);
    return result.rows[0].total === accounts.length;
  });
  await boss.start();
  const duplicateId = await boss.send('welcome-notification', { userId: accounts[0] });
  await eventually(async () => {
    const job = await boss.getJobById('welcome-notification', duplicateId);
    return job?.state === 'completed';
  });
  const duplicateCount = await pool.query("SELECT count(*)::int AS total FROM notifications WHERE type='welcome' AND user_id=$1", [accounts[0]]);
  assert.equal(duplicateCount.rows[0].total, 1);
  console.log(JSON.stringify({ passed: true, concurrentSignups: 8, loginAndProfileChecks: 8, welcomeDeliveries: 8, duplicateDeliverySuppressed: true, registrationLatencyMs: { min: Math.min(...latencies), max: Math.max(...latencies) } }));
} finally {
  await boss.stop();
  await pool.end();
}
