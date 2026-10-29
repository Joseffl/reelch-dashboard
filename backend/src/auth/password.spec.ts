import { afterEach, describe, expect, it, vi } from 'vitest';
import { hash as legacyHash } from 'bcryptjs';
import { compare, hash, withPasswordCapacity } from './password.js';

afterEach(() => vi.unstubAllEnvs());

describe('password capacity', () => {
  it('verifies existing bcryptjs passwords with native bcrypt', async () => {
    const encoded = await legacyHash('existing-password', 4);
    expect(await compare('existing-password', encoded)).toBe(true);
    expect(await compare('incorrect', encoded)).toBe(false);
    expect(await compare('new-password', await hash('new-password', 4))).toBe(true);
  });

  it('bounds admitted work, rejects overflow, and recovers after a failure', async () => {
    vi.stubEnv('PASSWORD_CONCURRENCY', '1');
    vi.stubEnv('PASSWORD_QUEUE_MAX', '1');
    let release!: () => void;
    const first = withPasswordCapacity(() => new Promise<void>(resolve => { release = resolve; }));
    const second = withPasswordCapacity(async () => { throw new Error('hash failed'); });
    const secondResult = expect(second).rejects.toThrow('hash failed');
    await expect(withPasswordCapacity(async () => 'overflow')).rejects.toMatchObject({ status: 503 });
    release();
    await first;
    await secondResult;
    expect(await withPasswordCapacity(async () => 'recovered')).toBe('recovered');
  });

  it('expires queued work without leaking a capacity slot', async () => {
    vi.stubEnv('PASSWORD_CONCURRENCY', '1');
    vi.stubEnv('PASSWORD_QUEUE_TIMEOUT_MS', '10');
    let release!: () => void;
    const first = withPasswordCapacity(() => new Promise<void>(resolve => { release = resolve; }));
    await expect(withPasswordCapacity(async () => 'expired')).rejects.toMatchObject({ status: 503 });
    release();
    await first;
    expect(await withPasswordCapacity(async () => 'recovered')).toBe('recovered');
  });
});
