import { emailConfiguration } from '../email/email.js';

export type Environment = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  frontendUrl: string;
  databaseUrl?: string;
  jwtSecret: string;
  conversionWebhookSecret: string;
};

const allowedEnvironments = new Set<Environment['nodeEnv']>([
  'development',
  'test',
  'production',
]);

export function readEnvironment(
  source: NodeJS.ProcessEnv,
): Environment {
  const nodeEnv = source.NODE_ENV ?? 'development';
  emailConfiguration(source);
  if (!allowedEnvironments.has(nodeEnv as Environment['nodeEnv'])) {
    throw new Error(`NODE_ENV must be development, test, or production`);
  }

  const port = Number(source.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const frontendUrlValue = source.FRONTEND_URL ?? 'http://localhost:3000';
  let frontendUrl: string;
  try {
    frontendUrl = new URL(frontendUrlValue).origin;
  } catch {
    throw new Error('FRONTEND_URL must be a valid URL');
  }

  const databaseUrl = source.DATABASE_URL;
  if (nodeEnv === 'production' && !databaseUrl) throw new Error('DATABASE_URL is required in production');
  if (nodeEnv === 'production') {
    for (const name of ['JWT_SECRET', 'CONVERSION_WEBHOOK_SECRET'] as const) {
      const value = source[name];
      if (!value || value.length < 32 || /^(replace|local-|change-me)/i.test(value)) {
        throw new Error(`${name} must contain at least 32 characters and must not be a placeholder in production`);
      }
    }
    if (!frontendUrl.startsWith('https://')) throw new Error('FRONTEND_URL must use HTTPS in production');
  }

  return {
    nodeEnv: nodeEnv as Environment['nodeEnv'],
    port,
    frontendUrl,
    databaseUrl,
    jwtSecret: source.JWT_SECRET ?? 'local-development-secret-change-me',
    conversionWebhookSecret: source.CONVERSION_WEBHOOK_SECRET ?? 'local-webhook-secret-change-me',
  };
}
