import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient } from 'pg';
import { positiveInteger } from '../common/settings.js';
import { attachDatabasePool } from '@vercel/functions';
import * as schema from './schema/index.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: positiveInteger('DB_POOL_MAX', 10, 100),
    min: 0,
    idleTimeoutMillis: positiveInteger('DB_POOL_IDLE_TIMEOUT_MS', 5_000),
    connectionTimeoutMillis: positiveInteger('DB_POOL_CONNECTION_TIMEOUT_MS', 3_000),
    query_timeout: positiveInteger('DB_QUERY_TIMEOUT_MS', 10_000),
    statement_timeout: positiveInteger('DB_STATEMENT_TIMEOUT_MS', 10_000),
    application_name: process.env.SERVICE_NAME ?? 'reelch-api',
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
  readonly db = drizzle(this.pool, { schema });

  constructor() {
    this.pool.on('error', (error) => this.logger.error('Idle database connection failed', error.stack));
    if (process.env.VERCEL && process.env.REELCH_WORKER !== 'true') attachDatabasePool(this.pool);
  }

  executeSql = (text: string, values?: unknown[]) => this.pool.query(text, values);

  async transaction<T>(operation: (db: NodePgDatabase<typeof schema>, client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(drizzle(client, { schema }), client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  poolStats() {
    return { total: this.pool.totalCount, idle: this.pool.idleCount, waiting: this.pool.waitingCount };
  }

  async ping() {
    let client: PoolClient | undefined;
    try { client = await this.pool.connect(); await client.query('select 1'); return true; }
    catch { return false; }
    finally { client?.release(); }
  }

  async onModuleDestroy() { await this.pool.end(); }

}
