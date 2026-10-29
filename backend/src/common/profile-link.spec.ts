import { describe, expect, it } from 'vitest';
import { normalizeProfileLink } from './profile-link.js';

describe('profile links', () => {
  it('adds HTTPS to bare profile links and preserves existing web links', () => {
    expect(normalizeProfileLink(' x.com/example ')).toBe('https://x.com/example');
    expect(normalizeProfileLink('www.instagram.com/example')).toBe('https://www.instagram.com/example');
    expect(normalizeProfileLink('https://x.com/example')).toBe('https://x.com/example');
    expect(normalizeProfileLink('http://x.com/example')).toBe('http://x.com/example');
    expect(normalizeProfileLink('//x.com/example')).toBe('https://x.com/example');
  });
  it('preserves phone contacts when allowed', () => {
    expect(normalizeProfileLink('+234 800 000 0000', true)).toBe('+234 800 000 0000');
  });
  it('rejects unsafe schemes and malformed links', () => {
    for (const input of ['javascript:alert(1)', 'ftp://x.com/example', 'not a link', 'https://', 'https://user:password@x.com/example']) {
      expect(() => normalizeProfileLink(input)).toThrow();
    }
  });
});
