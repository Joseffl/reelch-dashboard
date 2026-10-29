import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmationEmail, emailConfiguration } from './email.js';

afterEach(() => vi.unstubAllEnvs());

describe('confirmation email configuration', () => {
  it('keeps email off until explicitly enabled', () => {
    expect(emailConfiguration({ RESEND_API_KEY: 'key' })).toBeUndefined();
  });

  it('requires workers, a key, and a sender when enabled', () => {
    expect(() => emailConfiguration({ EMAIL_ENABLED: 'true' })).toThrow('JOBS_ENABLED');
    expect(() => emailConfiguration({ EMAIL_ENABLED: 'true', JOBS_ENABLED: 'true' })).toThrow('RESEND_API_KEY');
    expect(() => emailConfiguration({ EMAIL_ENABLED: 'true', JOBS_ENABLED: 'true', RESEND_API_KEY: 'key' })).toThrow('EMAIL_FROM');
  });

  it('escapes names, supplies plain text and uses the configured app URL', () => {
    vi.stubEnv('EMAIL_ENABLED', 'true'); vi.stubEnv('JOBS_ENABLED', 'true');
    vi.stubEnv('RESEND_API_KEY', 'test-key'); vi.stubEnv('EMAIL_FROM', 'Reelch <hello@example.test>');
    vi.stubEnv('EMAIL_REPLY_TO', 'support@example.test'); vi.stubEnv('FRONTEND_URL', 'https://app.example.test');
    const message = confirmationEmail('account', '<script>alert(1)</script>', 'user@example.test')!;
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;');
    expect(message.text).toContain('https://app.example.test/login');
    expect(message.reply_to).toBe('support@example.test');
    expect(confirmationEmail('waitlist', 'A User', 'user@example.test')!.text).toContain('waitlist');
  });
});
