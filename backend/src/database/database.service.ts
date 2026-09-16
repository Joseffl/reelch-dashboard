import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL });
  readonly db = drizzle(this.pool, { schema });

  async ping() {
    const client = await this.pool.connect();
    try { await client.query('select 1'); return true; }
    catch { return false; }
    finally { client.release(); }
  }

  async onModuleDestroy() { await this.pool.end(); }
}
