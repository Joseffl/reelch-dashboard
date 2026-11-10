import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

// Social platform tokens are stored encrypted (AES-256-GCM) with a key derived from the server secret,
// and OAuth `state` values are encrypted too, so they cannot be forged or read in transit.

function key(purpose: string) {
  const secret = process.env.SOCIAL_TOKEN_SECRET?.trim() || process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error('JWT_SECRET (or SOCIAL_TOKEN_SECRET) is required to protect social tokens');
  return Buffer.from(hkdfSync('sha256', secret, 'reelch', `reelch:${purpose}`, 32));
}

export function seal(plain: string, purpose = 'social-token') {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key(purpose), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map(part => part.toString('base64url')).join('.');
}

export function open(sealed: string, purpose = 'social-token') {
  const [iv, tag, body] = sealed.split('.').map(part => Buffer.from(part, 'base64url'));
  if (!iv?.length || !tag?.length || !body) throw new Error('Malformed sealed value');
  const decipher = createDecipheriv('aes-256-gcm', key(purpose), iv); decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

export type OAuthState = { userId: string; provider: string; expiresAt: number };
export const OAUTH_STATE_TTL_MS = 10 * 60_000;

export function createOAuthState(userId: string, provider: string, now = Date.now()) {
  return seal(JSON.stringify({ userId, provider, expiresAt: now + OAUTH_STATE_TTL_MS, nonce: randomBytes(8).toString('hex') }), 'oauth-state');
}

export function readOAuthState(state: string, provider: string, now = Date.now()): OAuthState | null {
  try {
    const value = JSON.parse(open(state, 'oauth-state')) as OAuthState;
    if (value.provider !== provider || typeof value.userId !== 'string' || value.expiresAt < now) return null;
    return value;
  } catch { return null; }
}
