import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOAuthState, open, OAUTH_STATE_TTL_MS, readOAuthState, seal } from './token-crypto.js';

describe('token encryption', () => {
  beforeEach(() => vi.stubEnv('JWT_SECRET', 'test-secret-that-is-long-enough'));
  afterEach(() => vi.unstubAllEnvs());
  it('round-trips and never stores the token in plain text', () => {
    const sealed = seal('act.example-token');
    expect(sealed).not.toContain('example-token');
    expect(open(sealed)).toBe('act.example-token');
    expect(seal('same')).not.toBe(seal('same'));
  });
  it('rejects tampered values and values sealed for another purpose', () => {
    const sealed = seal('secret'); const [iv, tag, body] = sealed.split('.');
    expect(() => open(`${iv}.${tag}.${body.slice(0, -2)}AA`)).toThrow();
    expect(() => open(seal('secret', 'oauth-state'))).toThrow();
  });
  it('rejects tokens when the server secret changes', () => {
    const sealed = seal('secret'); vi.stubEnv('JWT_SECRET', 'a-different-secret-value');
    expect(() => open(sealed)).toThrow();
  });
});

describe('OAuth state', () => {
  beforeEach(() => vi.stubEnv('JWT_SECRET', 'test-secret-that-is-long-enough'));
  afterEach(() => vi.unstubAllEnvs());
  it('identifies the user for the right provider until it expires', () => {
    const now = 1_000_000; const state = createOAuthState('user-1', 'tiktok', now);
    expect(readOAuthState(state, 'tiktok', now + 1000)).toMatchObject({ userId: 'user-1', provider: 'tiktok' });
    expect(readOAuthState(state, 'instagram', now)).toBeNull();
    expect(readOAuthState(state, 'tiktok', now + OAUTH_STATE_TTL_MS + 1)).toBeNull();
    expect(readOAuthState('forged.state.value', 'tiktok', now)).toBeNull();
  });
});
