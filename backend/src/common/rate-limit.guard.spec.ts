import { describe, expect, it } from 'vitest';
import { clientNetwork } from './rate-limit.guard.js';

describe('client network normalization', () => {
  it('groups equivalent IPv6 representations into a consistent /64', () => {
    expect(clientNetwork('2001:db8::1')).toBe('2001:db8:0:0');
    expect(clientNetwork('2001:0db8:0000:0000:1234:5678:90ab:cdef')).toBe('2001:db8:0:0');
    expect(clientNetwork('2001:db8:1::1')).not.toBe(clientNetwork('2001:db8::1'));
    expect(clientNetwork('::1')).toBe('0:0:0:0');
  });
  it('preserves distinct IPv4 clients', () => {
    expect(clientNetwork('192.0.2.1')).toBe('192.0.2.1');
    expect(clientNetwork('::ffff:192.0.2.1')).not.toBe(clientNetwork('::ffff:192.0.2.2'));
  });
});
