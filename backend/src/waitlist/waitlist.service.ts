import { BadRequestException, Injectable } from '@nestjs/common';
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
}
