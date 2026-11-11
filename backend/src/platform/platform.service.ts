import { Inject, BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { and, asc, desc, eq, gt, ilike, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import {
  administratorInvitations, administrators, auditLogs, businesses, campaignCreatives, campaignPromoters, campaignReservations, campaigns,
  campaignStatusHistory, conversions, fraudFlags, ledgerEntries, ledgerTransactions,
  disputeEvidence, disputes, inboundWebhookEvents, notifications, payoutAccounts, proofSubmissions,
  paymentAttempts, proofAiReviews, proofMetricSnapshots, promoterApplications, promoters, referralLinks, socialAccounts, socialConnections, trackingEvents, users, verificationDocuments, verificationRequests,
  verificationResults, virtualAccounts, wallets, withdrawals,
} from '../database/schema/index.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { R2StorageService } from '../storage/r2-storage.service.js';
import { PaystackService, type PaystackVerification } from './paystack.service.js';
import { SocialVerificationService } from './social-verification.service.js';
import { PaypalService, type FundingVerification } from './paypal.service.js';
import { AiOutputError, AiService } from '../ai/ai.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import { imageFingerprint, isNearDuplicate } from './evidence-fingerprint.js';
import { decideProof, proofAssessmentSchema, proofReviewPrompt, proofReviewSystemPrompt, FIRST_PROOF_WINDOW_HOURS, firstProofDeadline, RESUBMIT_WINDOW_HOURS, resubmitDeadline, riskScore, sanitizeAssessment, type AiProofAssessment } from './proof-review.js';
import { campaignCountry, campaignLocationAllows, campaignLocations } from './campaign-location.js';
import { summarizeAnalytics } from './analytics.js';
import { TiktokApiError, TiktokService, TIKTOK_SCOPES } from './tiktok.service.js';
import { createOAuthState, open as openSealed, readOAuthState, seal } from './token-crypto.js';
import { assistantContext, assistantPrompt, assistantSchema, assistantSystemPrompt, cleanHistory, MAX_QUESTION_LENGTH, sanitizeAnswer } from './business-assistant.js';

type CreateCampaign = { title: string; description: string; unitPriceKobo: number; targetQuantity: number; targeting?: Record<string, unknown>; destinationUrl: string; conversionType?: string; startsAt?: string; endsAt?: string };
const campaignCategories = new Set(['Beauty', 'Business', 'Education', 'Entertainment', 'Fashion', 'Finance', 'Fitness', 'Food', 'Gaming', 'Lifestyle', 'Music', 'Sports', 'Technology', 'Travel']);

const formatMinor = (minor: number, currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);
  // Per-instance limit on assistant questions, so one account cannot run up AI costs.
  private readonly assistantCalls = new Map<string, number[]>();

  constructor(@Inject(DatabaseService) private readonly database: DatabaseService, @Inject(R2StorageService) private readonly storage: R2StorageService, @Inject(PaystackService) private readonly paystack: PaystackService, @Inject(SocialVerificationService) private readonly socialVerification: SocialVerificationService, @Inject(PaypalService) private readonly paypal: PaypalService, @Inject(AiService) private readonly ai: AiService, @Inject(JobsService) private readonly jobs: JobsService, @Inject(TiktokService) private readonly tiktok: TiktokService) {}

  // PayPal cannot settle NGN, so the campaign currency decides the payment rail.
  platformCurrency() {
    return (process.env.PAYMENT_PROVIDER?.trim().toLowerCase() || 'paypal') === 'paystack' ? 'NGN' : (process.env.PAYPAL_CURRENCY?.trim().toUpperCase() || 'USD');
  }
  private providerFor(currency: string) { return currency === 'NGN' ? 'paystack' : 'paypal'; }

  publicConfig() {
    const currency = this.platformCurrency();
    return { paymentProvider: this.providerFor(currency), currency, aiVerification: this.ai.configured };
  }

  async administrators(user: AuthenticatedUser) {
    await this.requireSuperAdmin(user.id);
    const [members, invitations] = await Promise.all([
      this.database.db.select({
        userId: administrators.userId, email: users.email, displayName: users.displayName,
        isActive: users.isActive, isSuperAdmin: administrators.isSuperAdmin, createdAt: administrators.createdAt,
      }).from(administrators).innerJoin(users, eq(administrators.userId, users.id)).orderBy(asc(administrators.createdAt)),
      this.database.db.select({ id: administratorInvitations.id, email: administratorInvitations.email, expiresAt: administratorInvitations.expiresAt, createdAt: administratorInvitations.createdAt })
        .from(administratorInvitations).where(and(isNull(administratorInvitations.acceptedAt), isNull(administratorInvitations.revokedAt), gt(administratorInvitations.expiresAt, new Date()))).orderBy(desc(administratorInvitations.createdAt)),
    ]);
    return { members, invitations };
  }

  async inviteAdministrator(user: AuthenticatedUser, input: { email: string }) {
    await this.requireSuperAdmin(user.id);
    const email = input.email?.trim().toLowerCase();
    if (!email || !email.includes('@')) throw new BadRequestException('Enter a valid email address');
    const existingUser = await this.database.db.query.users.findFirst({ columns: { id: true }, where: eq(users.email, email) });
    if (existingUser) throw new ConflictException('An account already exists for this email');
    const activeInvite = await this.database.db.query.administratorInvitations.findFirst({ where: and(eq(administratorInvitations.email, email), isNull(administratorInvitations.acceptedAt), isNull(administratorInvitations.revokedAt), gt(administratorInvitations.expiresAt, new Date())) });
    if (activeInvite) throw new ConflictException('An active invitation already exists for this email');
    const token = randomBytes(32).toString('base64url');
    const [invitation] = await this.database.db.insert(administratorInvitations).values({
      email, tokenHash: this.hash(token), invitedByUserId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }).returning({ id: administratorInvitations.id, email: administratorInvitations.email, expiresAt: administratorInvitations.expiresAt });
    await this.audit(user, 'administrator.invited', 'administrator_invitation', invitation.id, { email });
    const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    return { ...invitation, inviteUrl: `${frontendUrl}/accept-admin-invite?token=${encodeURIComponent(token)}` };
  }

  async revokeAdministratorInvitation(user: AuthenticatedUser, invitationId: string) {
    await this.requireSuperAdmin(user.id);
    const [invitation] = await this.database.db.update(administratorInvitations).set({ revokedAt: new Date() }).where(and(eq(administratorInvitations.id, invitationId), isNull(administratorInvitations.acceptedAt), isNull(administratorInvitations.revokedAt))).returning();
    if (!invitation) throw new NotFoundException('Active invitation not found');
    await this.audit(user, 'administrator.invitation_revoked', 'administrator_invitation', invitationId, { email: invitation.email });
    return { success: true };
  }

  async setAdministratorActive(user: AuthenticatedUser, targetUserId: string, isActive: boolean) {
    await this.requireSuperAdmin(user.id);
    if (user.id === targetUserId) throw new BadRequestException('You cannot change your own administrator access');
    const target = await this.database.db.query.administrators.findFirst({ where: eq(administrators.userId, targetUserId) });
    if (!target) throw new NotFoundException('Administrator not found');
    if (target.isSuperAdmin && !isActive) throw new ForbiddenException('A super administrator cannot be suspended');
    const [updated] = await this.database.db.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, targetUserId)).returning({ id: users.id, isActive: users.isActive });
    await this.audit(user, isActive ? 'administrator.reactivated' : 'administrator.suspended', 'user', targetUserId);
    return updated;
  }

  async adminVerifications(input: { status?: string; query?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(input.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(input.pageSize) || 20));
    const allowedStatuses = ['draft', 'pending', 'approved', 'rejected', 'more_information_required'] as const;
    const status = allowedStatuses.includes(input.status as typeof allowedStatuses[number]) ? input.status as typeof allowedStatuses[number] : 'pending';
    const query = input.query?.trim();
    const filters = [eq(verificationRequests.status, status)];
    if (query) filters.push(or(ilike(users.email, `%${query}%`), ilike(users.displayName, `%${query}%`))!);
    const where = and(...filters);
    const base = this.database.db.select({
      id: verificationRequests.id, kind: verificationRequests.kind, status: verificationRequests.status,
      submittedAt: verificationRequests.updatedAt, decisionReason: verificationRequests.decisionReason,
      userId: users.id, email: users.email, displayName: users.displayName, isActive: users.isActive,
    }).from(verificationRequests).innerJoin(users, eq(verificationRequests.userId, users.id));
    const [items, countRows] = await Promise.all([
      base.where(where).orderBy(status === 'pending' ? asc(verificationRequests.updatedAt) : desc(verificationRequests.updatedAt)).limit(pageSize).offset((page - 1) * pageSize),
      this.database.db.select({ total: sql<number>`count(*)::int` }).from(verificationRequests).innerJoin(users, eq(verificationRequests.userId, users.id)).where(where),
    ]);
    return { items, pagination: { page, pageSize, total: countRows[0]?.total ?? 0, pages: Math.ceil((countRows[0]?.total ?? 0) / pageSize) } };
  }

  async adminVerificationDetail(requestId: string) {
    const rows = await this.database.db.select({ request: verificationRequests, user: {
      id: users.id, email: users.email, displayName: users.displayName, isActive: users.isActive,
      createdAt: users.createdAt,
    } }).from(verificationRequests).innerJoin(users, eq(verificationRequests.userId, users.id)).where(eq(verificationRequests.id, requestId)).limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException('Verification request not found');
    const [documents, history] = await Promise.all([
      this.database.db.select({ id: verificationDocuments.id, kind: verificationDocuments.kind, originalFilename: verificationDocuments.originalFilename, mimeType: verificationDocuments.mimeType, sizeBytes: verificationDocuments.sizeBytes, createdAt: verificationDocuments.createdAt }).from(verificationDocuments).where(eq(verificationDocuments.requestId, requestId)).orderBy(desc(verificationDocuments.createdAt)),
      this.database.db.select().from(auditLogs).where(eq(auditLogs.resourceId, requestId)).orderBy(desc(auditLogs.createdAt)),
    ]);
    if (row.request.kind === 'business') {
      const profile = await this.database.db.query.businesses.findFirst({ where: eq(businesses.ownerUserId, row.user.id) });
      return { ...row, profile, documents, socials: [], history };
    }
    const profile = await this.database.db.query.promoters.findFirst({ where: eq(promoters.userId, row.user.id) });
    const socials = profile ? await this.database.db.select().from(socialAccounts).where(eq(socialAccounts.promoterId, profile.id)) : [];
    return { ...row, profile, documents, socials, history };
  }

  async adminDocumentUrl(requestId: string, documentId: string) {
    const document = await this.database.db.query.verificationDocuments.findFirst({ where: and(eq(verificationDocuments.id, documentId), eq(verificationDocuments.requestId, requestId)) });
    if (!document) throw new NotFoundException('Verification document not found');
    return { url: await this.storage.createReadUrl(document.storageKey), expiresIn: 300, filename: document.originalFilename, mimeType: document.mimeType };
  }

  async setUserActive(admin: AuthenticatedUser, userId: string, isActive: boolean, reason?: string) {
    if (admin.id === userId && !isActive) throw new BadRequestException('You cannot suspend your own account');
    if (typeof isActive !== 'boolean') throw new BadRequestException('isActive must be a boolean');
    if (!isActive && !reason?.trim()) throw new BadRequestException('A suspension reason is required');
    const [updated] = await this.database.db.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, userId)).returning({ id: users.id, email: users.email, isActive: users.isActive });
    if (!updated) throw new NotFoundException('User not found');
    await this.audit(admin, isActive ? 'user.reactivated' : 'user.suspended', 'user', userId, { reason });
    await this.notify(userId, isActive ? 'account_reactivated' : 'account_suspended', isActive ? 'Account reactivated' : 'Account suspended', isActive ? 'Your Reelch account has been reactivated.' : `Your Reelch account was suspended: ${reason}`, { reason });
    return updated;
  }

  async createCampaign(user: AuthenticatedUser, input: CreateCampaign) {
    if (!input.title?.trim() || !input.description?.trim() || !Number.isInteger(input.unitPriceKobo) || input.unitPriceKobo < 100 || !Number.isInteger(input.targetQuantity) || input.targetQuantity < 1) {
      throw new BadRequestException('Title, description, positive target, and unit price of at least 1.00 are required');
    }
    try { new URL(input.destinationUrl); } catch { throw new BadRequestException('A valid destinationUrl is required'); }
    this.validateCampaignTargeting(input.targeting);
    this.validateCampaignDates(input.startsAt, input.endsAt);
    const business = await this.businessFor(user.id);
    if (business.verificationStatus !== 'approved') throw new ForbiddenException('Business verification is required');
    const [campaign] = await this.database.db.insert(campaigns).values({
      businessId: business.id, title: input.title.trim(), description: input.description.trim(), currency: this.platformCurrency(),
      conversionType: input.conversionType?.trim() || 'visibility', objective: 'visibility',
      unitPriceKobo: input.unitPriceKobo, targetQuantity: input.targetQuantity,
      budgetKobo: input.unitPriceKobo * input.targetQuantity,
      targeting: { ...input.targeting, country: campaignCountry(input.targeting?.location), objective: 'visibility', destinationUrl: input.destinationUrl },
      startsAt: input.startsAt ? new Date(input.startsAt) : undefined, endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
    }).returning();
    await this.audit(user, 'campaign.created', 'campaign', campaign.id);
    return campaign;
  }

  async reviewVerification(user: AuthenticatedUser, requestId: string, decision: 'approved' | 'rejected' | 'more_information_required', reason?: string) {
    const request = await this.database.db.query.verificationRequests.findFirst({ where: eq(verificationRequests.id, requestId) });
    if (!request || request.status !== 'pending') throw new NotFoundException('Pending verification request not found');
    if (decision !== 'approved' && !reason?.trim()) throw new BadRequestException('A reason is required');
    const result = await this.database.db.transaction(async (tx) => {
      const [reviewed] = await tx.update(verificationRequests).set({ status: decision, decisionReason: reason?.trim() || null, reviewedBy: user.id, reviewedAt: new Date(), updatedAt: new Date() }).where(and(eq(verificationRequests.id, requestId), eq(verificationRequests.status, 'pending'))).returning();
      if (!reviewed) throw new ConflictException('Verification request has already been reviewed');
      if (request.kind === 'business') await tx.update(businesses).set({ verificationStatus: decision, updatedAt: new Date() }).where(eq(businesses.ownerUserId, request.userId));
      if (request.kind === 'promoter') await tx.update(promoters).set({ verificationStatus: decision, updatedAt: new Date() }).where(eq(promoters.userId, request.userId));
      return reviewed;
    });
    await this.audit(user, 'verification.reviewed', 'verification_request', requestId, { decision, reason });
    await this.notify(request.userId, 'verification_reviewed', 'Verification updated', decision === 'approved' ? 'Your Reelch profile has been verified.' : `Your verification needs attention: ${reason ?? decision}`, { requestId, decision });
    return result;
  }

  async businessCampaigns(user: AuthenticatedUser) {
    const business = await this.businessFor(user.id);
    return this.database.db.select().from(campaigns).where(eq(campaigns.businessId, business.id)).orderBy(desc(campaigns.createdAt));
  }

  private async analyticsFor(businessId: string) {
    const currency = this.platformCurrency();
    const rows = await this.database.db.select({ campaign: campaigns, reservation: campaignReservations }).from(campaigns)
      .leftJoin(campaignReservations, eq(campaignReservations.campaignId, campaigns.id))
      .where(and(eq(campaigns.businessId, businessId), eq(campaigns.currency, currency), inArray(campaigns.status, ['live', 'paused', 'completed'])));
    const campaignIds = rows.map(row => row.campaign.id);
    const proofRows = campaignIds.length ? await this.database.db.select({ proof: proofSubmissions, campaignId: campaignPromoters.campaignId }).from(proofSubmissions)
      .innerJoin(campaignPromoters, eq(proofSubmissions.assignmentId, campaignPromoters.id)).where(inArray(campaignPromoters.campaignId, campaignIds)) : [];
    const proofIds = proofRows.map(row => row.proof.id);
    const snapshots = proofIds.length ? await this.database.db.select().from(proofMetricSnapshots).where(inArray(proofMetricSnapshots.proofSubmissionId, proofIds)).orderBy(desc(proofMetricSnapshots.capturedAt)) : [];
    const latestViews = new Map<string, number | null>(); for (const snapshot of snapshots) if (!latestViews.has(snapshot.proofSubmissionId)) latestViews.set(snapshot.proofSubmissionId, snapshot.views);
    const reviewed = await this.withAiReviews(proofRows);
    const analytics = summarizeAnalytics(
      rows.map(({ campaign, reservation }) => ({ id: campaign.id, title: campaign.title, status: campaign.status, currency: campaign.currency, unitPriceKobo: campaign.unitPriceKobo, targetQuantity: campaign.targetQuantity, fundedKobo: reservation?.amountKobo ?? 0, spentKobo: reservation?.consumedKobo ?? 0, refundedKobo: reservation?.releasedKobo ?? 0, createdAt: campaign.createdAt })),
      reviewed.map(({ proof, campaignId, aiReview }) => ({ campaignId, platform: proof.platform, status: proof.status, createdAt: proof.createdAt, claimedViews: proof.claimedViews, aiViews: aiReview?.assessment?.extracted?.views ?? null, metricViews: latestViews.get(proof.id) ?? null, aiDecision: aiReview?.decision ?? null, fraudRisk: aiReview?.fraudRisk ?? null })),
    );
    return { analytics: { ...analytics, currency }, campaigns: rows.map(row => row.campaign) };
  }

  async businessAnalytics(user: AuthenticatedUser) {
    const business = await this.businessFor(user.id);
    return (await this.analyticsFor(business.id)).analytics;
  }

  async askBusinessAssistant(user: AuthenticatedUser, input: { question?: unknown; history?: unknown }) {
    const question = typeof input.question === 'string' ? input.question.trim() : '';
    if (!question) throw new BadRequestException('Ask a question about your campaigns');
    if (question.length > MAX_QUESTION_LENGTH) throw new BadRequestException(`Keep your question under ${MAX_QUESTION_LENGTH} characters`);
    if (!this.ai.configured) throw new ServiceUnavailableException('The assistant is not available right now');
    const now = Date.now(); const recent = (this.assistantCalls.get(user.id) ?? []).filter(time => now - time < 10 * 60_000);
    if (recent.length >= 20) throw new ConflictException('You have asked a lot of questions in a short time. Please wait a few minutes.');
    this.assistantCalls.set(user.id, [...recent, now]);
    const business = await this.businessFor(user.id);
    const { analytics, campaigns: owned } = await this.analyticsFor(business.id);
    const briefs = owned.map(campaign => { const targeting = campaign.targeting as Record<string, unknown>; return { id: campaign.id, title: campaign.title, status: campaign.status, rewardKobo: campaign.unitPriceKobo, platforms: Array.isArray(targeting.platforms) ? targeting.platforms.map(String) : [], hashtag: typeof targeting.requiredHashtag === 'string' ? targeting.requiredHashtag : undefined, location: typeof targeting.location === 'string' ? targeting.location : undefined }; });
    try {
      const response = await this.ai.generateJson<unknown>({ system: assistantSystemPrompt, schemaName: 'campaign_answer', schema: assistantSchema, parts: [{ type: 'text', text: assistantPrompt(assistantContext(business.name, analytics, briefs), question, cleanHistory(input.history)) }] });
      return { ...sanitizeAnswer(response.data), model: response.model };
    } catch (error) {
      this.logger.warn(`Business assistant failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw new ServiceUnavailableException('The assistant could not answer right now. Please try again.');
    }
  }

  async businessCampaignDetail(user: AuthenticatedUser, campaignId: string) {
    const campaign = await this.ownedCampaign(user.id, campaignId);
    const [creatives, history] = await Promise.all([
      this.database.db.select().from(campaignCreatives).where(eq(campaignCreatives.campaignId, campaignId)).orderBy(asc(campaignCreatives.sortOrder)),
      this.database.db.select().from(campaignStatusHistory).where(eq(campaignStatusHistory.campaignId, campaignId)).orderBy(desc(campaignStatusHistory.createdAt)),
    ]);
    const applications = await this.businessCampaignApplications(user, campaignId);
    return { campaign, creatives, history, applications, results: await this.campaignResults(campaign) };
  }

  // Ends a live campaign and returns whatever was not spent. The ledger and status change commit first,
  // so no proof can be paid from money already on its way back. A failed PayPal call can then be retried.
  async closeCampaign(user: AuthenticatedUser, campaignId: string) {
    const campaign = await this.ownedCampaign(user.id, campaignId);
    if (campaign.status === 'completed') {
      const reservation = await this.database.db.query.campaignReservations.findFirst({ where: eq(campaignReservations.campaignId, campaignId) });
      if (reservation?.refundDestination === 'paypal' && reservation.refundStatus !== 'completed') return this.sendCampaignRefund(campaignId);
    }
    if (campaign.status !== 'live') throw new ConflictException('Only live campaigns can be ended');
    const business = await this.businessFor(user.id);
    const funding = await this.fundingCapture(campaignId);
    const remaining = await this.database.db.transaction(async (tx) => {
      const current = await tx.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) });
      const reservation = await tx.query.campaignReservations.findFirst({ where: eq(campaignReservations.campaignId, campaignId) });
      if (current?.status !== 'live' || !reservation) throw new ConflictException('Only live campaigns can be ended');
      const [pending] = await tx.select({ total: sql<number>`count(*)::int` }).from(proofSubmissions).innerJoin(campaignPromoters, eq(proofSubmissions.assignmentId, campaignPromoters.id))
        .where(and(eq(campaignPromoters.campaignId, campaignId), inArray(proofSubmissions.status, ['submitted', 'under_review'])));
      if (Number(pending?.total ?? 0) > 0) throw new ConflictException(`${pending.total} submitted proof${pending.total === 1 ? ' is' : 's are'} still being reviewed. You can end the campaign once they are decided.`);
      const unspent = reservation.amountKobo - reservation.consumedKobo - reservation.releasedKobo;
      const destination = funding ? 'paypal' : 'wallet';
      await tx.update(campaignReservations).set({ releasedKobo: sql`${campaignReservations.releasedKobo} + ${unspent}`, refundStatus: unspent <= 0 ? 'none' : funding ? 'pending' : 'completed', refundDestination: unspent > 0 ? destination : null, updatedAt: new Date() }).where(eq(campaignReservations.id, reservation.id));
      if (unspent > 0) {
        const target = await this.walletFor(tx, funding ? 'payment_clearing' : 'business', business.id, campaign.currency);
        const [ledger] = await tx.insert(ledgerTransactions).values({ type: 'campaign_refund', reference: campaignId, idempotencyKey: `campaign-close:${campaignId}`, metadata: { destination } }).returning();
        await tx.insert(ledgerEntries).values([
          { transactionId: ledger.id, walletId: reservation.walletId, direction: 'debit', amountKobo: unspent, currency: campaign.currency },
          { transactionId: ledger.id, walletId: target.id, direction: 'credit', amountKobo: unspent, currency: campaign.currency },
        ]);
      }
      await tx.update(campaigns).set({ status: 'completed', updatedAt: new Date() }).where(eq(campaigns.id, campaignId));
      await tx.insert(campaignStatusHistory).values({ campaignId, fromStatus: 'live', toStatus: 'completed', actorUserId: user.id, reason: 'Ended by the business' });
      return unspent;
    }, { isolationLevel: 'serializable' });
    await this.audit(user, 'campaign.closed', 'campaign', campaignId, { refundedKobo: remaining });
    const open = await this.database.db.select({ userId: promoters.userId }).from(campaignPromoters).innerJoin(promoters, eq(campaignPromoters.promoterId, promoters.id))
      .where(and(eq(campaignPromoters.campaignId, campaignId), inArray(campaignPromoters.status, ['accepted', 'active']), eq(campaignPromoters.verifiedResults, 0)));
    for (const slot of open) await this.notify(slot.userId, 'campaign_closed', 'Campaign ended', `${campaign.title} has ended and is no longer accepting proof.`, { campaignId });
    return funding && remaining > 0 ? this.sendCampaignRefund(campaignId) : this.campaign(campaignId);
  }

  private async fundingCapture(campaignId: string) {
    const attempt = await this.database.db.query.paymentAttempts.findFirst({ where: and(eq(paymentAttempts.campaignId, campaignId), eq(paymentAttempts.provider, 'paypal'), eq(paymentAttempts.status, 'success')) });
    const order = attempt?.providerResponse as { purchase_units?: Array<{ payments?: { captures?: Array<{ id: string }> } }> } | null | undefined;
    return order?.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  }

  private async sendCampaignRefund(campaignId: string) {
    const campaign = await this.campaign(campaignId);
    const reservation = await this.database.db.query.campaignReservations.findFirst({ where: eq(campaignReservations.campaignId, campaignId) });
    const captureId = await this.fundingCapture(campaignId);
    if (!reservation || !captureId) throw new ConflictException('This campaign has no PayPal payment to refund');
    let update: Partial<typeof campaignReservations.$inferInsert>;
    try {
      const refund = await this.paypal.refundCapture({ captureId, amountMinor: reservation.releasedKobo, currency: campaign.currency, requestId: `campaign-close-${campaignId}`, note: `Unspent budget from ${campaign.title.slice(0, 100)}` });
      update = refund.status === 'COMPLETED' ? { refundStatus: 'completed', refundReference: refund.id, refundError: null }
        : refund.status === 'PENDING' ? { refundStatus: 'pending', refundReference: refund.id, refundError: null }
        : { refundStatus: 'failed', refundReference: refund.id, refundError: `PayPal reported the refund as ${refund.status.toLowerCase()}` };
    } catch (error) {
      this.logger.warn(`PayPal refund failed for campaign ${campaignId}: ${error instanceof Error ? error.message : 'unknown error'}`);
      update = { refundStatus: 'failed', refundError: 'PayPal could not complete the refund. Try again shortly.' };
    }
    await this.database.db.update(campaignReservations).set({ ...update, updatedAt: new Date() }).where(eq(campaignReservations.id, reservation.id));
    if (update.refundStatus === 'completed') {
      const business = await this.database.db.query.businesses.findFirst({ where: eq(businesses.id, campaign.businessId) });
      if (business) await this.notify(business.ownerUserId, 'campaign_refunded', 'Refund sent', `${formatMinor(reservation.releasedKobo, campaign.currency)} of unspent budget from ${campaign.title} was refunded to your PayPal account.`, { campaignId });
    }
    return this.campaign(campaignId);
  }

  // What a business can see about delivery. Fraud signals and evidence files stay with admins.
  private async campaignResults(campaign: typeof campaigns.$inferSelect) {
    await this.releaseLapsedSlots(eq(campaignPromoters.campaignId, campaign.id));
    const [reservation, slots, clicks, proofRows] = await Promise.all([
      this.database.db.query.campaignReservations.findFirst({ where: eq(campaignReservations.campaignId, campaign.id) }),
      this.database.db.select({ id: campaignPromoters.id, promoterId: campaignPromoters.promoterId, status: campaignPromoters.status, targetQuantity: campaignPromoters.targetQuantity, verifiedResults: campaignPromoters.verifiedResults, joinedAt: campaignPromoters.createdAt, username: promoters.username, displayName: users.displayName })
        .from(campaignPromoters).innerJoin(promoters, eq(campaignPromoters.promoterId, promoters.id)).innerJoin(users, eq(promoters.userId, users.id))
        .where(and(eq(campaignPromoters.campaignId, campaign.id), ne(campaignPromoters.status, 'removed'))).orderBy(asc(campaignPromoters.createdAt)),
      this.database.db.select({ promoterId: trackingEvents.promoterId, total: sql<number>`count(*)::int` }).from(trackingEvents)
        .where(and(eq(trackingEvents.campaignId, campaign.id), eq(trackingEvents.eventType, 'click'))).groupBy(trackingEvents.promoterId),
      this.database.db.select({ proof: proofSubmissions, username: promoters.username, displayName: users.displayName })
        .from(proofSubmissions).innerJoin(campaignPromoters, eq(proofSubmissions.assignmentId, campaignPromoters.id)).innerJoin(promoters, eq(proofSubmissions.promoterId, promoters.id)).innerJoin(users, eq(promoters.userId, users.id))
        .where(eq(campaignPromoters.campaignId, campaign.id)).orderBy(desc(proofSubmissions.createdAt)),
    ]);
    const clicksByPromoter = new Map(clicks.map(row => [row.promoterId, Number(row.total)]));
    const proofs = await this.withAiReviews(proofRows);
    return {
      fundedKobo: reservation?.amountKobo ?? 0,
      spentKobo: reservation?.consumedKobo ?? 0,
      remainingKobo: reservation ? reservation.amountKobo - reservation.consumedKobo - reservation.releasedKobo : 0,
      refund: { status: reservation?.refundStatus ?? 'none', amountKobo: reservation?.releasedKobo ?? 0, destination: reservation?.refundDestination ?? null, reference: reservation?.refundReference ?? null, error: reservation?.refundError ?? null },
      slotsTaken: slots.reduce((total, slot) => total + slot.targetQuantity, 0),
      clicks: clicks.reduce((total, row) => total + Number(row.total), 0),
      promoters: slots.map(({ promoterId, ...slot }) => ({ ...slot, clicks: clicksByPromoter.get(promoterId) ?? 0 })),
      proofs: proofs.map(({ proof, username, displayName, aiReview }) => ({
        id: proof.id, platform: proof.platform, status: proof.status, submittedUrl: proof.submittedUrl, createdAt: proof.createdAt, username, displayName,
        ai: aiReview && { assurance: aiReview.assurance, contentMatch: aiReview.contentMatch },
      })),
    };
  }

  async businessCampaignApplications(user: AuthenticatedUser, campaignId: string) {
    await this.ownedCampaign(user.id, campaignId);
    const rows = await this.database.db.select({
      id: promoterApplications.id, status: promoterApplications.status, message: promoterApplications.message,
      createdAt: promoterApplications.createdAt, updatedAt: promoterApplications.updatedAt,
      promoterId: promoters.id, username: promoters.username, bio: promoters.bio, country: promoters.country,
      city: promoters.city, niches: promoters.niches, performanceScore: promoters.performanceScore,
      verificationStatus: promoters.verificationStatus, displayName: users.displayName,
    }).from(promoterApplications)
      .innerJoin(promoters, eq(promoterApplications.promoterId, promoters.id))
      .innerJoin(users, eq(promoters.userId, users.id))
      .where(eq(promoterApplications.campaignId, campaignId)).orderBy(desc(promoterApplications.createdAt));
    return Promise.all(rows.map(async (row) => ({ ...row, socials: await this.database.db.select({ platform: socialAccounts.platform, handle: socialAccounts.handle, audienceSize: socialAccounts.audienceSize }).from(socialAccounts).where(eq(socialAccounts.promoterId, row.promoterId)) })));
  }

  async updateCampaign(user: AuthenticatedUser, campaignId: string, input: Partial<CreateCampaign>) {
    const campaign = await this.ownedCampaign(user.id, campaignId);
    if (!['draft', 'rejected'].includes(campaign.status)) throw new ConflictException('Only draft or change-requested campaigns can be edited');
    const destinationUrl = input.destinationUrl ?? String((campaign.targeting as Record<string, unknown>).destinationUrl ?? '');
    try { new URL(destinationUrl); } catch { throw new BadRequestException('A valid destination URL is required'); }
    const unitPriceKobo = Number(input.unitPriceKobo ?? campaign.unitPriceKobo);
    const targetQuantity = Number(input.targetQuantity ?? campaign.targetQuantity);
    if (!Number.isInteger(unitPriceKobo) || unitPriceKobo < 100 || !Number.isInteger(targetQuantity) || targetQuantity < 1) throw new BadRequestException('A positive target and unit price of at least 100 kobo are required');
    if (input.targeting) this.validateCampaignTargeting(input.targeting);
    this.validateCampaignDates(input.startsAt, input.endsAt);
    const [updated] = await this.database.db.update(campaigns).set({
      title: input.title?.trim() ?? campaign.title, description: input.description?.trim() ?? campaign.description,
      conversionType: input.conversionType?.trim() ?? campaign.conversionType, unitPriceKobo, targetQuantity,
      budgetKobo: unitPriceKobo * targetQuantity, targeting: { ...(campaign.targeting as Record<string, unknown>), ...input.targeting, country: campaignCountry(input.targeting?.location ?? (campaign.targeting as Record<string, unknown>).location), objective: 'visibility', destinationUrl },
      startsAt: input.startsAt ? new Date(input.startsAt) : campaign.startsAt, endsAt: input.endsAt ? new Date(input.endsAt) : campaign.endsAt,
      status: 'draft', updatedAt: new Date(),
    }).where(eq(campaigns.id, campaignId)).returning();
    return updated;
  }

  async presignCampaignCreative(user: AuthenticatedUser, campaignId: string, input: { filename: string; contentType: string; sizeBytes: number }) {
    await this.ownedCampaign(user.id, campaignId);
    return this.storage.createCampaignUpload(user.id, campaignId, input);
  }

  async completeCampaignCreative(user: AuthenticatedUser, campaignId: string, input: { key: string; filename: string; contentType: string; sizeBytes: number; altText?: string }) {
    const campaign = await this.ownedCampaign(user.id, campaignId);
    if (!['draft', 'rejected'].includes(campaign.status)) throw new ConflictException('Campaign images or videos can no longer be changed');
    await this.storage.assertCampaignUpload(user.id, campaignId, input.key, input.contentType, input.sizeBytes);
    const [creative] = await this.database.db.insert(campaignCreatives).values({ campaignId, storageKey: input.key, originalFilename: input.filename.slice(0, 255), mimeType: input.contentType, sizeBytes: input.sizeBytes, altText: input.altText?.trim() }).returning();
    return creative;
  }

  async submitCampaign(user: AuthenticatedUser, campaignId: string) {
    const campaign = await this.ownedCampaign(user.id, campaignId);
    if (campaign.status !== 'draft' && campaign.status !== 'rejected') throw new ConflictException('Only draft or rejected campaigns can be submitted');
    const creative = await this.database.db.query.campaignCreatives.findFirst({ where: eq(campaignCreatives.campaignId, campaignId) });
    if (!creative) throw new BadRequestException('Add at least one campaign image or video before submitting');
    return this.transition(campaign, 'pending_review', user.id);
  }

  async adminCampaigns(input: { status?: string; query?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(input.page) || 1); const pageSize = Math.min(50, Math.max(1, Number(input.pageSize) || 20));
    const status = input.status?.trim() || 'pending_review'; const query = input.query?.trim();
    const filters = [sql`${campaigns.status}::text = ${status}`];
    if (query) filters.push(or(ilike(campaigns.title, `%${query}%`), ilike(businesses.name, `%${query}%`))!);
    const where = and(...filters);
    const selection = { id: campaigns.id, title: campaigns.title, status: campaigns.status, objective: sql<string>`coalesce(${campaigns.targeting}->>'objective', ${campaigns.objective})`, budgetKobo: campaigns.budgetKobo, currency: campaigns.currency, createdAt: campaigns.createdAt, updatedAt: campaigns.updatedAt, businessName: businesses.name, businessStatus: businesses.verificationStatus };
    const [items, counts] = await Promise.all([
      this.database.db.select(selection).from(campaigns).innerJoin(businesses, eq(campaigns.businessId, businesses.id)).where(where).orderBy(desc(campaigns.updatedAt)).limit(pageSize).offset((page - 1) * pageSize),
      this.database.db.select({ total: sql<number>`count(*)::int` }).from(campaigns).innerJoin(businesses, eq(campaigns.businessId, businesses.id)).where(where),
    ]);
    const total = counts[0]?.total ?? 0; return { items, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } };
  }

  async adminCampaignDetail(campaignId: string) {
    const rows = await this.database.db.select({ campaign: campaigns, business: businesses }).from(campaigns).innerJoin(businesses, eq(campaigns.businessId, businesses.id)).where(eq(campaigns.id, campaignId)).limit(1);
    if (!rows[0]) throw new NotFoundException('Campaign not found');
    const [creatives, history, audit] = await Promise.all([
      this.database.db.select({ id: campaignCreatives.id, originalFilename: campaignCreatives.originalFilename, mimeType: campaignCreatives.mimeType, sizeBytes: campaignCreatives.sizeBytes, altText: campaignCreatives.altText }).from(campaignCreatives).where(eq(campaignCreatives.campaignId, campaignId)).orderBy(asc(campaignCreatives.sortOrder)),
      this.database.db.select().from(campaignStatusHistory).where(eq(campaignStatusHistory.campaignId, campaignId)).orderBy(desc(campaignStatusHistory.createdAt)),
      this.database.db.select().from(auditLogs).where(and(eq(auditLogs.resourceType, 'campaign'), eq(auditLogs.resourceId, campaignId))).orderBy(desc(auditLogs.createdAt)),
    ]);
    return { ...rows[0], creatives, history, audit };
  }

  async campaignCreativeUrl(campaignId: string, creativeId: string) {
    const creative = await this.database.db.query.campaignCreatives.findFirst({ where: and(eq(campaignCreatives.id, creativeId), eq(campaignCreatives.campaignId, campaignId)) });
    if (!creative) throw new NotFoundException('Campaign image or video not found');
    return { url: await this.storage.createReadUrl(creative.storageKey), expiresIn: 300, mimeType: creative.mimeType };
  }

  async moderateCampaign(user: AuthenticatedUser, campaignId: string, decision: 'approve' | 'reject' | 'request_changes', reason?: string) {
    const campaign = await this.campaign(campaignId);
    if (campaign.status !== 'pending_review') throw new ConflictException('Campaign is not pending review');
    if (decision !== 'approve' && !reason?.trim()) throw new BadRequestException('A decision reason is required');
    const business = await this.database.db.query.businesses.findFirst({ where: eq(businesses.id, campaign.businessId) });
    if (decision === 'approve' && business?.verificationStatus !== 'approved') throw new ConflictException('The business must be verified before campaign approval');
    const result = await this.transition(campaign, decision === 'approve' ? 'funding_required' : 'rejected', user.id, reason);
    await this.audit(user, decision === 'request_changes' ? 'campaign.changes_requested' : `campaign.${decision}d`, 'campaign', campaignId, { reason });
    if (business) await this.notify(business.ownerUserId, 'campaign_moderated', decision === 'approve' ? 'Campaign approved' : decision === 'request_changes' ? 'Campaign changes requested' : 'Campaign rejected', decision === 'approve' ? 'Your campaign is ready for funding.' : `Your campaign needs attention: ${reason}`, { campaignId, decision });
    return result;
  }

  async pauseCampaign(user: AuthenticatedUser, campaignId: string, reason: string) {
    const campaign = await this.campaign(campaignId);
    if (campaign.status !== 'live') throw new ConflictException('Only live campaigns can be paused');
    if (!reason?.trim()) throw new BadRequestException('A pause reason is required');
    const result = await this.transition(campaign, 'paused', user.id, reason.trim());
    await this.audit(user, 'campaign.paused', 'campaign', campaignId, { reason });
    const business = await this.database.db.query.businesses.findFirst({ where: eq(businesses.id, campaign.businessId) });
    if (business) await this.notify(business.ownerUserId, 'campaign_paused', 'Campaign paused', reason.trim(), { campaignId });
    return result;
  }

  async initializeCampaignFunding(user: AuthenticatedUser, campaignId: string) {
    const campaign = await this.ownedCampaign(user.id, campaignId);
    if (campaign.status !== 'funding_required') throw new ConflictException('Campaign is not ready for funding');
    const business = await this.businessFor(user.id);
    const payer = await this.database.db.query.users.findFirst({ where: eq(users.id, user.id) });
    if (!payer) throw new NotFoundException('Business owner not found');
    const reference = `reelch-${campaign.id}-${randomBytes(8).toString('hex')}`;
    const provider = this.providerFor(campaign.currency);
    let initialized: { reference: string; authorization_url: string; access_code?: string; providerResponse: Record<string, unknown> };
    if (provider === 'paypal') {
      const returnUrl = new URL(`${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/business/wallet`);
      returnUrl.searchParams.set('campaignId', campaignId); returnUrl.searchParams.set('provider', 'paypal');
      const cancelUrl = new URL(returnUrl); cancelUrl.searchParams.set('cancelled', '1');
      const order = await this.paypal.createOrder({ reference, campaignId, title: campaign.title, amountMinor: campaign.budgetKobo, currency: campaign.currency, returnUrl: returnUrl.toString(), cancelUrl: cancelUrl.toString() });
      initialized = { reference: order.orderId, authorization_url: order.approveUrl, providerResponse: { orderId: order.orderId, status: order.order.status, internalReference: reference } };
    } else {
      const paystack = await this.paystack.initialize({ email: payer.email, amount: campaign.budgetKobo, currency: campaign.currency, reference, campaignId, businessId: business.id });
      initialized = { ...paystack, providerResponse: paystack };
    }
    try {
      await this.database.db.insert(paymentAttempts).values({ campaignId, businessId: business.id, provider, reference: initialized.reference, accessCode: initialized.access_code, amountKobo: campaign.budgetKobo, currency: campaign.currency, providerResponse: initialized.providerResponse });
    } catch (cause) {
      this.logger.error(
        `Unable to save payment attempt for campaign ${campaignId}: ${this.databaseErrorDetails(cause)}`,
        cause instanceof Error ? cause.stack : undefined,
      );
      throw new ServiceUnavailableException('Payment could not be started. Please try again.');
    }
    try {
      await this.audit(user, 'campaign.funding_initialized', 'campaign', campaignId, { provider, reference: initialized.reference, amountKobo: campaign.budgetKobo });
    } catch (cause) {
      this.logger.error(`Unable to write funding audit for campaign ${campaignId}`, cause instanceof Error ? cause.stack : undefined);
    }
    return { provider, authorizationUrl: initialized.authorization_url, reference: initialized.reference, amountKobo: campaign.budgetKobo, currency: campaign.currency };
  }

  async businessWallet(user: AuthenticatedUser) {
    const business = await this.businessFor(user.id);
    const wallet = await this.database.db.query.wallets.findFirst({ where: and(eq(wallets.ownerType, 'business'), eq(wallets.ownerId, business.id)) });
    if (!wallet) throw new NotFoundException('Business wallet not found');
    const [account, ledgerActivity, cardPayments, balanceRows] = await Promise.all([
      this.database.db.query.virtualAccounts.findFirst({ where: and(eq(virtualAccounts.businessId, business.id), eq(virtualAccounts.provider, 'paystack')) }),
      this.database.db.select({ id: ledgerTransactions.id, direction: ledgerEntries.direction, amountKobo: ledgerEntries.amountKobo, createdAt: ledgerEntries.createdAt, type: ledgerTransactions.type, reference: ledgerTransactions.reference, metadata: ledgerTransactions.metadata, campaignTitle: campaigns.title })
        .from(ledgerEntries).innerJoin(ledgerTransactions, eq(ledgerEntries.transactionId, ledgerTransactions.id))
        .leftJoin(campaigns, sql`${ledgerTransactions.reference} = ${campaigns.id}::text`)
        .where(eq(ledgerEntries.walletId, wallet.id)).orderBy(desc(ledgerEntries.createdAt)).limit(50),
      this.database.db.select({ id: paymentAttempts.id, provider: paymentAttempts.provider, currency: paymentAttempts.currency, amountKobo: paymentAttempts.amountKobo, createdAt: paymentAttempts.paidAt, updatedAt: paymentAttempts.updatedAt, reference: paymentAttempts.reference, providerResponse: paymentAttempts.providerResponse, campaignTitle: campaigns.title })
        .from(paymentAttempts).innerJoin(campaigns, eq(paymentAttempts.campaignId, campaigns.id))
        .where(and(eq(paymentAttempts.businessId, business.id), eq(paymentAttempts.status, 'success')))
        .orderBy(desc(paymentAttempts.paidAt)).limit(50),
      this.database.db.select({ balance: sql<number>`coalesce(sum(case when ${ledgerEntries.direction} = 'credit' then ${ledgerEntries.amountKobo} else -${ledgerEntries.amountKobo} end), 0)::bigint` }).from(ledgerEntries).where(eq(ledgerEntries.walletId, wallet.id)),
    ]);
    const balanceKobo = Number(balanceRows[0]?.balance ?? 0);
    const entries = [
      ...ledgerActivity.map(entry => {
        const metadata = entry.metadata as Record<string, unknown>;
        const channel = String(metadata.channel ?? '').replaceAll('_', ' ').trim();
        const isDeposit = entry.type === 'wallet_deposit';
        return {
          id: entry.id,
          direction: entry.direction,
          amountKobo: entry.amountKobo,
          currency: wallet.currency,
          createdAt: entry.createdAt,
          type: entry.type,
          reference: entry.reference,
          title: isDeposit ? 'Wallet deposit' : entry.type === 'campaign_funding' ? 'Campaign funded' : entry.type.replaceAll('_', ' '),
          description: entry.campaignTitle ?? (isDeposit ? 'Money added to your Reelch wallet' : undefined),
          source: isDeposit ? (channel ? `Paystack ${channel}` : 'Paystack bank transfer') : entry.type === 'campaign_funding' ? 'Wallet balance' : 'Reelch wallet',
        };
      }),
      ...cardPayments.map(payment => {
        const provider = payment.providerResponse as Record<string, unknown>;
        const channel = String(provider.channel ?? 'card').replaceAll('_', ' ');
        return {
          id: payment.id,
          direction: 'debit' as const,
          amountKobo: payment.amountKobo,
          currency: payment.currency,
          createdAt: payment.createdAt ?? payment.updatedAt,
          type: 'campaign_funding',
          reference: payment.reference,
          title: 'Campaign funded',
          description: payment.campaignTitle,
          source: payment.provider === 'paypal' ? 'PayPal' : `Paystack ${channel}`,
        };
      }),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 50);
    const { paymentProvider } = this.publicConfig();
    return { balanceKobo, currency: wallet.currency, paymentProvider, campaignCurrency: this.platformCurrency(), account: account ? { accountName: account.accountName, accountNumber: account.accountNumber, bankName: account.bankName, bankSlug: account.bankSlug, currency: account.currency, isActive: account.isActive } : null, entries };
  }

  async createBusinessVirtualAccount(user: AuthenticatedUser) {
    const business = await this.businessFor(user.id);
    const existing = await this.database.db.query.virtualAccounts.findFirst({ where: and(eq(virtualAccounts.businessId, business.id), eq(virtualAccounts.provider, 'paystack')) });
    if (existing) return existing;
    const owner = await this.database.db.query.users.findFirst({ where: eq(users.id, user.id) });
    if (!owner) throw new NotFoundException('Business owner not found');
    const names = owner.displayName.trim().split(/\s+/);
    const customer = await this.paystack.createCustomer({ email: owner.email, firstName: names[0] || business.name, lastName: names.slice(1).join(' ') || business.name, phone: business.phone || undefined, businessId: business.id });
    const assigned = await this.paystack.createDedicatedAccount(customer.customer_code);
    const [account] = await this.database.db.insert(virtualAccounts).values({
      businessId: business.id, providerCustomerCode: customer.customer_code, providerAccountId: String(assigned.id),
      accountName: assigned.account_name, accountNumber: assigned.account_number, bankName: assigned.bank.name,
      bankSlug: assigned.bank.slug, currency: assigned.currency,
    }).onConflictDoNothing().returning();
    return account ?? this.database.db.query.virtualAccounts.findFirst({ where: and(eq(virtualAccounts.businessId, business.id), eq(virtualAccounts.provider, 'paystack')) });
  }

  async fundCampaignFromWallet(user: AuthenticatedUser, campaignId: string) {
    const campaign = await this.ownedCampaign(user.id, campaignId);
    if (campaign.status !== 'funding_required') throw new ConflictException('Campaign is not ready for funding');
    const business = await this.businessFor(user.id);
    return this.database.db.transaction(async (tx) => {
      const businessWallet = await tx.query.wallets.findFirst({ where: and(eq(wallets.ownerType, 'business'), eq(wallets.ownerId, business.id)) });
      if (!businessWallet) throw new NotFoundException('Business wallet not found');
      if (businessWallet.currency !== campaign.currency) throw new ConflictException(`Fund this ${campaign.currency} campaign with ${this.providerFor(campaign.currency) === 'paypal' ? 'PayPal' : 'Paystack'}`);
      const balances = await tx.select({ balance: sql<number>`coalesce(sum(case when ${ledgerEntries.direction} = 'credit' then ${ledgerEntries.amountKobo} else -${ledgerEntries.amountKobo} end), 0)::bigint` }).from(ledgerEntries).where(eq(ledgerEntries.walletId, businessWallet.id));
      if (Number(balances[0]?.balance ?? 0) < campaign.budgetKobo) throw new ConflictException('Your wallet balance is not enough to fund this campaign');
      const [created] = await tx.insert(wallets).values({ ownerType: 'campaign_reserve', ownerId: campaign.id }).onConflictDoNothing().returning();
      const reserve = created ?? await tx.query.wallets.findFirst({ where: and(eq(wallets.ownerType, 'campaign_reserve'), eq(wallets.ownerId, campaign.id)) });
      if (!reserve) throw new Error('Unable to create campaign reserve wallet');
      const [transaction] = await tx.insert(ledgerTransactions).values({ type: 'campaign_funding', reference: campaign.id, idempotencyKey: `wallet-campaign:${campaign.id}` }).returning();
      await tx.insert(ledgerEntries).values([
        { transactionId: transaction.id, walletId: businessWallet.id, direction: 'debit', amountKobo: campaign.budgetKobo },
        { transactionId: transaction.id, walletId: reserve.id, direction: 'credit', amountKobo: campaign.budgetKobo },
      ]);
      await tx.insert(campaignReservations).values({ campaignId: campaign.id, walletId: reserve.id, amountKobo: campaign.budgetKobo });
      await tx.update(campaigns).set({ status: 'live', updatedAt: new Date() }).where(eq(campaigns.id, campaign.id));
      await tx.insert(campaignStatusHistory).values({ campaignId: campaign.id, fromStatus: campaign.status, toStatus: 'live', actorUserId: user.id });
      return { campaignId: campaign.id, status: 'live', transactionId: transaction.id };
    }, { isolationLevel: 'serializable' });
  }

  async processPaystackWalletDeposit(verified: PaystackVerification) {
    if (verified.status !== 'success' || !verified.customer?.customer_code || !Number.isInteger(Number(verified.amount)) || Number(verified.amount) <= 0) return { received: true };
    const account = await this.database.db.query.virtualAccounts.findFirst({ where: and(eq(virtualAccounts.provider, 'paystack'), eq(virtualAccounts.providerCustomerCode, verified.customer.customer_code), eq(virtualAccounts.isActive, true)) });
    if (!account) return { received: true };
    return this.database.db.transaction(async (tx) => {
      const idempotencyKey = `paystack-wallet:${verified.reference}`;
      const existing = await tx.query.ledgerTransactions.findFirst({ where: eq(ledgerTransactions.idempotencyKey, idempotencyKey) });
      if (existing) return { received: true, transactionId: existing.id };
      const wallet = await tx.query.wallets.findFirst({ where: and(eq(wallets.ownerType, 'business'), eq(wallets.ownerId, account.businessId)) });
      if (!wallet) throw new Error('Business wallet not found');
      const [clearingCreated] = await tx.insert(wallets).values({ ownerType: 'payment_clearing', ownerId: account.businessId }).onConflictDoNothing().returning();
      const clearing = clearingCreated ?? await tx.query.wallets.findFirst({ where: and(eq(wallets.ownerType, 'payment_clearing'), eq(wallets.ownerId, account.businessId)) });
      if (!clearing) throw new Error('Payment clearing wallet not found');
      const amountKobo = Number(verified.amount);
      const [transaction] = await tx.insert(ledgerTransactions).values({ type: 'wallet_deposit', reference: verified.reference, idempotencyKey, metadata: { provider: 'paystack', channel: verified.channel } }).onConflictDoNothing({ target: ledgerTransactions.idempotencyKey }).returning();
      if (!transaction) {
        const existing = await tx.query.ledgerTransactions.findFirst({ where: eq(ledgerTransactions.idempotencyKey, idempotencyKey) });
        return { received: true, transactionId: existing?.id };
      }
      await tx.insert(ledgerEntries).values([
        { transactionId: transaction.id, walletId: clearing.id, direction: 'debit', amountKobo, currency: verified.currency },
        { transactionId: transaction.id, walletId: wallet.id, direction: 'credit', amountKobo, currency: verified.currency },
      ]);
      await tx.insert(notifications).values({ userId: (await tx.query.businesses.findFirst({ where: eq(businesses.id, account.businessId) }))!.ownerUserId, type: 'wallet_funded', title: 'Wallet funded', body: `Your wallet received ₦${(amountKobo / 100).toLocaleString()}.`, data: { reference: verified.reference, amountKobo } });
      return { received: true, transactionId: transaction.id };
    });
  }

  async verifyCampaignFunding(user: AuthenticatedUser, campaignId: string, reference: string) {
    await this.ownedCampaign(user.id, campaignId);
    const attempt = await this.database.db.query.paymentAttempts.findFirst({ where: and(eq(paymentAttempts.campaignId, campaignId), eq(paymentAttempts.reference, reference)) });
    if (!attempt) throw new NotFoundException('Payment attempt not found');
    if (attempt.status === 'success') return { campaignId, status: 'live', reference };
    const verified = attempt.provider === 'paypal' ? await this.paypal.captureOrder(reference) : this.fromPaystack(await this.paystack.verify(reference));
    return this.finalizeFunding(reference, verified, user.id);
  }

  private fromPaystack(verified: PaystackVerification): FundingVerification {
    return { reference: verified.reference, succeeded: verified.status === 'success', status: verified.status, amountMinor: Number(verified.amount), currency: verified.currency, paidAt: verified.paid_at ?? undefined, channel: verified.channel ?? 'card', raw: verified as unknown as Record<string, unknown> };
  }

  async processPaypalWebhook(event: { id?: string; event_type?: string; resource?: Record<string, unknown> }, payloadHash: string) {
    if (!event.id || !event.event_type) return { received: true };
    const receipt = await this.storeWebhookReceipt({ provider: 'paypal', externalId: event.id, eventType: event.event_type, payloadHash });
    if (receipt?.status === 'processed') return { received: true };
    const resource = event.resource ?? {};
    try {
      if (event.event_type === 'CHECKOUT.ORDER.APPROVED' || event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        const related = (resource.supplementary_data as { related_ids?: { order_id?: string } } | undefined)?.related_ids;
        const orderId = event.event_type === 'CHECKOUT.ORDER.APPROVED' ? String(resource.id ?? '') : String(related?.order_id ?? '');
        const attempt = orderId ? await this.database.db.query.paymentAttempts.findFirst({ where: and(eq(paymentAttempts.provider, 'paypal'), eq(paymentAttempts.reference, orderId)) }) : undefined;
        if (attempt && attempt.status !== 'success') {
          const business = await this.database.db.query.businesses.findFirst({ where: eq(businesses.id, attempt.businessId) });
          if (business) await this.finalizeFunding(orderId, event.event_type === 'CHECKOUT.ORDER.APPROVED' ? await this.paypal.captureOrder(orderId) : await this.paypal.getOrder(orderId), business.ownerUserId);
        }
      } else if (event.event_type.startsWith('PAYMENT.PAYOUTS-ITEM.') || event.event_type.startsWith('PAYMENT.PAYOUTSBATCH.')) {
        const batchId = String(resource.payout_batch_id ?? (resource.batch_header as { payout_batch_id?: string } | undefined)?.payout_batch_id ?? '');
        const withdrawal = batchId ? await this.database.db.query.withdrawals.findFirst({ where: eq(withdrawals.providerReference, batchId) }) : undefined;
        if (withdrawal) await this.syncPaypalPayout(withdrawal.id);
      }
      if (receipt) await this.database.db.update(inboundWebhookEvents).set({ status: 'processed', processedAt: new Date(), attempts: sql`${inboundWebhookEvents.attempts} + 1`, lastError: null }).where(eq(inboundWebhookEvents.id, receipt.id));
    } catch (error) {
      if (receipt) await this.database.db.update(inboundWebhookEvents).set({ status: 'failed', attempts: sql`${inboundWebhookEvents.attempts} + 1`, lastError: 'PayPal event processing failed; inspect API logs' }).where(eq(inboundWebhookEvents.id, receipt.id));
      throw error;
    }
    return { received: true };
  }

  async processPaystackSuccess(reference: string) {
    const attempt = await this.database.db.query.paymentAttempts.findFirst({ where: eq(paymentAttempts.reference, reference) });
    if (!attempt || attempt.status === 'success') return { received: true };
    const business = await this.database.db.query.businesses.findFirst({ where: eq(businesses.id, attempt.businessId) });
    if (!business) throw new NotFoundException('Business not found');
    return this.finalizeFunding(reference, this.fromPaystack(await this.paystack.verify(reference)), business.ownerUserId);
  }

  async processPaystackCharge(reference: string) {
    const attempt = await this.database.db.query.paymentAttempts.findFirst({ where: eq(paymentAttempts.reference, reference) });
    if (attempt) return this.processPaystackSuccess(reference);
    return this.processPaystackWalletDeposit(await this.paystack.verify(reference));
  }

  private async finalizeFunding(reference: string, verified: FundingVerification, actorUserId: string) {
    const attempt = await this.database.db.query.paymentAttempts.findFirst({ where: eq(paymentAttempts.reference, reference) });
    if (!attempt) throw new NotFoundException('Payment attempt not found');
    const campaign = await this.campaign(attempt.campaignId);
    if (verified.reference !== reference || !verified.succeeded || verified.amountMinor !== attempt.amountKobo || verified.currency !== attempt.currency) {
      await this.database.db.update(paymentAttempts).set({ status: verified.status.toLowerCase() || 'failed', providerResponse: verified.raw, updatedAt: new Date() }).where(eq(paymentAttempts.id, attempt.id));
      throw new ConflictException('Payment has not been successfully verified for the required amount');
    }
    if (campaign.status === 'live') return { campaignId: campaign.id, status: 'live', reference };
    if (campaign.status !== 'funding_required') throw new ConflictException('Campaign is not ready for funding');
    return this.database.db.transaction(async (tx) => {
      const idempotencyKey = attempt.provider === 'paystack' ? `paystack:${reference}` : `${attempt.provider}:${reference}`;
      const existing = await tx.query.ledgerTransactions.findFirst({ where: eq(ledgerTransactions.idempotencyKey, idempotencyKey) });
      if (existing) return { campaignId: campaign.id, status: 'live', transactionId: existing.id, reference };
      const wallet = await this.walletFor(tx, 'campaign_reserve', campaign.id, campaign.currency);
      const clearing = await this.walletFor(tx, 'payment_clearing', campaign.businessId, campaign.currency);
      const [transaction] = await tx.insert(ledgerTransactions).values({ type: 'campaign_funding', reference, idempotencyKey, metadata: { provider: attempt.provider, channel: verified.channel } }).returning();
      await tx.insert(ledgerEntries).values([
        { transactionId: transaction.id, walletId: clearing.id, direction: 'debit', amountKobo: campaign.budgetKobo, currency: campaign.currency },
        { transactionId: transaction.id, walletId: wallet.id, direction: 'credit', amountKobo: campaign.budgetKobo, currency: campaign.currency },
      ]);
      await tx.insert(campaignReservations).values({ campaignId: campaign.id, walletId: wallet.id, amountKobo: campaign.budgetKobo });
      await tx.update(campaigns).set({ status: 'live', updatedAt: new Date() }).where(eq(campaigns.id, campaign.id));
      await tx.insert(campaignStatusHistory).values({ campaignId: campaign.id, fromStatus: campaign.status, toStatus: 'live', actorUserId });
      await tx.update(paymentAttempts).set({ status: 'success', paidAt: verified.paidAt ? new Date(verified.paidAt) : new Date(), providerResponse: verified.raw, updatedAt: new Date() }).where(eq(paymentAttempts.id, attempt.id));
      return { campaignId: campaign.id, status: 'live', transactionId: transaction.id, reference };
    });
  }

  async discoverCampaigns(user: AuthenticatedUser) {
    const promoter = await this.promoterFor(user.id);
    await this.releaseLapsedSlots(eq(campaignPromoters.promoterId, promoter.id));
    const opportunities = await this.database.db.select({ campaign: campaigns, businessName: businesses.name, assignmentStatus: campaignPromoters.status })
      .from(campaigns).innerJoin(businesses, eq(campaigns.businessId, businesses.id))
      .leftJoin(campaignPromoters, and(eq(campaignPromoters.campaignId, campaigns.id), eq(campaignPromoters.promoterId, promoter.id)))
      .where(eq(campaigns.status, 'live')).orderBy(desc(campaigns.createdAt));
    const niches = new Set(promoter.niches.map(value => value.toLowerCase()));
    return opportunities.filter(({ campaign, assignmentStatus }) => {
      if (assignmentStatus === 'removed') return false;
      const targeting = campaign.targeting as Record<string, unknown>;
      const category = typeof targeting.category === 'string' ? targeting.category.toLowerCase() : '';
      const categoryMatches = !category || niches.has(category);
      return categoryMatches && campaignLocationAllows(targeting.location, promoter);
    }).map(opportunity => ({ ...opportunity, promoterVerificationStatus: promoter.verificationStatus }));
  }

  async promoterCampaignDetail(user: AuthenticatedUser, campaignId: string) {
    const promoter = await this.promoterFor(user.id);
    const campaign = await this.campaign(campaignId);
    const business = await this.database.db.query.businesses.findFirst({ where: eq(businesses.id, campaign.businessId) });
    if (!business || campaign.status !== 'live') throw new NotFoundException('Live campaign not found');
    await this.releaseLapsedSlots(eq(campaignPromoters.promoterId, promoter.id));
    const [assignment, referral, creatives] = await Promise.all([
      this.database.db.query.campaignPromoters.findFirst({ where: and(eq(campaignPromoters.campaignId, campaignId), eq(campaignPromoters.promoterId, promoter.id)) }),
      this.database.db.query.referralLinks.findFirst({ where: and(eq(referralLinks.campaignId, campaignId), eq(referralLinks.promoterId, promoter.id)) }),
      this.database.db.select().from(campaignCreatives).where(eq(campaignCreatives.campaignId, campaignId)).orderBy(asc(campaignCreatives.sortOrder)),
    ]);
    const submitBy = assignment ? (await this.firstProofDeadlines([assignment])).get(assignment.id) ?? null : null;
    return { campaign, businessName: business.name, assignment, submitBy, referral, promoterVerificationStatus: promoter.verificationStatus, creatives: await Promise.all(creatives.map(async creative => ({ id: creative.id, filename: creative.originalFilename, mimeType: creative.mimeType, url: await this.storage.createReadUrl(creative.storageKey) }))) };
  }

  async joinCampaign(user: AuthenticatedUser, campaignId: string) {
    const promoter = await this.promoterFor(user.id);
    if (promoter.verificationStatus !== 'approved') throw new ForbiddenException('Your account must be verified before you can join campaigns');
    await this.releaseLapsedSlots(eq(campaignPromoters.campaignId, campaignId));
    const result = await this.database.db.transaction(async (tx) => {
      const campaign = await tx.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) });
      if (!campaign || campaign.status !== 'live') throw new ConflictException('This campaign is no longer open');
      const existing = await tx.query.campaignPromoters.findFirst({ where: and(eq(campaignPromoters.campaignId, campaignId), eq(campaignPromoters.promoterId, promoter.id)) });
      if (existing?.status === 'removed') throw new ConflictException('Your slot on this campaign was released and cannot be rejoined');
      if (existing) {
        const referral = await tx.query.referralLinks.findFirst({ where: and(eq(referralLinks.campaignId, campaignId), eq(referralLinks.promoterId, promoter.id)) });
        return { assignment: existing, referral, alreadyJoined: true };
      }
      const targeting = campaign.targeting as Record<string, unknown>;
      const category = typeof targeting.category === 'string' ? targeting.category.toLowerCase() : '';
      if (category && !promoter.niches.some(niche => niche.toLowerCase() === category)) throw new ForbiddenException('This campaign does not match your profile category');
      if (!campaignLocationAllows(targeting.location, promoter)) throw new ForbiddenException('This campaign is not available in your location');
      const allocations = await tx.select({ total: sql<number>`coalesce(sum(${campaignPromoters.targetQuantity}), 0)::int` }).from(campaignPromoters).where(and(eq(campaignPromoters.campaignId, campaignId), ne(campaignPromoters.status, 'removed')));
      if (Number(allocations[0]?.total ?? 0) >= campaign.targetQuantity) throw new ConflictException('All available campaign slots have been taken');
      const destinationUrl = String(targeting.destinationUrl ?? '');
      const [assignment] = await tx.insert(campaignPromoters).values({ campaignId, promoterId: promoter.id, targetQuantity: 1, termsVersion: campaign.termsVersion, status: 'accepted' }).returning();
      const [referral] = await tx.insert(referralLinks).values({ campaignId, promoterId: promoter.id, destinationUrl, code: randomBytes(12).toString('base64url') }).returning();
      await tx.insert(notifications).values({ userId: promoter.userId, type: 'campaign_joined', title: 'Campaign joined', body: `You can now start promoting ${campaign.title}. Submit your first proof within ${FIRST_PROOF_WINDOW_HOURS} hours to keep your slot.`, data: { campaignId, assignmentId: assignment.id } });
      return { assignment, referral, alreadyJoined: false, submitBy: firstProofDeadline(assignment.createdAt) };
    }, { isolationLevel: 'serializable' });
    await this.audit(user, 'campaign.joined', 'campaign', campaignId, { assignmentId: result.assignment.id });
    return result;
  }

  // Releases slots whose latest proof was rejected and not replaced within the resubmit window,
  // and slots whose promoter never submitted a proof within the first-proof window.
  // Runs whenever a slot's state is read, so it does not depend on a scheduled job.
  // Promoters with verified results keep their allocation, because those results are already paid for.
  private async releaseLapsedSlots(scope: SQL) {
    const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
    const release = (lapsed: SQL) => this.database.db.update(campaignPromoters).set({ status: 'removed', updatedAt: new Date() }).where(and(
      scope, inArray(campaignPromoters.status, ['accepted', 'active']), eq(campaignPromoters.verifiedResults, 0), lapsed,
      sql`exists (select 1 from campaigns c where c.id = campaign_promoters.campaign_id and c.status = 'live')`,
    )).returning();
    const rejected = await release(sql`(select p.status = 'rejected' and p.reviewed_at < ${hoursAgo(RESUBMIT_WINDOW_HOURS)}::timestamptz from proof_submissions p where p.assignment_id = campaign_promoters.id order by p.created_at desc limit 1)`);
    const idle = await release(sql`not exists (select 1 from proof_submissions p where p.assignment_id = campaign_promoters.id) and campaign_promoters.created_at < ${hoursAgo(FIRST_PROOF_WINDOW_HOURS)}::timestamptz`);
    const released = [
      ...rejected.map(slot => ({ slot, reason: 'resubmit_window', body: `Your ${RESUBMIT_WINDOW_HOURS} hours to resubmit ended, so your slot was released for another promoter.` })),
      ...idle.map(slot => ({ slot, reason: 'first_proof_window', body: `No proof was submitted within ${FIRST_PROOF_WINDOW_HOURS} hours of joining, so your slot was released for another promoter.` })),
    ];
    for (const { slot, reason, body } of released) {
      await this.database.db.update(referralLinks).set({ isActive: false }).where(and(eq(referralLinks.campaignId, slot.campaignId), eq(referralLinks.promoterId, slot.promoterId)));
      const promoter = await this.database.db.query.promoters.findFirst({ where: eq(promoters.id, slot.promoterId) });
      if (promoter) await this.notify(promoter.userId, 'campaign_slot_released', 'Campaign slot released', body, { campaignId: slot.campaignId, assignmentId: slot.id });
      await this.systemAudit(null, 'assignment.slot_released', 'campaign_promoter', slot.id, { campaignId: slot.campaignId, reason });
    }
  }

  // The first-proof deadline only applies until a promoter has submitted something.
  private async firstProofDeadlines(rows: Array<typeof campaignPromoters.$inferSelect>) {
    const open = rows.filter(row => ['accepted', 'active'].includes(row.status) && row.verifiedResults === 0);
    if (!open.length) return new Map<string, Date>();
    const submitted = await this.database.db.selectDistinct({ assignmentId: proofSubmissions.assignmentId }).from(proofSubmissions).where(inArray(proofSubmissions.assignmentId, open.map(row => row.id)));
    const hasProof = new Set(submitted.map(row => row.assignmentId));
    return new Map(open.filter(row => !hasProof.has(row.id)).map(row => [row.id, firstProofDeadline(row.createdAt)]));
  }

  async apply(user: AuthenticatedUser, campaignId: string, _message?: string) {
    return this.joinCampaign(user, campaignId);
  }

  async decideApplication(user: AuthenticatedUser, campaignId: string, applicationId: string, decision: 'accept' | 'reject', targetQuantity?: number) {
    if (decision === 'accept') return this.acceptPromoter(user, campaignId, applicationId, Number(targetQuantity));
    await this.ownedCampaign(user.id, campaignId);
    const [application] = await this.database.db.update(promoterApplications).set({ status: 'rejected', updatedAt: new Date() })
      .where(and(eq(promoterApplications.id, applicationId), eq(promoterApplications.campaignId, campaignId), eq(promoterApplications.status, 'applied'))).returning();
    if (!application) throw new NotFoundException('Active application not found');
    const promoter = await this.database.db.query.promoters.findFirst({ where: eq(promoters.id, application.promoterId) });
    if (promoter) await this.notify(promoter.userId, 'application_updated', 'Campaign application updated', 'The business did not select your application for this campaign.', { campaignId, applicationId, decision });
    return application;
  }

  async acceptPromoter(user: AuthenticatedUser, campaignId: string, applicationId: string, targetQuantity: number) {
    const campaign = await this.ownedCampaign(user.id, campaignId);
    if (campaign.status !== 'live') throw new ConflictException('Only live campaigns can accept promoters');
    const application = await this.database.db.query.promoterApplications.findFirst({ where: and(eq(promoterApplications.id, applicationId), eq(promoterApplications.campaignId, campaignId)) });
    if (!application || application.status !== 'applied') throw new NotFoundException('Active application not found');
    if (!Number.isInteger(targetQuantity) || targetQuantity < 1) throw new BadRequestException('A positive target is required');
    await this.releaseLapsedSlots(eq(campaignPromoters.campaignId, campaignId));
    const allocations = await this.database.db.select({ total: sql<number>`coalesce(sum(${campaignPromoters.targetQuantity}), 0)::int` }).from(campaignPromoters).where(and(eq(campaignPromoters.campaignId, campaignId), ne(campaignPromoters.status, 'removed')));
    const remaining = campaign.targetQuantity - Number(allocations[0]?.total ?? 0);
    if (targetQuantity > remaining) throw new ConflictException(`Only ${Math.max(0, remaining)} campaign results remain unallocated`);
    const destinationUrl = String((campaign.targeting as Record<string, unknown>).destinationUrl ?? '');
    return this.database.db.transaction(async (tx) => {
      await tx.update(promoterApplications).set({ status: 'accepted', updatedAt: new Date() }).where(eq(promoterApplications.id, applicationId));
      const [assignment] = await tx.insert(campaignPromoters).values({ campaignId, promoterId: application.promoterId, targetQuantity, termsVersion: campaign.termsVersion }).returning();
      const [referral] = await tx.insert(referralLinks).values({ campaignId, promoterId: application.promoterId, destinationUrl, code: randomBytes(12).toString('base64url') }).returning();
      const selectedPromoter = await tx.query.promoters.findFirst({ where: eq(promoters.id, application.promoterId) });
      if (selectedPromoter) await tx.insert(notifications).values({ userId: selectedPromoter.userId, type: 'application_updated', title: 'You were selected', body: `Your application for ${campaign.title} was accepted.`, data: { campaignId, applicationId } });
      return { assignment, referral };
    });
  }

  async followReferral(code: string, ip?: string, userAgent?: string) {
    const referral = await this.database.db.query.referralLinks.findFirst({ where: and(eq(referralLinks.code, code), eq(referralLinks.isActive, true)) });
    if (!referral) throw new NotFoundException('Referral link not found');
    await this.database.db.insert(trackingEvents).values({
      campaignId: referral.campaignId, promoterId: referral.promoterId, referralId: referral.id, eventType: 'click',
      ipHash: ip ? this.hash(ip) : undefined, userAgentHash: userAgent ? this.hash(userAgent) : undefined,
    });
    return referral.destinationUrl;
  }

  async recordConversion(input: { referralCode: string; externalReference: string; conversionType: string }) {
    if (!input.externalReference || !input.referralCode) throw new BadRequestException('referralCode and externalReference are required');
    const referral = await this.database.db.query.referralLinks.findFirst({ where: eq(referralLinks.code, input.referralCode) });
    if (!referral) throw new NotFoundException('Referral not found');
    return this.database.db.transaction(async (tx) => {
      const campaign = await tx.query.campaigns.findFirst({ where: eq(campaigns.id, referral.campaignId) });
      const assignment = await tx.query.campaignPromoters.findFirst({ where: and(eq(campaignPromoters.campaignId, referral.campaignId), eq(campaignPromoters.promoterId, referral.promoterId)) });
      const reservation = await tx.query.campaignReservations.findFirst({ where: eq(campaignReservations.campaignId, referral.campaignId) });
      const [conversion] = await tx.insert(conversions).values({
        campaignId: referral.campaignId, promoterId: referral.promoterId, referralId: referral.id,
        externalReference: input.externalReference, conversionType: input.conversionType,
        status: 'detected',
      }).onConflictDoNothing().returning();
      if (!conversion) return tx.query.conversions.findFirst({ where: eq(conversions.externalReference, input.externalReference) });
      const baseEligible = Boolean(campaign?.status === 'live' && campaign.conversionType === input.conversionType && assignment && ['accepted', 'active'].includes(assignment.status) && reservation);
      const [claimedReservation] = baseEligible && campaign && reservation
        ? await tx.update(campaignReservations).set({ consumedKobo: sql`${campaignReservations.consumedKobo} + ${campaign.unitPriceKobo}`, updatedAt: new Date() }).where(and(
          eq(campaignReservations.id, reservation.id),
          sql`${campaignReservations.amountKobo} - ${campaignReservations.consumedKobo} - ${campaignReservations.releasedKobo} >= ${campaign.unitPriceKobo}`,
        )).returning()
        : [];
      const billable = Boolean(claimedReservation);
      const rejectionReason = billable ? undefined : 'Campaign, conversion type, assignment, or reserved funds are not eligible';
      const [finalConversion] = await tx.update(conversions).set({ status: billable ? 'billable' : 'rejected', verifiedAt: billable ? new Date() : undefined, rejectionReason, updatedAt: new Date() }).where(eq(conversions.id, conversion.id)).returning();
      await tx.insert(verificationResults).values({ conversionId: conversion.id, outcome: billable ? 'verified' : 'rejected', checks: { liveCampaign: campaign?.status === 'live', conversionTypeMatches: campaign?.conversionType === input.conversionType, activeAssignment: Boolean(assignment), fundsAtomicallyClaimed: billable } });
      if (!billable || !campaign || !assignment || !reservation) return finalConversion;
      const promoterWallet = await tx.query.wallets.findFirst({ where: and(eq(wallets.ownerType, 'promoter'), eq(wallets.ownerId, referral.promoterId)) });
      if (!promoterWallet) throw new Error('Promoter wallet not found');
      const [ledgerTransaction] = await tx.insert(ledgerTransactions).values({ type: 'promoter_earning', reference: conversion.id, idempotencyKey: `conversion:${conversion.id}` }).returning();
      await tx.insert(ledgerEntries).values([
        { transactionId: ledgerTransaction.id, walletId: reservation.walletId, direction: 'debit', amountKobo: campaign.unitPriceKobo },
        { transactionId: ledgerTransaction.id, walletId: promoterWallet.id, direction: 'credit', amountKobo: campaign.unitPriceKobo },
      ]);
      await tx.update(campaigns).set({ verifiedQuantity: sql`${campaigns.verifiedQuantity} + 1`, updatedAt: new Date() }).where(eq(campaigns.id, campaign.id));
      await tx.update(campaignPromoters).set({ verifiedResults: sql`${campaignPromoters.verifiedResults} + 1`, status: 'active', updatedAt: new Date() }).where(eq(campaignPromoters.id, assignment.id));
      return finalConversion;
    });
  }

  async promoterWorkspace(user: AuthenticatedUser) {
    const promoter = await this.promoterFor(user.id);
    await this.releaseLapsedSlots(eq(campaignPromoters.promoterId, promoter.id));
    const assignments = await this.database.db.select({ assignment: campaignPromoters, campaign: campaigns, businessName: businesses.name, referralCode: referralLinks.code, destinationUrl: referralLinks.destinationUrl })
      .from(campaignPromoters).innerJoin(campaigns, eq(campaignPromoters.campaignId, campaigns.id)).innerJoin(businesses, eq(campaigns.businessId, businesses.id))
      .leftJoin(referralLinks, and(eq(referralLinks.campaignId, campaigns.id), eq(referralLinks.promoterId, promoter.id)))
      .where(eq(campaignPromoters.promoterId, promoter.id)).orderBy(desc(campaignPromoters.updatedAt));
    const applications = await this.database.db.select({ application: promoterApplications, campaign: campaigns, businessName: businesses.name })
      .from(promoterApplications).innerJoin(campaigns, eq(promoterApplications.campaignId, campaigns.id)).innerJoin(businesses, eq(campaigns.businessId, businesses.id))
      .where(eq(promoterApplications.promoterId, promoter.id)).orderBy(desc(promoterApplications.updatedAt));
    const deadlines = await this.firstProofDeadlines(assignments.map(row => row.assignment));
    return { promoter, assignments: assignments.map(row => ({ ...row, submitBy: deadlines.get(row.assignment.id) ?? null })), applications, earnings: await this.promoterBalance(promoter.id, this.platformCurrency()) };
  }

  private async promoterBalance(promoterId: string, currency: string) {
    const entries = await this.database.db.select({ direction: ledgerEntries.direction, amountKobo: ledgerEntries.amountKobo, createdAt: ledgerEntries.createdAt, type: ledgerTransactions.type, reference: ledgerTransactions.reference })
      .from(ledgerEntries).innerJoin(wallets, eq(ledgerEntries.walletId, wallets.id)).innerJoin(ledgerTransactions, eq(ledgerEntries.transactionId, ledgerTransactions.id))
      .where(and(eq(wallets.ownerType, 'promoter'), eq(wallets.ownerId, promoterId), eq(wallets.currency, currency))).orderBy(desc(ledgerEntries.createdAt));
    const availableKobo = entries.reduce((sum, entry) => sum + (entry.direction === 'credit' ? entry.amountKobo : -entry.amountKobo), 0);
    return { availableKobo, currency, entries };
  }

  async promoterEarnings(user: AuthenticatedUser) {
    const promoter = await this.promoterFor(user.id);
    const currency = this.platformCurrency();
    // Without a public webhook URL (local demos), refresh in-flight PayPal payouts on read.
    const pending = await this.database.db.select({ id: withdrawals.id }).from(withdrawals).where(and(eq(withdrawals.promoterId, promoter.id), eq(withdrawals.status, 'processing'), sql`${withdrawals.providerReference} is not null`)).limit(5);
    await Promise.all(pending.map(row => this.syncPaypalPayout(row.id).catch(() => undefined)));
    const [balance, account, history] = await Promise.all([
      this.promoterBalance(promoter.id, currency),
      this.database.db.query.payoutAccounts.findFirst({ where: and(eq(payoutAccounts.promoterId, promoter.id), eq(payoutAccounts.provider, 'paypal'), eq(payoutAccounts.isDefault, true)) }),
      this.database.db.select().from(withdrawals).where(eq(withdrawals.promoterId, promoter.id)).orderBy(desc(withdrawals.createdAt)).limit(50),
    ]);
    return { ...balance, paymentProvider: this.providerFor(currency), minimumWithdrawalKobo: this.minimumWithdrawal(currency), payoutAccount: account ? { id: account.id, provider: account.provider, email: account.providerRecipientCode } : null, withdrawals: history };
  }

  // ---- Connected social accounts (TikTok) ----

  async promoterSocialConnections(user: AuthenticatedUser) {
    const promoter = await this.promoterFor(user.id);
    const rows = await this.database.db.select().from(socialConnections).where(and(eq(socialConnections.promoterId, promoter.id), eq(socialConnections.status, 'active')));
    return {
      tiktok: { available: this.tiktok.configured },
      connections: rows.map(row => ({ provider: row.provider, username: row.username, scopes: row.scopes, connectedAt: row.createdAt, lastSyncedAt: row.lastSyncedAt })),
    };
  }

  async tiktokConnectUrl(user: AuthenticatedUser) {
    await this.promoterFor(user.id);
    if (!this.tiktok.configured) throw new ServiceUnavailableException('Connecting TikTok is not available right now');
    return { url: this.tiktok.authorizeUrl(createOAuthState(user.id, 'tiktok')) };
  }

  // TikTok sends the browser back here. Every outcome redirects to the promoter's profile with a status.
  async completeTiktokConnection(query: { code?: string; state?: string; error?: string; error_description?: string }) {
    const back = (status: string) => `${(process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/promoter/profile?tiktok=${status}`;
    if (query.error) return back(query.error === 'access_denied' ? 'cancelled' : 'error');
    const state = query.state ? readOAuthState(query.state, 'tiktok') : null;
    if (!state || !query.code) return back('expired');
    try {
      const promoter = await this.promoterFor(state.userId);
      const tokens = await this.tiktok.exchangeCode(query.code);
      if (!TIKTOK_SCOPES.every(scope => tokens.scopes.includes(scope))) return back('missing-permission');
      const profile = await this.tiktok.userInfo(tokens.accessToken).catch(() => ({ openId: tokens.openId, displayName: 'TikTok account' }));
      const openId = profile.openId || tokens.openId;
      const owner = await this.database.db.query.socialConnections.findFirst({ where: and(eq(socialConnections.provider, 'tiktok'), eq(socialConnections.providerUserId, openId)) });
      if (owner && owner.promoterId !== promoter.id && owner.status === 'active') return back('in-use');
      const values = { providerUserId: openId, username: profile.displayName, accessTokenEncrypted: seal(tokens.accessToken), refreshTokenEncrypted: tokens.refreshToken ? seal(tokens.refreshToken) : null, tokenExpiresAt: tokens.expiresAt, scopes: tokens.scopes, status: 'active', updatedAt: new Date() };
      if (owner && owner.promoterId !== promoter.id) await this.database.db.delete(socialConnections).where(eq(socialConnections.id, owner.id));
      await this.database.db.insert(socialConnections).values({ promoterId: promoter.id, provider: 'tiktok', ...values })
        .onConflictDoUpdate({ target: [socialConnections.promoterId, socialConnections.provider], set: values });
      await this.systemAudit(null, 'social.tiktok_connected', 'promoter', promoter.id, { openId });
      return back('connected');
    } catch (error) {
      this.logger.warn(`TikTok connection failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      return back('error');
    }
  }

  async disconnectTiktok(user: AuthenticatedUser) {
    const promoter = await this.promoterFor(user.id);
    const connection = await this.database.db.query.socialConnections.findFirst({ where: and(eq(socialConnections.promoterId, promoter.id), eq(socialConnections.provider, 'tiktok')) });
    if (!connection) return { disconnected: true };
    if (connection.accessTokenEncrypted) await this.tiktok.revoke(openSealed(connection.accessTokenEncrypted)).catch(() => undefined);
    await this.database.db.delete(socialConnections).where(eq(socialConnections.id, connection.id));
    await this.audit(user, 'social.tiktok_disconnected', 'promoter', promoter.id);
    return { disconnected: true };
  }

  // A usable TikTok access token for this promoter, refreshed when it is about to expire.
  private async tiktokAccessToken(promoterId: string) {
    if (!this.tiktok.configured) return undefined;
    const connection = await this.database.db.query.socialConnections.findFirst({ where: and(eq(socialConnections.promoterId, promoterId), eq(socialConnections.provider, 'tiktok'), eq(socialConnections.status, 'active')) });
    if (!connection?.accessTokenEncrypted) return undefined;
    try {
      if (connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() > Date.now() + 5 * 60_000) return openSealed(connection.accessTokenEncrypted);
      if (!connection.refreshTokenEncrypted) return undefined;
      const tokens = await this.tiktok.refresh(openSealed(connection.refreshTokenEncrypted));
      await this.database.db.update(socialConnections).set({ accessTokenEncrypted: seal(tokens.accessToken), refreshTokenEncrypted: tokens.refreshToken ? seal(tokens.refreshToken) : connection.refreshTokenEncrypted, tokenExpiresAt: tokens.expiresAt, updatedAt: new Date() }).where(eq(socialConnections.id, connection.id));
      return tokens.accessToken;
    } catch (error) {
      this.logger.warn(`TikTok token unavailable for promoter ${promoterId}: ${error instanceof Error ? error.message : 'unknown error'}`);
      if (error instanceof TiktokApiError) await this.database.db.update(socialConnections).set({ status: 'expired', updatedAt: new Date() }).where(eq(socialConnections.id, connection.id));
      return undefined;
    }
  }

  async setPaypalPayoutAccount(user: AuthenticatedUser, input: { email: string }) {
    const promoter = await this.promoterFor(user.id);
    const email = input.email?.trim().toLowerCase();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Enter the email address of your PayPal account');
    const account = await this.database.db.transaction(async (tx) => {
      await tx.update(payoutAccounts).set({ isDefault: false, updatedAt: new Date() }).where(and(eq(payoutAccounts.promoterId, promoter.id), eq(payoutAccounts.provider, 'paypal')));
      const existing = await tx.query.payoutAccounts.findFirst({ where: and(eq(payoutAccounts.provider, 'paypal'), eq(payoutAccounts.providerRecipientCode, email)) });
      if (existing && existing.promoterId !== promoter.id) throw new ConflictException('This PayPal email is linked to another promoter');
      if (existing) { const [updated] = await tx.update(payoutAccounts).set({ isDefault: true, updatedAt: new Date() }).where(eq(payoutAccounts.id, existing.id)).returning(); return updated; }
      const [created] = await tx.insert(payoutAccounts).values({ promoterId: promoter.id, provider: 'paypal', bankCode: 'paypal', accountLast4: '', accountName: email, providerRecipientCode: email }).returning();
      return created;
    });
    await this.audit(user, 'payout_account.paypal_linked', 'payout_account', account.id);
    return { id: account.id, provider: 'paypal', email };
  }

  private minimumWithdrawal(currency: string) { return currency === 'NGN' ? 100_000 : Number(process.env.PAYPAL_MIN_PAYOUT_MINOR ?? 100); }

  async flagConversion(user: AuthenticatedUser, conversionId: string, rule: string, riskScore: number) {
    if (!rule || !Number.isInteger(riskScore) || riskScore < 0 || riskScore > 100) throw new BadRequestException('Rule and risk score from 0 to 100 are required');
    const [flag] = await this.database.db.insert(fraudFlags).values({ conversionId, rule, riskScore }).returning();
    await this.audit(user, 'conversion.flagged', 'conversion', conversionId, { rule, riskScore });
    return flag;
  }

  async addPayoutAccount(user: AuthenticatedUser, input: { provider: string; bankCode: string; accountLast4: string; accountName: string; providerRecipientCode: string }) {
    const promoter = await this.promoterFor(user.id);
    if (!input.provider || !input.bankCode || !/^\d{4}$/.test(input.accountLast4) || !input.accountName || !input.providerRecipientCode) {
      throw new BadRequestException('Verified provider recipient details and four account-ending digits are required');
    }
    const [account] = await this.database.db.insert(payoutAccounts).values({ promoterId: promoter.id, ...input }).returning();
    await this.audit(user, 'payout_account.added', 'payout_account', account.id);
    return account;
  }

  async requestWithdrawal(user: AuthenticatedUser, input: { payoutAccountId: string; amountKobo: number }, idempotencyKey: string) {
    const currency = this.platformCurrency();
    const minimum = this.minimumWithdrawal(currency);
    if (!idempotencyKey || !Number.isInteger(input.amountKobo) || input.amountKobo < minimum) {
      throw new BadRequestException(`Idempotency-Key and a withdrawal of at least ${(minimum / 100).toFixed(2)} ${currency} are required`);
    }
    const promoter = await this.promoterFor(user.id);
    const withdrawal = await this.holdWithdrawal(promoter.id, input.payoutAccountId, input.amountKobo, currency, idempotencyKey);
    const account = await this.database.db.query.payoutAccounts.findFirst({ where: eq(payoutAccounts.id, withdrawal.payoutAccountId) });
    // PayPal withdrawals settle immediately; other rails wait for an administrator.
    if (account?.provider === 'paypal' && withdrawal.status === 'requested') return this.sendPaypalPayout(withdrawal.id, user.id);
    return withdrawal;
  }

  private holdWithdrawal(promoterId: string, payoutAccountId: string, amountKobo: number, currency: string, idempotencyKey: string) {
    return this.database.db.transaction(async (tx) => {
      const existing = await tx.query.withdrawals.findFirst({ where: eq(withdrawals.idempotencyKey, idempotencyKey) });
      if (existing) return existing;
      const account = await tx.query.payoutAccounts.findFirst({ where: and(eq(payoutAccounts.id, payoutAccountId), eq(payoutAccounts.promoterId, promoterId)) });
      if (!account) throw new NotFoundException('Payout account not found');
      const promoterWallet = await tx.query.wallets.findFirst({ where: and(eq(wallets.ownerType, 'promoter'), eq(wallets.ownerId, promoterId), eq(wallets.currency, currency)) });
      if (!promoterWallet) throw new NotFoundException('Promoter wallet not found');
      const balanceRows = await tx.select({ balance: sql<number>`coalesce(sum(case when ${ledgerEntries.direction} = 'credit' then ${ledgerEntries.amountKobo} else -${ledgerEntries.amountKobo} end), 0)::bigint` }).from(ledgerEntries).where(eq(ledgerEntries.walletId, promoterWallet.id));
      const balance = Number(balanceRows[0]?.balance ?? 0);
      if (balance < amountKobo) throw new ConflictException('Insufficient available earnings');
      const clearing = await this.walletFor(tx, 'payout_clearing', promoterId, currency);
      const feeKobo = 0;
      const [withdrawal] = await tx.insert(withdrawals).values({ promoterId, payoutAccountId: account.id, amountKobo, feeKobo, netAmountKobo: amountKobo - feeKobo, currency, idempotencyKey }).returning();
      const [transaction] = await tx.insert(ledgerTransactions).values({ type: 'withdrawal_hold', reference: withdrawal.id, idempotencyKey: `withdrawal-hold:${withdrawal.id}` }).returning();
      await tx.insert(ledgerEntries).values([
        { transactionId: transaction.id, walletId: promoterWallet.id, direction: 'debit', amountKobo, currency },
        { transactionId: transaction.id, walletId: clearing.id, direction: 'credit', amountKobo, currency },
      ]);
      return withdrawal;
    }, { isolationLevel: 'serializable' });
  }

  async sendPaypalPayout(withdrawalId: string, actorUserId: string | null) {
    const [claimed] = await this.database.db.update(withdrawals).set({ status: 'processing', processedBy: actorUserId, updatedAt: new Date() })
      .where(and(eq(withdrawals.id, withdrawalId), inArray(withdrawals.status, ['requested', 'reviewing']))).returning();
    if (!claimed) throw new ConflictException('Withdrawal is not awaiting payout');
    const account = await this.database.db.query.payoutAccounts.findFirst({ where: eq(payoutAccounts.id, claimed.payoutAccountId) });
    if (account?.provider !== 'paypal') throw new ConflictException('Withdrawal is not linked to a PayPal account');
    try {
      // The withdrawal id is the sender_batch_id, so PayPal rejects accidental duplicates.
      const batchId = await this.paypal.createPayout({ senderBatchId: claimed.id, receiver: account.providerRecipientCode, amountMinor: claimed.netAmountKobo, currency: claimed.currency, note: 'Your verified Reelch campaign earnings' });
      const [updated] = await this.database.db.update(withdrawals).set({ providerReference: batchId, updatedAt: new Date() }).where(eq(withdrawals.id, claimed.id)).returning();
      await this.systemAudit(actorUserId, 'withdrawal.paypal_payout_sent', 'withdrawal', claimed.id, { batchId });
      return updated;
    } catch (error) {
      // Leave it reviewable rather than reversing: the payout may still have reached PayPal.
      await this.database.db.update(withdrawals).set({ status: 'reviewing', failureReason: error instanceof Error ? error.message.slice(0, 300) : 'PayPal payout failed', updatedAt: new Date() }).where(eq(withdrawals.id, claimed.id));
      throw error;
    }
  }

  async syncPaypalPayout(withdrawalId: string) {
    const withdrawal = await this.database.db.query.withdrawals.findFirst({ where: eq(withdrawals.id, withdrawalId) });
    if (!withdrawal?.providerReference) throw new NotFoundException('PayPal payout not found');
    if (withdrawal.status !== 'processing') return withdrawal;
    const batch = await this.paypal.getPayout(withdrawal.providerReference);
    const item = batch.items?.[0];
    const status = item?.transaction_status ?? batch.batch_header.batch_status;
    if (status === 'SUCCESS') return this.settleWithdrawal(null, withdrawal.id, { outcome: 'paid', providerReference: item?.transaction_id ?? withdrawal.providerReference });
    if (['FAILED', 'RETURNED', 'BLOCKED', 'REFUNDED', 'REVERSED', 'DENIED'].includes(status)) {
      return this.settleWithdrawal(null, withdrawal.id, { outcome: 'failed', providerReference: withdrawal.providerReference, reason: item?.errors?.message ?? `PayPal reported ${status.toLowerCase()}` });
    }
    return withdrawal;
  }

  async processWithdrawal(user: AuthenticatedUser, withdrawalId: string, input: { outcome: 'paid' | 'failed'; providerReference?: string; reason?: string }) {
    if (input.outcome === 'paid' && !input.providerReference) throw new BadRequestException('Provider reference is required');
    if (input.outcome === 'failed' && !input.reason) throw new BadRequestException('Failure reason is required');
    return this.settleWithdrawal(user.id, withdrawalId, input);
  }

  private async settleWithdrawal(actorUserId: string | null, withdrawalId: string, input: { outcome: 'paid' | 'failed'; providerReference?: string; reason?: string }) {
    const result = await this.database.db.transaction(async (tx) => {
      const [withdrawal] = await tx.update(withdrawals).set({
        status: input.outcome,
        providerReference: input.providerReference,
        failureReason: input.reason,
        processedBy: actorUserId,
        processedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(withdrawals.id, withdrawalId), inArray(withdrawals.status, ['requested', 'reviewing', 'processing']))).returning();
      if (!withdrawal) throw new ConflictException('Withdrawal has already been processed');
      if (input.outcome === 'failed') {
        const promoterWallet = await tx.query.wallets.findFirst({ where: and(eq(wallets.ownerType, 'promoter'), eq(wallets.ownerId, withdrawal.promoterId), eq(wallets.currency, withdrawal.currency)) });
        const clearing = await tx.query.wallets.findFirst({ where: and(eq(wallets.ownerType, 'payout_clearing'), eq(wallets.ownerId, withdrawal.promoterId), eq(wallets.currency, withdrawal.currency)) });
        if (!promoterWallet || !clearing) throw new Error('Withdrawal wallets not found');
        const [reversal] = await tx.insert(ledgerTransactions).values({ type: 'withdrawal_reversal', reference: withdrawal.id, idempotencyKey: `withdrawal-reversal:${withdrawal.id}` }).returning();
        await tx.insert(ledgerEntries).values([
          { transactionId: reversal.id, walletId: clearing.id, direction: 'debit', amountKobo: withdrawal.amountKobo, currency: withdrawal.currency },
          { transactionId: reversal.id, walletId: promoterWallet.id, direction: 'credit', amountKobo: withdrawal.amountKobo, currency: withdrawal.currency },
        ]);
      }
      return withdrawal;
    }, { isolationLevel: 'serializable' });
    await this.systemAudit(actorUserId, `withdrawal.${input.outcome}`, 'withdrawal', result.id, { providerReference: input.providerReference, reason: input.reason });
    const promoter = await this.database.db.query.promoters.findFirst({ where: eq(promoters.id, result.promoterId) });
    if (promoter) await this.notify(promoter.userId, 'withdrawal_updated', `Withdrawal ${input.outcome}`, input.outcome === 'paid' ? 'Your withdrawal has been processed.' : `Your withdrawal could not be processed: ${input.reason}`, { withdrawalId, outcome: input.outcome });
    return result;
  }

  async createDispute(user: AuthenticatedUser, input: { campaignId?: string; conversionId?: string; subject: string; description: string }) {
    if (!input.subject?.trim() || input.description?.trim().length < 20 || (!input.campaignId && !input.conversionId)) throw new BadRequestException('Subject, detailed description, and a campaign or conversion are required');
    const [dispute] = await this.database.db.insert(disputes).values({ openedByUserId: user.id, campaignId: input.campaignId, conversionId: input.conversionId, subject: input.subject.trim(), description: input.description.trim() }).returning();
    await this.audit(user, 'dispute.opened', 'dispute', dispute.id);
    return dispute;
  }

  async addDisputeEvidence(user: AuthenticatedUser, disputeId: string, input: { kind: string; statement?: string; storageKey?: string }) {
    const dispute = await this.database.db.query.disputes.findFirst({ where: eq(disputes.id, disputeId) });
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (dispute.openedByUserId !== user.id && !user.roles.includes('admin')) throw new ForbiddenException('You cannot add evidence to this dispute');
    if (!input.kind || (!input.statement && !input.storageKey)) throw new BadRequestException('Evidence content is required');
    const [evidence] = await this.database.db.insert(disputeEvidence).values({ disputeId, submittedByUserId: user.id, ...input }).returning();
    return evidence;
  }

  async resolveDispute(user: AuthenticatedUser, disputeId: string, input: { decision: 'resolved' | 'rejected'; resolution: string }) {
    if (!input.resolution?.trim()) throw new BadRequestException('A resolution reason is required');
    const [dispute] = await this.database.db.update(disputes).set({ status: input.decision, resolution: input.resolution.trim(), assignedAdminId: user.id, resolvedAt: new Date(), updatedAt: new Date() }).where(and(eq(disputes.id, disputeId), inArray(disputes.status, ['open', 'evidence_requested', 'under_review']))).returning();
    if (!dispute) throw new NotFoundException('Open dispute not found');
    await this.audit(user, `dispute.${input.decision}`, 'dispute', disputeId, { resolution: input.resolution });
    await this.notify(dispute.openedByUserId, 'dispute_resolved', 'Dispute decision available', input.resolution, { disputeId, decision: input.decision });
    return dispute;
  }

  async presignProof(user: AuthenticatedUser, assignmentId: string, input: { filename: string; contentType: string; sizeBytes: number }) {
    const promoter = await this.promoterFor(user.id);
    const assignment = await this.database.db.query.campaignPromoters.findFirst({ where: and(eq(campaignPromoters.id, assignmentId), eq(campaignPromoters.promoterId, promoter.id)) });
    if (!assignment) throw new NotFoundException('Campaign assignment not found');
    await this.releaseLapsedSlots(eq(campaignPromoters.id, assignmentId));
    const current = await this.database.db.query.campaignPromoters.findFirst({ where: eq(campaignPromoters.id, assignmentId) });
    if (current?.status === 'removed') throw new ConflictException('Your time to submit proof ended and this slot was released');
    return this.storage.createProofUpload(user.id, assignmentId, input);
  }

  async submitProof(user: AuthenticatedUser, assignmentId: string, input: { platform: string; submittedUrl?: string; storageKey?: string; filename?: string; contentType?: string; sizeBytes?: number; claimedViews?: number }) {
    const promoter = await this.promoterFor(user.id);
    await this.releaseLapsedSlots(and(eq(campaignPromoters.id, assignmentId), eq(campaignPromoters.promoterId, promoter.id))!);
    const assignment = await this.database.db.query.campaignPromoters.findFirst({ where: and(eq(campaignPromoters.id, assignmentId), eq(campaignPromoters.promoterId, promoter.id)) });
    if (assignment?.status === 'removed') throw new ConflictException('Your time to submit proof ended and this slot was released');
    if (!assignment || !['accepted', 'active'].includes(assignment.status)) throw new NotFoundException('Active campaign assignment not found');
    const campaign = await this.campaign(assignment.campaignId); const targeting = campaign.targeting as Record<string, unknown>;
    if (['completed', 'cancelled'].includes(campaign.status)) throw new ConflictException('This campaign has ended and is no longer accepting proof');
    const allowed = Array.isArray(targeting.platforms) ? targeting.platforms.map(String).map(value => value.toLowerCase()) : ['x', 'tiktok', 'instagram', 'whatsapp'];
    const platform = input.platform?.trim().toLowerCase(); if (!allowed.includes(platform)) throw new BadRequestException('This platform is not allowed for the campaign');
    if (input.claimedViews !== undefined && (!Number.isInteger(input.claimedViews) || input.claimedViews < 0)) throw new BadRequestException('Claimed views must be a positive whole number');
    if (platform === 'whatsapp' && !input.storageKey) throw new BadRequestException('Upload evidence for a WhatsApp submission');
    if (input.storageKey) await this.storage.assertProofUpload(user.id, assignmentId, input.storageKey, String(input.contentType), Number(input.sizeBytes));
    const tiktokAccessToken = platform === 'tiktok' ? await this.tiktokAccessToken(promoter.id) : undefined;
    const verification = await this.socialVerification.verify(platform, input.submittedUrl, { hasEvidence: Boolean(input.storageKey), tiktokAccessToken });
    // Views have to come from somewhere: the platform itself, or a screenshot the AI can read.
    if (!input.storageKey && verification.metrics?.views === undefined) {
      throw new BadRequestException(platform === 'tiktok' ? 'Upload a screenshot that shows the views, or connect your TikTok account so Reelch can read them' : 'Upload a screenshot that shows the post and its views');
    }
    const connectedProfile = await this.database.db.query.socialAccounts.findFirst({ where: and(eq(socialAccounts.promoterId, promoter.id), eq(socialAccounts.platform, platform)) });
    const expectedHandle = connectedProfile?.handle.replace(/^@/, '').replace(/^https?:\/\/[^/]+\/@?/, '').split(/[/?#]/)[0].toLowerCase();
    const returnedHandle = String(verification.checks.username ?? verification.checks.authorHandle ?? verification.externalAuthorId ?? '').replace(/^@/, '').toLowerCase();
    // A video read through the promoter's own connected account is theirs by definition.
    const ownershipMatches = verification.checks.ownedByConnectedAccount === true ? true : verification.method === 'manual' || !expectedHandle ? undefined : Boolean(returnedHandle && expectedHandle === returnedHandle);
    const requiredHashtag = typeof targeting.requiredHashtag === 'string' ? targeting.requiredHashtag.trim().toLowerCase() : '';
    const providerText = String(verification.checks.text ?? verification.checks.description ?? '').toLowerCase();
    const hashtagMatches = !requiredHashtag || !providerText || providerText.includes(requiredHashtag);
    const minimumViews = Number(targeting.minimumViews ?? 0); const measuredViews = verification.metrics?.views ?? input.claimedViews;
    const viewsMeetMinimum = !minimumViews || measuredViews === undefined || measuredViews >= minimumViews;
    const automatedChecks = { ...verification.checks, ownershipMatches, expectedHandle, hashtagMatches, viewsMeetMinimum, requiredHashtag, minimumViews };
    const [proof] = await this.database.db.insert(proofSubmissions).values({ assignmentId, promoterId: promoter.id, platform, storageKey: input.storageKey, submittedUrl: input.submittedUrl, externalPostId: verification.externalPostId, externalAuthorId: verification.externalAuthorId, verificationMethod: verification.method, automatedChecks, claimedViews: input.claimedViews, status: verification.method === 'platform_api' && hashtagMatches && viewsMeetMinimum ? 'under_review' : 'submitted' }).returning();
    if (verification.metrics) await this.database.db.insert(proofMetricSnapshots).values({ proofSubmissionId: proof.id, views: verification.metrics.views, likes: verification.metrics.likes, comments: verification.metrics.comments, shares: verification.metrics.shares, rawResponseHash: this.hash(JSON.stringify(verification)) });
    await this.audit(user, 'proof.submitted', 'proof_submission', proof.id, { platform, method: verification.method });
    // The proof is already saved: a queue or AI failure must not fail the submission.
    const queued = this.jobs.enabled && await this.jobs.enqueueProofReview(proof.id).then(() => true, error => { this.logger.error(`Could not queue AI review for proof ${proof.id}`, error instanceof Error ? error.stack : undefined); return false; });
    if (!queued) await this.runProofAiReview(proof.id).catch(error => this.logger.error(`AI review failed for proof ${proof.id}`, error instanceof Error ? error.stack : undefined));
    return proof;
  }

  async runProofAiReview(proofId: string) {
    const proof = await this.database.db.query.proofSubmissions.findFirst({ where: eq(proofSubmissions.id, proofId) });
    if (!proof || !['submitted', 'under_review'].includes(proof.status)) return null;
    const assignment = await this.database.db.query.campaignPromoters.findFirst({ where: eq(campaignPromoters.id, proof.assignmentId) });
    if (!assignment) throw new NotFoundException('Campaign assignment not found');
    const campaign = await this.campaign(assignment.campaignId);
    const targeting = campaign.targeting as Record<string, unknown>;
    const checks = proof.automatedChecks as Record<string, unknown>;

    let evidence: { data: Buffer; contentType: string } | undefined;
    let duplicateEvidence = false;
    let fingerprint: string | undefined;
    if (proof.storageKey) {
      evidence = await this.storage.readObject(proof.storageKey);
      const evidenceHash = this.hash(evidence.data.toString('base64'));
      await this.database.db.update(proofSubmissions).set({ evidenceHash, updatedAt: new Date() }).where(eq(proofSubmissions.id, proof.id));
      const reused = await this.database.db.query.proofSubmissions.findFirst({ where: and(eq(proofSubmissions.evidenceHash, evidenceHash), sql`${proofSubmissions.id} <> ${proof.id}`) });
      duplicateEvidence = Boolean(reused);
      if (evidence.contentType.startsWith('image/')) {
        fingerprint = await imageFingerprint(evidence.data).catch((error: unknown) => {
          this.logger.warn(`Could not fingerprint evidence for proof ${proof.id}: ${error instanceof Error ? error.message : 'unknown error'}`);
          return undefined;
        });
        if (fingerprint) await this.database.db.update(proofSubmissions).set({ evidenceFingerprint: fingerprint }).where(eq(proofSubmissions.id, proof.id));
      }
    }

    const reportedViews = (await this.database.db.query.proofMetricSnapshots.findFirst({ where: eq(proofMetricSnapshots.proofSubmissionId, proof.id), orderBy: desc(proofMetricSnapshots.capturedAt) }))?.views ?? undefined;
    let assessment: AiProofAssessment | null = null;
    let failure: string | undefined;
    let meta = { provider: 'none', model: 'none', latencyMs: 0 };
    try {
      const response = await this.ai.generateJson({
        system: proofReviewSystemPrompt, schemaName: 'proof_assessment', schema: proofAssessmentSchema,
        parts: [
          { type: 'text', text: proofReviewPrompt({
            title: campaign.title, description: campaign.description, platform: proof.platform,
            requiredHashtag: typeof targeting.requiredHashtag === 'string' ? targeting.requiredHashtag : undefined,
            minimumViews: Number(targeting.minimumViews ?? 0) || undefined,
            destinationUrl: typeof targeting.destinationUrl === 'string' ? targeting.destinationUrl : undefined,
            expectedHandle: typeof checks.expectedHandle === 'string' ? checks.expectedHandle : undefined,
            claimedViews: proof.claimedViews ?? undefined, submittedUrl: proof.submittedUrl ?? undefined,
            platformData: { method: proof.verificationMethod, author: checks.username ?? checks.authorHandle, caption: checks.text ?? checks.description, views: reportedViews, linkCheck: checks.linkCheck },
          }, Boolean(evidence)) },
          ...(evidence ? [{ type: 'file' as const, mimeType: evidence.contentType, data: evidence.data }] : []),
        ],
      });
      assessment = sanitizeAssessment(response.data);
      meta = { provider: response.provider, model: response.model, latencyMs: response.latencyMs };
    } catch (error) {
      // The proof stays in the human review queue when the model is unavailable.
      failure = error instanceof AiOutputError || error instanceof ServiceUnavailableException ? error.message : 'AI review failed unexpectedly';
      this.logger.warn(`AI review unavailable for proof ${proof.id}: ${failure}`);
    }

    const nearDuplicateEvidence = Boolean(!duplicateEvidence && fingerprint && assessment && await this.hasNearDuplicate(proof.id, assignment.campaignId, fingerprint, assessment));
    const platformViews = reportedViews;
    const outcome = decideProof({
      assessment, verificationMethod: proof.verificationMethod,
      ownershipMatches: typeof checks.ownershipMatches === 'boolean' ? checks.ownershipMatches : undefined,
      hashtagMatches: typeof checks.hashtagMatches === 'boolean' ? checks.hashtagMatches : undefined,
      minimumViews: Number(targeting.minimumViews ?? 0), platformViews: platformViews ?? undefined, claimedViews: proof.claimedViews ?? undefined, duplicateEvidence, nearDuplicateEvidence,
      linkCheck: checks.linkCheck === 'confirmed' || checks.linkCheck === 'failed' || checks.linkCheck === 'unavailable' ? checks.linkCheck : undefined,
      settings: {
        autoApprove: process.env.AI_AUTO_APPROVE !== 'false',
        minimumScore: Number(process.env.AI_AUTO_APPROVE_MIN_SCORE ?? 85),
        allowEvidenceOnly: process.env.AI_AUTO_APPROVE_EVIDENCE_ONLY === 'true',
      },
    });
    const [review] = await this.database.db.insert(proofAiReviews).values({
      proofSubmissionId: proof.id, ...meta, status: assessment ? 'completed' : 'failed', decision: outcome.decision, assurance: outcome.assurance,
      contentMatch: assessment?.contentMatch, fraudRisk: outcome.fraudRisk, assessment, reasons: outcome.reasons, error: failure,
    }).returning();
    if (outcome.fraudRisk !== 'low') {
      await this.database.db.insert(fraudFlags).values({ promoterId: proof.promoterId, rule: duplicateEvidence || nearDuplicateEvidence ? 'duplicate_proof_evidence' : 'ai_proof_review', riskScore: riskScore[outcome.fraudRisk], details: { proofId: proof.id, reviewId: review.id, reasons: outcome.reasons, signals: assessment?.fraudSignals ?? [] } });
    }
    await this.systemAudit(null, 'proof.ai_reviewed', 'proof_submission', proof.id, { reviewId: review.id, decision: outcome.decision, model: meta.model });

    if (outcome.decision === 'auto_approve') {
      let approved = false;
      try {
        await this.decideProofReview(null, proof.id, { decision: 'approved', reason: `Automatically approved by AI verification (${outcome.assurance.replace('_', ' ')})` });
        approved = true;
      } catch (error) {
        // Funding or allocation limits can still block approval; leave it for a reviewer.
        this.logger.warn(`Automatic approval skipped for proof ${proof.id}: ${error instanceof Error ? error.message : 'unknown error'}`);
        await this.database.db.update(proofSubmissions).set({ status: 'under_review', updatedAt: new Date() }).where(and(eq(proofSubmissions.id, proof.id), eq(proofSubmissions.status, 'submitted')));
      }
      // Earnings are already credited; a failed payout stays reviewable on the withdrawal.
      if (approved) await this.autoPayout(proof.promoterId, campaign.unitPriceKobo, campaign.currency, proof.id).catch(error => this.logger.warn(`Automatic PayPal payout failed for proof ${proof.id}: ${error instanceof Error ? error.message : 'unknown error'}`));
    } else if (proof.status === 'submitted') {
      await this.database.db.update(proofSubmissions).set({ status: 'under_review', updatedAt: new Date() }).where(and(eq(proofSubmissions.id, proof.id), eq(proofSubmissions.status, 'submitted')));
    }
    return review;
  }

  // Promoters share a creative, so this stays within one campaign, where a copied screenshot earns money.
  private async hasNearDuplicate(proofId: string, campaignId: string, fingerprint: string, assessment: AiProofAssessment) {
    const others = await this.withAiReviews(await this.database.db.select({ proof: { id: proofSubmissions.id, fingerprint: proofSubmissions.evidenceFingerprint } })
      .from(proofSubmissions).innerJoin(campaignPromoters, eq(proofSubmissions.assignmentId, campaignPromoters.id))
      .where(and(eq(campaignPromoters.campaignId, campaignId), ne(proofSubmissions.id, proofId), sql`${proofSubmissions.evidenceFingerprint} is not null`)));
    const current = { fingerprint, views: assessment.extracted.views, handle: assessment.extracted.handle };
    return others.some(({ proof, aiReview }) => {
      const extracted = (aiReview?.assessment as AiProofAssessment | null)?.extracted;
      return extracted && proof.fingerprint && isNearDuplicate(current, { fingerprint: proof.fingerprint, views: extracted.views, handle: extracted.handle });
    });
  }

  private async autoPayout(promoterId: string, amountKobo: number, currency: string, proofId: string) {
    if (this.providerFor(currency) !== 'paypal' || process.env.PAYPAL_AUTO_PAYOUT === 'false') return;
    const promoter = await this.database.db.query.promoters.findFirst({ where: eq(promoters.id, promoterId) });
    const account = await this.database.db.query.payoutAccounts.findFirst({ where: and(eq(payoutAccounts.promoterId, promoterId), eq(payoutAccounts.provider, 'paypal'), eq(payoutAccounts.isDefault, true)) });
    if (!account) {
      if (promoter) await this.notify(promoter.userId, 'payout_account_required', 'Add your PayPal email', 'Your earnings are ready. Add a PayPal email under Earnings to receive automatic payouts.', { proofId });
      return;
    }
    const withdrawal = await this.holdWithdrawal(promoterId, account.id, amountKobo, currency, `auto-proof:${proofId}`);
    if (withdrawal.status !== 'requested') return;
    await this.sendPaypalPayout(withdrawal.id, null);
    if (this.jobs.enabled) await this.jobs.enqueuePayoutSync(withdrawal.id).catch(error => this.logger.warn(`Could not queue payout sync for ${withdrawal.id}: ${error instanceof Error ? error.message : 'unknown error'}`));
  }

  async promoterProofs(user: AuthenticatedUser) {
    const promoter = await this.promoterFor(user.id);
    await this.releaseLapsedSlots(eq(campaignPromoters.promoterId, promoter.id));
    const rows = await this.database.db.select({ proof: proofSubmissions, campaignTitle: campaigns.title, businessName: businesses.name, slotStatus: campaignPromoters.status, verifiedResults: campaignPromoters.verifiedResults })
      .from(proofSubmissions).innerJoin(campaignPromoters, eq(proofSubmissions.assignmentId, campaignPromoters.id)).innerJoin(campaigns, eq(campaignPromoters.campaignId, campaigns.id)).innerJoin(businesses, eq(campaigns.businessId, businesses.id))
      .where(eq(proofSubmissions.promoterId, promoter.id)).orderBy(desc(proofSubmissions.createdAt));
    // Rows are newest first, so only the first proof seen per slot can still be resubmitted.
    const seen = new Set<string>();
    const withDeadline = rows.map(({ verifiedResults, ...row }) => {
      const isLatest = !seen.has(row.proof.assignmentId); seen.add(row.proof.assignmentId);
      const canResubmit = isLatest && row.proof.status === 'rejected' && row.proof.reviewedAt && verifiedResults === 0 && row.slotStatus !== 'removed';
      return { ...row, resubmitBy: canResubmit && row.proof.reviewedAt ? resubmitDeadline(row.proof.reviewedAt) : null };
    });
    // Promoters see the outcome and reasons, not fraud scoring details.
    return (await this.withAiReviews(withDeadline)).map(row => ({ ...row, aiReview: row.aiReview && { decision: row.aiReview.decision, assurance: row.aiReview.assurance, contentMatch: row.aiReview.contentMatch, summary: row.aiReview.assessment?.summary, reasons: row.aiReview.reasons, createdAt: row.aiReview.createdAt } }));
  }

  private async withAiReviews<T extends { proof: { id: string } }>(rows: T[]) {
    const ids = rows.map(row => row.proof.id);
    const reviews = ids.length ? await this.database.db.select().from(proofAiReviews).where(inArray(proofAiReviews.proofSubmissionId, ids)).orderBy(desc(proofAiReviews.createdAt)) : [];
    const latest = new Map<string, typeof proofAiReviews.$inferSelect>();
    for (const review of reviews) if (!latest.has(review.proofSubmissionId)) latest.set(review.proofSubmissionId, review);
    return rows.map(row => ({ ...row, aiReview: latest.get(row.proof.id) ?? null }));
  }

  async rerunProofAiReview(user: AuthenticatedUser, proofId: string) {
    const review = await this.runProofAiReview(proofId);
    if (!review) throw new ConflictException('Only proofs awaiting review can be re-checked');
    await this.audit(user, 'proof.ai_review_requested', 'proof_submission', proofId);
    return review;
  }

  async adminProofs(status = 'submitted') {
    const validStatus = ['submitted', 'under_review', 'approved', 'rejected'].includes(status) ? status as typeof proofSubmissions.$inferSelect.status : 'submitted';
    return this.withAiReviews(await this.database.db.select({ proof: proofSubmissions, campaignTitle: campaigns.title, promoterUsername: promoters.username, promoterName: users.displayName })
      .from(proofSubmissions).innerJoin(campaignPromoters, eq(proofSubmissions.assignmentId, campaignPromoters.id)).innerJoin(campaigns, eq(campaignPromoters.campaignId, campaigns.id)).innerJoin(promoters, eq(proofSubmissions.promoterId, promoters.id)).innerJoin(users, eq(promoters.userId, users.id))
      .where(eq(proofSubmissions.status, validStatus)).orderBy(asc(proofSubmissions.createdAt)));
  }

  async proofEvidenceUrl(user: AuthenticatedUser, proofId: string) {
    const proof = await this.database.db.query.proofSubmissions.findFirst({ where: eq(proofSubmissions.id, proofId) });
    if (!proof?.storageKey) throw new NotFoundException('Proof evidence not found');
    if (!user.roles.includes('admin')) { const promoter = await this.promoterFor(user.id); if (proof.promoterId !== promoter.id) throw new ForbiddenException('You cannot view this proof'); }
    return { url: await this.storage.createReadUrl(proof.storageKey), expiresIn: 300 };
  }

  async reviewProof(user: AuthenticatedUser, proofId: string, input: { decision: 'approved' | 'rejected'; reason?: string }) {
    if (input.decision === 'rejected' && !input.reason) throw new BadRequestException('A rejection reason is required');
    const proof = await this.decideProofReview(user.id, proofId, input);
    if (input.decision === 'approved') {
      const assignment = await this.database.db.query.campaignPromoters.findFirst({ where: eq(campaignPromoters.id, proof.assignmentId) });
      const campaign = assignment ? await this.campaign(assignment.campaignId) : undefined;
      if (campaign) await this.autoPayout(proof.promoterId, campaign.unitPriceKobo, campaign.currency, proof.id).catch(error => this.logger.warn(`Payout after manual approval failed for proof ${proof.id}: ${error instanceof Error ? error.message : 'unknown error'}`));
    }
    return proof;
  }

  private async decideProofReview(actorUserId: string | null, proofId: string, input: { decision: 'approved' | 'rejected'; reason?: string }) {
    const proof = await this.database.db.transaction(async (tx) => {
      const current = await tx.query.proofSubmissions.findFirst({ where: and(eq(proofSubmissions.id, proofId), inArray(proofSubmissions.status, ['submitted', 'under_review'])) });
      if (!current) throw new NotFoundException('Reviewable proof not found');
      if (input.decision === 'approved') {
        const assignment = await tx.query.campaignPromoters.findFirst({ where: eq(campaignPromoters.id, current.assignmentId) }); if (!assignment) throw new NotFoundException('Campaign assignment not found');
        const campaign = await tx.query.campaigns.findFirst({ where: eq(campaigns.id, assignment.campaignId) }); const reservation = campaign ? await tx.query.campaignReservations.findFirst({ where: eq(campaignReservations.campaignId, campaign.id) }) : null;
        if (!campaign || !reservation || campaign.status !== 'live') throw new ConflictException('Campaign funds are not available');
        if (assignment.verifiedResults >= assignment.targetQuantity) throw new ConflictException('This promoter has completed the allocated deliverables');
        const checks = current.automatedChecks as Record<string, unknown>;
        if (checks.hashtagMatches === false) throw new ConflictException('The required campaign hashtag was not found');
        if (checks.ownershipMatches === false) throw new ConflictException('The post author does not match the promoter account');
        const minimumViews = Number((campaign.targeting as Record<string, unknown>).minimumViews ?? 0); if (minimumViews && Number(current.claimedViews ?? 0) < minimumViews && current.verificationMethod === 'manual') throw new ConflictException(`At least ${minimumViews.toLocaleString()} views are required`);
        const [claimed] = await tx.update(campaignReservations).set({ consumedKobo: sql`${campaignReservations.consumedKobo} + ${campaign.unitPriceKobo}`, updatedAt: new Date() }).where(and(eq(campaignReservations.id, reservation.id), sql`${campaignReservations.amountKobo} - ${campaignReservations.consumedKobo} - ${campaignReservations.releasedKobo} >= ${campaign.unitPriceKobo}`)).returning();
        if (!claimed) throw new ConflictException('The campaign has no remaining reserved funds');
        const wallet = await this.walletFor(tx, 'promoter', current.promoterId, campaign.currency);
        const [ledger] = await tx.insert(ledgerTransactions).values({ type: 'proof_earning', reference: current.id, idempotencyKey: `proof:${current.id}` }).returning();
        await tx.insert(ledgerEntries).values([{ transactionId: ledger.id, walletId: reservation.walletId, direction: 'debit', amountKobo: campaign.unitPriceKobo, currency: campaign.currency }, { transactionId: ledger.id, walletId: wallet.id, direction: 'credit', amountKobo: campaign.unitPriceKobo, currency: campaign.currency }]);
        await tx.update(campaignPromoters).set({ verifiedResults: sql`${campaignPromoters.verifiedResults} + 1`, status: 'active', updatedAt: new Date() }).where(eq(campaignPromoters.id, assignment.id));
        await tx.update(campaigns).set({ verifiedQuantity: sql`${campaigns.verifiedQuantity} + 1`, updatedAt: new Date() }).where(eq(campaigns.id, campaign.id));
        if (claimed.consumedKobo + claimed.releasedKobo >= claimed.amountKobo) {
          const business = await tx.query.businesses.findFirst({ where: eq(businesses.id, campaign.businessId) });
          if (business) {
            await tx.update(campaigns).set({ status: 'completed', updatedAt: new Date() }).where(eq(campaigns.id, campaign.id));
            await tx.insert(campaignStatusHistory).values({ campaignId: campaign.id, fromStatus: 'live', toStatus: 'completed', actorUserId: actorUserId ?? business.ownerUserId, reason: 'Budget fully spent on verified posts' });
            await tx.insert(notifications).values({ userId: business.ownerUserId, type: 'campaign_completed', title: 'Campaign completed', body: `${campaign.title} has delivered all its verified posts.`, data: { campaignId: campaign.id } });
          }
        }
      }
      const [updated] = await tx.update(proofSubmissions).set({ status: input.decision, reviewReason: input.reason, reviewedBy: actorUserId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(proofSubmissions.id, current.id)).returning(); return updated;
    }, { isolationLevel: 'serializable' });
    await this.systemAudit(actorUserId, `proof.${input.decision}`, 'proof_submission', proof.id, { reason: input.reason });
    const promoter = await this.database.db.query.promoters.findFirst({ where: eq(promoters.id, proof.promoterId) });
    if (promoter) await this.notify(promoter.userId, 'proof_reviewed', `Proof ${input.decision}`, input.decision === 'approved' ? 'Your campaign proof was approved.' : `Your campaign proof was rejected: ${input.reason?.replace(/\.?$/, '.')} Submit a new proof within ${RESUBMIT_WINDOW_HOURS} hours to keep your slot.`, { proofId, decision: input.decision });
    return proof;
  }

  async getNotifications(user: AuthenticatedUser) {
    return this.database.db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(50);
  }

  async markNotificationRead(user: AuthenticatedUser, id: string) {
    const [notification] = await this.database.db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, user.id))).returning();
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }

  async adminWithdrawals() {
    return this.database.db.select({
      id: withdrawals.id, amountKobo: withdrawals.amountKobo, netAmountKobo: withdrawals.netAmountKobo, currency: withdrawals.currency, status: withdrawals.status,
      idempotencyKey: withdrawals.idempotencyKey, providerReference: withdrawals.providerReference, failureReason: withdrawals.failureReason, createdAt: withdrawals.createdAt, processedAt: withdrawals.processedAt,
      provider: payoutAccounts.provider, destination: payoutAccounts.accountName, username: promoters.username, displayName: users.displayName,
    }).from(withdrawals).innerJoin(payoutAccounts, eq(withdrawals.payoutAccountId, payoutAccounts.id)).innerJoin(promoters, eq(withdrawals.promoterId, promoters.id)).innerJoin(users, eq(promoters.userId, users.id))
      .orderBy(desc(withdrawals.createdAt)).limit(1000);
  }

  async adminLedger() {
    const transactions = await this.database.db.select().from(ledgerTransactions).orderBy(desc(ledgerTransactions.createdAt)).limit(1000);
    const entries = transactions.length ? await this.database.db.select({ transactionId: ledgerEntries.transactionId, direction: ledgerEntries.direction, amountKobo: ledgerEntries.amountKobo, ownerType: wallets.ownerType, currency: wallets.currency })
      .from(ledgerEntries).innerJoin(wallets, eq(ledgerEntries.walletId, wallets.id)).where(inArray(ledgerEntries.transactionId, transactions.map(row => row.id))) : [];
    const signedAmount = sql`case when ${ledgerEntries.direction} = 'credit' then ${ledgerEntries.amountKobo} else -${ledgerEntries.amountKobo} end`;
    // Totals read every entry, so they stay correct when the transaction list is capped.
    const [accounts, unbalanced] = await Promise.all([
      this.database.db.select({ ownerType: wallets.ownerType, currency: wallets.currency, netKobo: sql<number>`coalesce(sum(${signedAmount}), 0)::bigint` })
        .from(ledgerEntries).innerJoin(wallets, eq(ledgerEntries.walletId, wallets.id)).groupBy(wallets.ownerType, wallets.currency),
      this.database.db.execute(sql`select count(*)::int as total from (select transaction_id from ledger_entries group by transaction_id having sum(case when direction = 'credit' then amount_kobo else -amount_kobo end) <> 0) as lopsided`),
    ]);
    return {
      accounts: accounts.map(row => ({ ...row, netKobo: Number(row.netKobo) })),
      unbalancedTransactions: Number((unbalanced.rows[0] as { total?: number } | undefined)?.total ?? 0),
      transactions: transactions.map(transaction => {
        const legs = entries.filter(entry => entry.transactionId === transaction.id);
        const total = (direction: 'debit' | 'credit') => legs.filter(leg => leg.direction === direction).reduce((sum, leg) => sum + leg.amountKobo, 0);
        const accountsOn = (direction: 'debit' | 'credit') => [...new Set(legs.filter(leg => leg.direction === direction).map(leg => leg.ownerType))];
        return { id: transaction.id, createdAt: transaction.createdAt, type: transaction.type, reference: transaction.reference, status: transaction.status, currency: legs[0]?.currency ?? 'USD', amountKobo: total('credit'), from: accountsOn('debit'), to: accountsOn('credit'), balanced: total('credit') === total('debit') };
      }),
    };
  }

  async adminOverview() {
    const [campaignRows, riskRows, userRows, disputeRows, verificationRows] = await Promise.all([
      this.database.db.select({ total: sql<number>`count(*)::int`, live: sql<number>`count(*) filter (where ${campaigns.status} = 'live')::int`, verified: sql<number>`coalesce(sum(${campaigns.verifiedQuantity}), 0)::int` }).from(campaigns),
      this.database.db.select({ openFlags: sql<number>`count(*) filter (where ${fraudFlags.resolvedAt} is null)::int` }).from(fraudFlags),
      this.database.db.select({ total: sql<number>`count(*)::int` }).from(users),
      this.database.db.select({ open: sql<number>`count(*) filter (where ${disputes.status} in ('open','evidence_requested','under_review'))::int` }).from(disputes),
      this.database.db.select({ pending: sql<number>`count(*) filter (where ${verificationRequests.status} = 'pending')::int`, businesses: sql<number>`count(*) filter (where ${verificationRequests.status} = 'pending' and ${verificationRequests.kind} = 'business')::int`, promoters: sql<number>`count(*) filter (where ${verificationRequests.status} = 'pending' and ${verificationRequests.kind} = 'promoter')::int` }).from(verificationRequests),
    ]);
    const [campaignMetrics] = campaignRows;
    const [riskMetrics] = riskRows;
    const [userMetrics] = userRows;
    const [disputeMetrics] = disputeRows;
    const [verificationMetrics] = verificationRows;
    return { campaigns: campaignMetrics, risk: riskMetrics, users: userMetrics, disputes: disputeMetrics, verifications: verificationMetrics };
  }

  async storeWebhookReceipt(input: { provider: string; externalId: string; eventType: string; payloadHash: string }) {
    const [event] = await this.database.db.insert(inboundWebhookEvents).values(input).onConflictDoNothing().returning();
    return event ?? this.database.db.query.inboundWebhookEvents.findFirst({ where: and(eq(inboundWebhookEvents.provider, input.provider), eq(inboundWebhookEvents.externalId, input.externalId)) });
  }

  private validateCampaignTargeting(targeting?: Record<string, unknown>) {
    const category = typeof targeting?.category === 'string' ? targeting.category.trim() : '';
    const location = typeof targeting?.location === 'string' ? targeting.location.trim() : '';
    if (!campaignCategories.has(category)) throw new BadRequestException('Select a valid campaign category');
    if (!campaignLocations.has(location)) throw new BadRequestException('Select a valid promoter location');
    const platforms = Array.isArray(targeting?.platforms) ? targeting.platforms.map(String).map(value => value.toLowerCase()) : [];
    if (!platforms.length || platforms.some(value => !['instagram', 'tiktok', 'x', 'whatsapp'].includes(value))) throw new BadRequestException('Select at least one valid publishing platform');
    const minimumViews = Number(targeting?.minimumViews ?? 0); if (!Number.isInteger(minimumViews) || minimumViews < 0) throw new BadRequestException('Minimum views must be a positive whole number');
    const hashtag = typeof targeting?.requiredHashtag === 'string' ? targeting.requiredHashtag.trim() : ''; if (hashtag && !/^#[\p{L}\p{N}_]+$/u.test(hashtag)) throw new BadRequestException('Required hashtag must start with # and contain no spaces');
  }
  private validateCampaignDates(startsAt?: string, endsAt?: string) {
    if (!startsAt && !endsAt) return;
    const start = startsAt ? new Date(startsAt) : null; const end = endsAt ? new Date(endsAt) : null;
    if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) throw new BadRequestException('Enter valid campaign dates');
    if (start && end && end <= start) throw new BadRequestException('The end date must be after the start date');
  }

  private databaseErrorDetails(error: unknown) {
    const nested = error && typeof error === 'object' && 'cause' in error ? (error as { cause?: unknown }).cause : undefined;
    const source = nested && typeof nested === 'object' ? nested as Record<string, unknown> : error && typeof error === 'object' ? error as Record<string, unknown> : {};
    return [
      typeof source.message === 'string' ? source.message : 'Unknown database error',
      source.code ? `code=${String(source.code)}` : '',
      source.detail ? `detail=${String(source.detail)}` : '',
      source.constraint ? `constraint=${String(source.constraint)}` : '',
      source.table ? `table=${String(source.table)}` : '',
      source.column ? `column=${String(source.column)}` : '',
    ].filter(Boolean).join(' | ');
  }

  private async businessFor(userId: string) {
    const business = await this.database.db.query.businesses.findFirst({ where: eq(businesses.ownerUserId, userId) });
    if (!business) throw new ForbiddenException('Business profile required');
    return business;
  }
  private async requireSuperAdmin(userId: string) {
    const administrator = await this.database.db.query.administrators.findFirst({ where: eq(administrators.userId, userId) });
    if (!administrator?.isSuperAdmin) throw new ForbiddenException('Super administrator access is required');
    return administrator;
  }
  private async promoterFor(userId: string) {
    const promoter = await this.database.db.query.promoters.findFirst({ where: eq(promoters.userId, userId) });
    if (!promoter) throw new ForbiddenException('Promoter profile required');
    return promoter;
  }
  private async campaign(id: string) {
    const campaign = await this.database.db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }
  private async ownedCampaign(userId: string, campaignId: string) {
    const business = await this.businessFor(userId); const campaign = await this.campaign(campaignId);
    if (campaign.businessId !== business.id) throw new ForbiddenException('Campaign belongs to another business');
    return campaign;
  }
  private async transition(campaign: typeof campaigns.$inferSelect, toStatus: typeof campaigns.$inferSelect.status, actorUserId: string, reason?: string) {
    const [updated] = await this.database.db.transaction(async (tx) => {
      const rows = await tx.update(campaigns).set({ status: toStatus, updatedAt: new Date() }).where(eq(campaigns.id, campaign.id)).returning();
      await tx.insert(campaignStatusHistory).values({ campaignId: campaign.id, fromStatus: campaign.status, toStatus, actorUserId, reason });
      return rows;
    });
    return updated;
  }
  private audit(user: AuthenticatedUser, action: string, resourceType: string, resourceId?: string, metadata: Record<string, unknown> = {}) {
    return this.systemAudit(user.id, action, resourceType, resourceId, metadata);
  }
  // A null actor marks a decision made by Reelch automation rather than a person.
  private systemAudit(actorUserId: string | null, action: string, resourceType: string, resourceId?: string, metadata: Record<string, unknown> = {}) {
    return this.database.db.insert(auditLogs).values({ actorUserId, action, resourceType, resourceId, metadata });
  }
  private async walletFor(tx: Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0], ownerType: string, ownerId: string, currency: string) {
    const [created] = await tx.insert(wallets).values({ ownerType, ownerId, currency }).onConflictDoNothing().returning();
    const wallet = created ?? await tx.query.wallets.findFirst({ where: and(eq(wallets.ownerType, ownerType), eq(wallets.ownerId, ownerId), eq(wallets.currency, currency)) });
    if (!wallet) throw new Error(`Unable to create ${ownerType} wallet`);
    return wallet;
  }
  private notify(userId: string, type: string, title: string, body: string, data: Record<string, unknown> = {}) {
    return this.database.db.insert(notifications).values({ userId, type, title, body, data });
  }
  private hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
}
