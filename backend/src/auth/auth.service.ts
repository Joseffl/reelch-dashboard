import { Inject, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from './password.js';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import { administratorInvitations, administrators, businesses, promoters, socialAccounts, userRoles, users, verificationRequests, wallets } from '../database/schema/index.js';
import type { AuthenticatedUser, ReelchRole } from './auth.types.js';
import { JobsService } from '../jobs/jobs.service.js';

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
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService, @Inject(JwtService) private readonly jwt: JwtService, @Inject(JobsService) private readonly jobs: JobsService) {}

  async register(input: RegisterInput) {
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof input.password !== 'string' || input.password.length < 8 || Buffer.byteLength(input.password) > 72 || typeof input.displayName !== 'string' || !input.displayName.trim() || input.displayName.length > 120) {
      throw new ConflictException('Valid email, name, and a password of at least 8 characters (at most 72 UTF-8 bytes) are required');
    }
    if (input.organizationName !== undefined && (typeof input.organizationName !== 'string' || input.organizationName.length > 160)) throw new ConflictException('Enter a valid business name');
    if (input.username !== undefined && (typeof input.username !== 'string' || !/^[a-zA-Z0-9_.-]{1,60}$/.test(input.username))) throw new ConflictException('Username must contain 1–60 letters, numbers, dots, underscores or hyphens');
    if (input.role !== 'business' && input.role !== 'promoter') throw new ConflictException('Invalid registration role');

    const existing = await this.database.db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) throw new ConflictException('An account already exists for this email');

    if (this.jobs.enabled) await this.jobs.ready();
    const passwordHash = await hash(input.password, 12);
    const user = await this.database.transaction(async (tx, client) => {
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
      await this.jobs.enqueueWelcome(created.id, client);
      return created;
    });
    return this.issueToken(user.id, user.email, [input.role]);
  }

  async login(input: { email: string; password: string }) {
    if (typeof input.email !== 'string' || typeof input.password !== 'string' || input.password.length > 1024) throw new UnauthorizedException('Invalid email or password');
    const email = input.email.trim().toLowerCase();
    const user = await this.database.db.query.users.findFirst({
      columns: { id: true, email: true, passwordHash: true, isActive: true },
      where: eq(users.email, email),
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const [passwordValid, roles] = await Promise.all([
      compare(input.password ?? '', user.passwordHash),
      this.database.db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.id)),
    ]);
    if (!passwordValid) throw new UnauthorizedException('Invalid email or password');
    return this.issueToken(user.id, user.email, roles.map(({ role }) => role));
  }

  async administratorInvitation(token: string) {
    const invitation = await this.validAdministratorInvitation(token);
    return { email: invitation.email, expiresAt: invitation.expiresAt };
  }

  async acceptAdministratorInvitation(input: { token: string; displayName: string; password: string }) {
    if (typeof input.displayName !== 'string' || !input.displayName.trim() || typeof input.password !== 'string' || input.password.length < 12 || Buffer.byteLength(input.password) > 72) {
      throw new ConflictException('Your name and a password of at least 12 characters are required');
    }
    const invitation = await this.validAdministratorInvitation(input.token);
    const passwordHash = await hash(input.password, 12);
    const user = await this.database.db.transaction(async (tx) => {
      const [claimed] = await tx.update(administratorInvitations).set({ acceptedAt: new Date() }).where(and(
        eq(administratorInvitations.id, invitation.id), isNull(administratorInvitations.acceptedAt),
        isNull(administratorInvitations.revokedAt), gt(administratorInvitations.expiresAt, new Date()),
      )).returning();
      if (!claimed) throw new ConflictException('This invitation is no longer available');
      const [created] = await tx.insert(users).values({ email: invitation.email, passwordHash, displayName: input.displayName.trim() }).returning();
      await tx.insert(userRoles).values({ userId: created.id, role: 'admin' });
      await tx.insert(administrators).values({ userId: created.id, invitedByUserId: invitation.invitedByUserId });
      return created;
    });
    return this.issueToken(user.id, user.email, ['admin']);
  }

  async profile(authenticated: AuthenticatedUser) {
    const user = await this.database.db.query.users.findFirst({ where: eq(users.id, authenticated.id) });
    if (!user) throw new UnauthorizedException('Account not found');
    const roles = await this.database.db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.id));
    const roleNames = roles.map(({ role }) => role);
    if (roleNames.includes('business')) {
      const roleProfile = await this.database.db.query.businesses.findFirst({ where: eq(businesses.ownerUserId, user.id) });
      return { user: { id: user.id, email: user.email, displayName: user.displayName, isActive: user.isActive, createdAt: user.createdAt }, roles: roleNames, role: 'business', roleProfile, socials: [] };
    }
    if (roleNames.includes('promoter')) {
      const roleProfile = await this.database.db.query.promoters.findFirst({ where: eq(promoters.userId, user.id) });
      const socials = roleProfile ? await this.database.db.select().from(socialAccounts).where(eq(socialAccounts.promoterId, roleProfile.id)) : [];
      return { user: { id: user.id, email: user.email, displayName: user.displayName, isActive: user.isActive, createdAt: user.createdAt }, roles: roleNames, role: 'promoter', roleProfile, socials };
    }
    return { user: { id: user.id, email: user.email, displayName: user.displayName, isActive: user.isActive, createdAt: user.createdAt }, roles: roleNames, role: 'admin', roleProfile: null, socials: [] };
  }

  async updateProfile(authenticated: AuthenticatedUser, input: Record<string, unknown>) {
    const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : undefined;
    if (displayName !== undefined && !displayName) throw new ConflictException('Display name cannot be empty');
    if (displayName) await this.database.db.update(users).set({ displayName, updatedAt: new Date() }).where(eq(users.id, authenticated.id));

    if (authenticated.roles.includes('business')) {
      const values = this.pickStrings(input, ['name', 'website', 'phone', 'description']);
      if (values.name === '') throw new ConflictException('Business name cannot be empty');
      if (Object.keys(values).length) await this.database.db.update(businesses).set({ ...values, updatedAt: new Date() }).where(eq(businesses.ownerUserId, authenticated.id));
    }
    if (authenticated.roles.includes('promoter')) {
      const values = this.pickStrings(input, ['username', 'bio', 'phone', 'city']);
      const niches = Array.isArray(input.niches) ? input.niches.map(String).map((item) => item.trim()).filter(Boolean) : undefined;
      if (values.username === '') throw new ConflictException('Username cannot be empty');
      if (values.username) {
        const existing = await this.database.db.query.promoters.findFirst({ where: eq(promoters.username, values.username) });
        if (existing && existing.userId !== authenticated.id) throw new ConflictException('That username is already in use');
      }
      await this.database.db.update(promoters).set({ ...values, ...(niches ? { niches } : {}), updatedAt: new Date() }).where(eq(promoters.userId, authenticated.id));
    }
    return this.profile(authenticated);
  }

  private pickStrings(input: Record<string, unknown>, keys: string[]) {
    return Object.fromEntries(keys.flatMap((key) => typeof input[key] === 'string' ? [[key, input[key].trim()]] : []));
  }

  private async issueToken(id: string, email: string, roles: ReelchRole[]) {
    return { accessToken: await this.jwt.signAsync({ id, email, roles }), user: { id, email, roles } };
  }

  private async validAdministratorInvitation(token: string) {
    if (!token) throw new UnauthorizedException('Administrator invitation token is required');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invitation = await this.database.db.query.administratorInvitations.findFirst({ where: and(
      eq(administratorInvitations.tokenHash, tokenHash), isNull(administratorInvitations.acceptedAt),
      isNull(administratorInvitations.revokedAt), gt(administratorInvitations.expiresAt, new Date()),
    ) });
    if (!invitation) throw new UnauthorizedException('This administrator invitation is invalid or has expired');
    return invitation;
  }
}
