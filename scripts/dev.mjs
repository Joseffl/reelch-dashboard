import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const grouped = process.platform !== 'win32';
const children = new Set();
let stopping = false;

function signal(child, value) {
  try {
    if (grouped) process.kill(-child.pid, value);
    else child.kill(value);
  } catch (error) {
    if (error.code !== 'ESRCH') console.error(error.message);
  }
}

function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) signal(child, 'SIGTERM');
  // Allow worker jobs to finish before forcing a stuck process to exit.
  const timeout = setTimeout(() => {
    for (const child of children) signal(child, 'SIGKILL');
  }, 35_000);
  timeout.unref();
}

process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));

console.log('Starting Reelch frontend, API and worker. Press Ctrl+C to stop all three.');
console.log('Frontend: http://localhost:3000 · API: http://localhost:4000/api/v1');

for (const name of ['dev:frontend', 'dev:backend', 'dev:worker']) {
  const child = spawn(npm, ['run', name], {
    cwd, stdio: 'inherit', detached: grouped,
    // dotenv preserves these values. All three services use jobs in this mode.
    env: { ...process.env, JOBS_ENABLED: 'true' },
  });
  children.add(child);
  child.once('error', error => {
    console.error(`${name} failed to start: ${error.message}`);
    children.delete(child);
    stop(1);
  });
  child.once('exit', (code, reason) => {
    children.delete(child);
    if (!stopping) {
      console.error(`${name} stopped (${reason ?? code}); stopping the other services.`);
      stop(code || 1);
    }
  });
}
