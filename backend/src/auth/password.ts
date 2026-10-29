import bcrypt from 'bcrypt';
import { ServiceUnavailableException } from '@nestjs/common';
import { positiveInteger } from '../common/settings.js';

// Native asynchronous bcrypt runs outside the JavaScript event loop. Bound
// admission as well: libuv otherwise accepts an unbounded queue of expensive work.
let active = 0;
const waiting: Array<() => void> = [];

export async function withPasswordCapacity<T>(operation: () => Promise<T>): Promise<T> {
  const concurrency = positiveInteger('PASSWORD_CONCURRENCY', 4, 128);
  const capacity = positiveInteger('PASSWORD_QUEUE_MAX', 64, 10_000);
  if (active >= concurrency) {
    if (waiting.length >= capacity) throw new ServiceUnavailableException('Account services are busy. Please try again shortly.');
    await new Promise<void>((resolve, reject) => {
      const wake = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => {
        const index = waiting.indexOf(wake);
        if (index >= 0) waiting.splice(index, 1);
        reject(new ServiceUnavailableException('Account services are busy. Please try again shortly.'));
      }, positiveInteger('PASSWORD_QUEUE_TIMEOUT_MS', 5000, 60_000));
      waiting.push(wake);
    });
  } else {
    active += 1;
  }
  try { return await operation(); }
  finally {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  }
}

export const hash = (password: string, rounds: number) => withPasswordCapacity(() => bcrypt.hash(password, rounds));
export const compare = (password: string, encoded: string) => withPasswordCapacity(() => bcrypt.compare(password, encoded));
