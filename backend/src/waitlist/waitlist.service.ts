import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import { promoterWaitlist } from '../database/schema/index.js';

export type JoinWaitlistInput = {
  fullName?: string;
  email?: string;
  phone?: string;
  country?: string;
  primaryPlatform?: string;
  profileUrl?: string;
  audienceSize?: number;
  niches?: string[];
};

@Injectable()
export class WaitlistService {
  constructor(private readonly database: DatabaseService) {}

  async joinPromoterWaitlist(input: JoinWaitlistInput) {
    const fullName = input.fullName?.trim();
    const email = input.email?.trim().toLowerCase();
    const phone = input.phone?.trim();
    const country = input.country?.trim();
    const primaryPlatform = input.primaryPlatform?.trim();
    const profileUrl = input.profileUrl?.trim();
    const niches = [...new Set((input.niches ?? []).map((niche) => niche.trim()).filter(Boolean))].slice(0, 8);
    const audienceSize = Number(input.audienceSize);

    if (!fullName || !email || !phone || !country || !primaryPlatform || !profileUrl) {
      throw new BadRequestException('Complete all required waitlist fields');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Enter a valid email address');
    if (!/^https?:\/\//i.test(profileUrl) && !/^\+?[\d\s()-]{7,}$/.test(profileUrl)) {
      throw new BadRequestException('Enter a valid profile link or contact number');
    }
    if (!niches.length) throw new BadRequestException('Select at least one content niche');
    if (Number.isNaN(audienceSize) || audienceSize < 0 || !Number.isInteger(audienceSize)) {
      throw new BadRequestException('Enter a valid audience size');
    }

    const values = { fullName, email, phone, country, primaryPlatform, profileUrl, audienceSize, niches, updatedAt: new Date() };
    const [entry] = await this.database.db.insert(promoterWaitlist).values(values).onConflictDoUpdate({
      target: promoterWaitlist.email,
      set: values,
    }).returning({ id: promoterWaitlist.id, status: promoterWaitlist.status });

    return { message: 'You are on the Reelch promoter waitlist.', entry };
  }

  async listPromoterWaitlist(input: { status?: string; query?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(input.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(input.pageSize) || 25));
    const status = input.status?.trim();
    const query = input.query?.trim();
    const filters = [];
    if (status && status !== 'all') filters.push(eq(promoterWaitlist.status, status));
    if (query) filters.push(or(
      ilike(promoterWaitlist.fullName, `%${query}%`),
      ilike(promoterWaitlist.email, `%${query}%`),
      ilike(promoterWaitlist.phone, `%${query}%`),
      ilike(promoterWaitlist.primaryPlatform, `%${query}%`),
    )!);
    const where = filters.length ? and(...filters) : undefined;
    const [items, countRows, statusRows] = await Promise.all([
      this.database.db.select().from(promoterWaitlist).where(where).orderBy(desc(promoterWaitlist.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
      this.database.db.select({ total: sql<number>`count(*)::int` }).from(promoterWaitlist).where(where),
      this.database.db.select({ status: promoterWaitlist.status, total: sql<number>`count(*)::int` }).from(promoterWaitlist).groupBy(promoterWaitlist.status),
    ]);
    const total = countRows[0]?.total ?? 0;
    return { items, counts: Object.fromEntries(statusRows.map(row => [row.status, row.total])), pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } };
  }

  async updatePromoterWaitlistStatus(id: string, status: string) {
    const allowed = ['pending', 'contacted', 'invited', 'onboarded', 'declined'];
    if (!allowed.includes(status)) throw new BadRequestException('Select a valid waitlist status');
    const [entry] = await this.database.db.update(promoterWaitlist).set({ status, updatedAt: new Date() }).where(eq(promoterWaitlist.id, id)).returning();
    if (!entry) throw new NotFoundException('Waitlist submission not found');
    return entry;
  }
}
