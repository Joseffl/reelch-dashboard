import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool?: Pool;
  private client?: NodePgDatabase<typeof schema>;

  get db(): NodePgDatabase<typeof schema> {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL is not configured. Add it to backend/.env or the process environment.',
      );
    }
    if (!this.client) {
      this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
      this.client = drizzle(this.pool, { schema });
    }
    return this.client;
  }

  async ping() {
    if (!process.env.DATABASE_URL) return false;
    const result = await this.poolForPing().query('select 1 as connected');
    return result.rows[0]?.connected === 1;
  }

  private poolForPing() {
    if (!this.pool) this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return this.pool;
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }
}
