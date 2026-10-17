import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: this.integerEnv('DB_POOL_MAX', 10),
    min: this.integerEnv('DB_POOL_MIN', 1),
    idleTimeoutMillis: this.integerEnv('DB_POOL_IDLE_TIMEOUT_MS', 30_000),
    connectionTimeoutMillis: this.integerEnv('DB_POOL_CONNECTION_TIMEOUT_MS', 3_000),
    query_timeout: this.integerEnv('DB_QUERY_TIMEOUT_MS', 10_000),
    statement_timeout: this.integerEnv('DB_STATEMENT_TIMEOUT_MS', 10_000),
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
  readonly db = drizzle(this.pool, { schema });

  async ping() {
    const client = await this.pool.connect();
    try { await client.query('select 1'); return true; }
    catch { return false; }
    finally { client.release(); }
  }

  async onModuleDestroy() { await this.pool.end(); }

  private integerEnv(name: string, fallback: number) {
    const value = Number(process.env[name]);
    return Number.isInteger(value) && value >= 0 ? value : fallback;
  }
}
