import { describe, expect, it } from 'vitest';
import { readEnvironment } from './environment.js';

describe('readEnvironment', () => {
  it('provides safe local defaults', () => {
    expect(readEnvironment({})).toEqual({
      nodeEnv: 'development',
      port: 4000,
      frontendUrl: 'http://localhost:3000',
      databaseUrl: undefined,
      jwtSecret: 'local-development-secret-change-me',
      conversionWebhookSecret: 'local-webhook-secret-change-me',
    });
  });

  it('rejects an invalid port', () => {
    expect(() => readEnvironment({ PORT: 'not-a-port' })).toThrow(
      'PORT must be an integer between 1 and 65535',
    );
  });

  it('rejects an invalid frontend URL', () => {
    expect(() => readEnvironment({ FRONTEND_URL: 'frontend' })).toThrow(
      'FRONTEND_URL must be a valid URL',
    );
  });

  it('requires a database URL in production', () => {
    expect(() => readEnvironment({ NODE_ENV: 'production' })).toThrow(
      'DATABASE_URL is required in production',
    );
  });
});
