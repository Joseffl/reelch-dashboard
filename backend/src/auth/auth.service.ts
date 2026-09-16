import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import { businesses, promoters, userRoles, users, verificationRequests, wallets } from '../database/schema/index.js';
import type { ReelchRole } from './auth.types.js';

type RegisterInput = {
  email: string;
  password: string;
  displayName: string;
  role: Exclude<ReelchRole, 'admin'>;
  organizationName?: string;
  username?: string;
};

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService, private readonly jwt: JwtService) {}

  async register(input: RegisterInput) {
    const email = input.email?.trim().toLowerCase();
    if (!email || !email.includes('@') || input.password?.length < 8 || !input.displayName?.trim()) {
      throw new ConflictException('Valid email, display name, and password of at least 8 characters are required');
    }
    if (input.role !== 'business' && input.role !== 'promoter') throw new ConflictException('Invalid registration role');

    const existing = await this.database.db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) throw new ConflictException('An account already exists for this email');

    const passwordHash = await hash(input.password, 12);
    const user = await this.database.db.transaction(async (tx) => {
      const [created] = await tx.insert(users).values({ email, passwordHash, displayName: input.displayName.trim() }).returning();
      await tx.insert(userRoles).values({ userId: created.id, role: input.role });
      await tx.insert(verificationRequests).values({
        userId: created.id,
        kind: input.role,
        evidence: {},
      });
      if (input.role === 'business') {
        const [business] = await tx.insert(businesses).values({ ownerUserId: created.id, name: input.organizationName?.trim() || input.displayName.trim() }).returning();
        await tx.insert(wallets).values({ ownerType: 'business', ownerId: business.id });
      } else {
        const [promoter] = await tx.insert(promoters).values({ userId: created.id, username: input.username?.trim().toLowerCase() || email.split('@')[0] }).returning();
        await tx.insert(wallets).values({ ownerType: 'promoter', ownerId: promoter.id });
      }
      return created;
    });
    return this.issueToken(user.id, user.email, [input.role]);
  }

  async login(input: { email: string; password: string }) {
    const email = input.email?.trim().toLowerCase();
    const user = await this.database.db.query.users.findFirst({ where: eq(users.email, email), with: undefined });
    if (!user || !user.isActive || !(await compare(input.password ?? '', user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const roles = await this.database.db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.id));
    return this.issueToken(user.id, user.email, roles.map(({ role }) => role));
  }

  private async issueToken(id: string, email: string, roles: ReelchRole[]) {
    return { accessToken: await this.jwt.signAsync({ id, email, roles }), user: { id, email, roles } };
  }
}
