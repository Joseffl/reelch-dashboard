import { normalizeProfileLink } from '../common/profile-link.js';
import { Inject, BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { DatabaseService } from '../database/database.service.js';
import {
  auditLogs, businesses, promoters, socialAccounts,
  verificationDocuments, verificationRequests,
} from '../database/schema/index.js';
import { R2StorageService } from '../storage/r2-storage.service.js';

type BusinessProfile = {
  name?: string; industry?: string; website?: string; phone?: string; country?: string;
  companySize?: string; description?: string; registrationNumber?: string; address?: string;
  campaignGoals?: string[];
};
type PromoterProfile = {
  username?: string; bio?: string; phone?: string; country?: string; city?: string; dateOfBirth?: string;
  niches?: string[]; languages?: string[]; preferredCampaignTypes?: string[];
};

@Injectable()
export class OnboardingService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService, @Inject(R2StorageService) private readonly storage: R2StorageService) {}

  private requireRole(user: AuthenticatedUser, role: 'business' | 'promoter') {
    if (!user.roles.includes(role)) throw new ForbiddenException(`${role} role required`);
  }

  async status(user: AuthenticatedUser) {
    const request = await this.database.db.query.verificationRequests.findFirst({ where: eq(verificationRequests.userId, user.id) });
    const documents = request ? await this.database.db.select({
      id: verificationDocuments.id, kind: verificationDocuments.kind, originalFilename: verificationDocuments.originalFilename,
      mimeType: verificationDocuments.mimeType, sizeBytes: verificationDocuments.sizeBytes, createdAt: verificationDocuments.createdAt,
    }).from(verificationDocuments).where(eq(verificationDocuments.requestId, request.id)) : [];
    if (user.roles.includes('business')) {
      const profile = await this.database.db.query.businesses.findFirst({ where: eq(businesses.ownerUserId, user.id) });
      return { role: 'business', profile, verification: request, documents };
    }
    if (user.roles.includes('promoter')) {
      const profile = await this.database.db.query.promoters.findFirst({ where: eq(promoters.userId, user.id) });
      const socials = profile ? await this.database.db.select().from(socialAccounts).where(eq(socialAccounts.promoterId, profile.id)) : [];
      return { role: 'promoter', profile, socials, verification: request, documents };
    }
    throw new ForbiddenException('Onboarding is only available to business and promoter accounts');
  }

  async saveBusiness(user: AuthenticatedUser, input: BusinessProfile) {
    this.requireRole(user, 'business');
    const values = this.cleanProfile({
      name: input.name, industry: input.industry, website: input.website, phone: input.phone,
      country: input.country, companySize: input.companySize, description: input.description,
      registrationNumber: input.registrationNumber, address: input.address, campaignGoals: input.campaignGoals,
    });
    const [profile] = await this.database.db.update(businesses).set({ ...values, updatedAt: new Date() }).where(eq(businesses.ownerUserId, user.id)).returning();
    if (!profile) throw new NotFoundException('Business profile not found');
    return profile;
  }

  async savePromoter(user: AuthenticatedUser, input: PromoterProfile) {
    this.requireRole(user, 'promoter');
    const values = this.cleanProfile({
      username: input.username, bio: input.bio, phone: input.phone, country: input.country, city: input.city,
      dateOfBirth: input.dateOfBirth, niches: input.niches, languages: input.languages,
      preferredCampaignTypes: input.preferredCampaignTypes,
    });
    const [profile] = await this.database.db.update(promoters).set({ ...values, updatedAt: new Date() }).where(eq(promoters.userId, user.id)).returning();
    if (!profile) throw new NotFoundException('Promoter profile not found');
    return profile;
  }

  async addSocialAccount(user: AuthenticatedUser, input: { platform: string; handle: string; audienceSize?: number }) {
    this.requireRole(user, 'promoter');
    const profile = await this.database.db.query.promoters.findFirst({ where: eq(promoters.userId, user.id) });
    if (!profile) throw new NotFoundException('Promoter profile not found');
    if (!input.platform?.trim() || !input.handle?.trim()) throw new BadRequestException('Platform and handle are required');
    const [account] = await this.database.db.insert(socialAccounts).values({
      promoterId: profile.id, platform: input.platform.trim().toLowerCase(), handle: ["whatsapp", "phone number"].includes(input.platform.trim().toLowerCase()) || input.handle.trim().startsWith("@") ? input.handle.trim() : normalizeProfileLink(input.handle),
      audienceSize: Number.isInteger(input.audienceSize) && input.audienceSize! >= 0 ? input.audienceSize : undefined,
      dataSource: 'self_reported',
    }).returning();
    return account;
  }

  presignUpload(user: AuthenticatedUser, input: { filename: string; contentType: string; sizeBytes: number }) {
    if (!input.filename?.trim()) throw new BadRequestException('Filename is required');
    return this.storage.createUpload(user.id, input);
  }

  async completeUpload(user: AuthenticatedUser, input: { key: string; kind: string; filename: string; contentType: string; sizeBytes: number }) {
    if (!input.kind?.trim() || !input.filename?.trim()) throw new BadRequestException('Document kind and filename are required');
    await this.storage.assertUploaded(user.id, input.key, input.contentType, input.sizeBytes);
    const request = await this.database.db.query.verificationRequests.findFirst({ where: eq(verificationRequests.userId, user.id) });
    if (!request) throw new NotFoundException('Verification request not found');
    const [document] = await this.database.db.insert(verificationDocuments).values({
      requestId: request.id, userId: user.id, kind: input.kind.trim(), storageKey: input.key,
      originalFilename: input.filename.trim().slice(0, 255), mimeType: input.contentType, sizeBytes: input.sizeBytes,
    }).returning();
    return document;
  }

  async submit(user: AuthenticatedUser) {
    const state = await this.status(user);
    const role: 'business' | 'promoter' = state.role === 'business' ? 'business' : 'promoter';
    const requiredKinds = role === 'business' ? ['business_registration', 'representative_id'] : ['government_id'];
    const uploadedKinds = new Set(state.documents.map((document) => document.kind));
    const missing = requiredKinds.filter((kind) => !uploadedKinds.has(kind));
    if (missing.length) throw new BadRequestException(`Missing required documents: ${missing.join(', ')}`);
    if (role === 'business') {
      const profile = state.profile as typeof businesses.$inferSelect;
      if (!profile.industry || !profile.phone || !profile.registrationNumber || !profile.address) throw new BadRequestException('Complete all required business profile fields');
      await this.database.db.update(businesses).set({ verificationStatus: 'pending', onboardingCompletedAt: new Date(), updatedAt: new Date() }).where(eq(businesses.ownerUserId, user.id));
    } else {
      const profile = state.profile as typeof promoters.$inferSelect;
      if (!profile.bio || !profile.phone || !profile.city || !profile.niches.length || !state.socials?.length) throw new BadRequestException('Complete your profile and add at least one social account');
      await this.database.db.update(promoters).set({ verificationStatus: 'pending', onboardingCompletedAt: new Date(), updatedAt: new Date() }).where(eq(promoters.userId, user.id));
    }
    const [request] = await this.database.db.update(verificationRequests).set({ status: 'pending', decisionReason: null, updatedAt: new Date() }).where(and(eq(verificationRequests.userId, user.id), eq(verificationRequests.kind, role))).returning();
    if (!request) throw new NotFoundException('Verification request not found');
    await this.database.db.insert(auditLogs).values({ actorUserId: user.id, action: 'verification.submitted', resourceType: 'verification_request', resourceId: request.id, metadata: { role } });
    return { status: 'pending', submitted: true };
  }

  private cleanProfile<T extends Record<string, unknown>>(input: T): T {
    return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined).map(([key, value]) => [
      key, typeof value === 'string' ? value.trim() : Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : value,
    ])) as T;
  }
}
