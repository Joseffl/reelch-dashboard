import { Inject, CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request, Response } from 'express';
import { DatabaseService } from '../database/database.service.js';
import { positiveInteger } from './settings.js';

const limits: Record<string, [string, number]> = {
  '/api/v1/auth/login': ['LOGIN', 120],
  '/api/v1/auth/register': ['REGISTER', 120],
  '/api/v1/auth/administrator-invitations/accept': ['INVITE', 30],
  '/api/v1/waitlist/promoters': ['WAITLIST', 120],
  '/api/v1/contact': ['CONTACT', 30],
};

export function clientNetwork(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  const normalized = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  if (normalized.startsWith('::ffff:')) return normalized;
  const [left, right = ''] = normalized.split('::');
  const prefix = left ? left.split(':') : [];
  const suffix = right ? right.split(':') : [];
  const groups = normalized.includes('::')
    ? [...prefix, ...Array<string>(8 - prefix.length - suffix.length).fill('0'), ...suffix]
    : prefix;
  return groups.slice(0, 4).map(group => parseInt(group, 16).toString(16)).join(':');
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const rule = request.method === 'POST' ? limits[request.path.toLowerCase().replace(/\/+$/, '')] : undefined;
    if (!rule) return true;
    const response = context.switchToHttp().getResponse<Response>();
    const [name, defaultLimit] = rule;
    const windowSeconds = positiveInteger('RATE_LIMIT_WINDOW_SECONDS', 600, 86400);
    // Express resolves req.ip using the explicitly configured trusted proxy list.
    // Never trust arbitrary X-Forwarded-For supplied by a caller.
    const ip = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    // Group IPv6 addresses into /64 networks to discourage address rotation.
    const identity = clientNetwork(ip);
    await this.consume(`${name}:ip:${identity}`, positiveInteger(`RATE_LIMIT_${name}_IP_MAX`, defaultLimit), windowSeconds, response);
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : undefined;
    if (email && ['LOGIN', 'REGISTER'].includes(name)) {
      await this.consume(`${name}:email:${email}`, positiveInteger(`RATE_LIMIT_${name}_ACCOUNT_MAX`, name === 'LOGIN' ? 20 : 5), windowSeconds, response);
    }
    return true;
  }

  private async consume(identity: string, maximum: number, windowSeconds: number, response: Response) {
    const key = createHmac('sha256', process.env.JWT_SECRET ?? 'local-development-secret-change-me').update(identity).digest('hex');
    const result = await this.database.executeSql(`
      INSERT INTO request_rate_limits (key, hits, expires_at)
      VALUES ($1, 1, now() + $2 * interval '1 second')
      ON CONFLICT (key) DO UPDATE SET
        hits = CASE WHEN request_rate_limits.expires_at <= now() THEN 1 ELSE request_rate_limits.hits + 1 END,
        expires_at = CASE WHEN request_rate_limits.expires_at <= now() THEN EXCLUDED.expires_at ELSE request_rate_limits.expires_at END
      RETURNING hits, greatest(1, ceil(extract(epoch FROM expires_at - now())))::int AS retry_after
    `, [key, windowSeconds]);
    const row = result.rows[0] as { hits: number; retry_after: number };
    if (row.hits > maximum) {
      response.setHeader('Retry-After', String(row.retry_after));
      throw new HttpException('Too many attempts. Please try again later.', 429);
    }
  }
}
