import 'dotenv/config';
import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { administrators, userRoles, users } from './schema/index.js';

const databaseUrl = process.env.DATABASE_URL;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!databaseUrl || !email || !password || password.length < 12) {
  throw new Error('DATABASE_URL, ADMIN_EMAIL, and ADMIN_PASSWORD (12+ characters) are required');
}

const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle(pool);

try {
  await db.transaction(async (tx) => {
    const existing = await tx.select().from(users).where(eq(users.email, email));
    const user = existing[0] ?? (await tx.insert(users).values({
      email,
      passwordHash: await hash(password, 12),
      displayName: 'Reelch Administrator',
    }).returning())[0];
    await tx.insert(userRoles).values({ userId: user.id, role: 'admin' }).onConflictDoNothing();
    await tx.insert(administrators).values({ userId: user.id, isSuperAdmin: true }).onConflictDoUpdate({ target: administrators.userId, set: { isSuperAdmin: true } });
  });
  process.stdout.write(`Admin access is ready for ${email}\n`);
} finally {
  await pool.end();
}
