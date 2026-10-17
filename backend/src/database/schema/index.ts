import {
  bigint, boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey,
  text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const roleEnum = pgEnum('user_role', ['business', 'promoter', 'admin']);
export const verificationStatusEnum = pgEnum('verification_status', ['draft', 'pending', 'approved', 'rejected', 'more_information_required']);
export const campaignStatusEnum = pgEnum('campaign_status', ['draft', 'pending_review', 'approved', 'funding_required', 'scheduled', 'live', 'paused', 'completed', 'rejected', 'cancelled']);
export const assignmentStatusEnum = pgEnum('assignment_status', ['invited', 'applied', 'accepted', 'active', 'completed', 'rejected', 'removed']);
export const conversionStatusEnum = pgEnum('conversion_status', ['detected', 'pending_verification', 'verified', 'billable', 'rejected']);
export const ledgerDirectionEnum = pgEnum('ledger_direction', ['debit', 'credit']);
export const ledgerTransactionStatusEnum = pgEnum('ledger_transaction_status', ['pending', 'posted', 'reversed']);
export const withdrawalStatusEnum = pgEnum('withdrawal_status', ['requested', 'reviewing', 'processing', 'paid', 'failed', 'cancelled']);
export const disputeStatusEnum = pgEnum('dispute_status', ['open', 'evidence_requested', 'under_review', 'resolved', 'rejected']);
export const proofStatusEnum = pgEnum('proof_status', ['submitted', 'under_review', 'approved', 'rejected']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(), passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(), isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
}, (t) => [uniqueIndex('users_email_unique').on(t.email)]);

export const promoterWaitlist = pgTable('promoter_waitlist', {
  id: uuid('id').primaryKey().defaultRandom(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  country: text('country').notNull(),
  primaryPlatform: text('primary_platform').notNull(),
  profileUrl: text('profile_url').notNull(),
  audienceSize: integer('audience_size'),
  niches: jsonb('niches').$type<string[]>().notNull().default([]),
  status: text('status').notNull().default('pending'),
  ...timestamps,
}, (t) => [
  uniqueIndex('promoter_waitlist_email_unique').on(t.email),
  index('promoter_waitlist_status_created_idx').on(t.status, t.createdAt),
]);

export const contactEnquiries = pgTable('contact_enquiries', {
  id: uuid('id').primaryKey().defaultRandom(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  company: text('company'),
  enquiryType: text('enquiry_type').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('new'),
  ...timestamps,
}, (t) => [index('contact_enquiries_status_created_idx').on(t.status, t.createdAt)]);

export const userRoles = pgTable('user_roles', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: roleEnum('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.role] })]);

export const administrators = pgTable('administrators', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  isSuperAdmin: boolean('is_super_admin').notNull().default(false),
  invitedByUserId: uuid('invited_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const administratorInvitations = pgTable('administrator_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  tokenHash: text('token_hash').notNull(),
  invitedByUserId: uuid('invited_by_user_id').notNull().references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('administrator_invitations_token_unique').on(t.tokenHash),
  index('administrator_invitations_email_created_idx').on(t.email, t.createdAt),
]);

export const businesses = pgTable('businesses', {
  id: uuid('id').primaryKey().defaultRandom(), ownerUserId: uuid('owner_user_id').notNull().references(() => users.id),
  name: text('name').notNull(), industry: text('industry'), website: text('website'), country: text('country').notNull().default('NG'),
  phone: text('phone'), companySize: text('company_size'), description: text('description'),
  registrationNumber: text('registration_number'), address: text('address'),
  campaignGoals: jsonb('campaign_goals').$type<string[]>().notNull().default([]),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  verificationStatus: verificationStatusEnum('verification_status').notNull().default('draft'), ...timestamps,
}, (t) => [uniqueIndex('business_owner_unique').on(t.ownerUserId)]);

export const promoters = pgTable('promoters', {
  id: uuid('id').primaryKey().defaultRandom(), userId: uuid('user_id').notNull().references(() => users.id),
  username: text('username').notNull(), bio: text('bio'), country: text('country').notNull().default('NG'),
  city: text('city'), phone: text('phone'), dateOfBirth: text('date_of_birth'), avatarStorageKey: text('avatar_storage_key'),
  niches: jsonb('niches').$type<string[]>().notNull().default([]),
  languages: jsonb('languages').$type<string[]>().notNull().default([]),
  preferredCampaignTypes: jsonb('preferred_campaign_types').$type<string[]>().notNull().default([]),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  verificationStatus: verificationStatusEnum('verification_status').notNull().default('draft'),
  performanceScore: integer('performance_score').notNull().default(0), ...timestamps,
}, (t) => [uniqueIndex('promoter_user_unique').on(t.userId), uniqueIndex('promoter_username_unique').on(t.username)]);

export const verificationRequests = pgTable('verification_requests', {
  id: uuid('id').primaryKey().defaultRandom(), userId: uuid('user_id').notNull().references(() => users.id),
  kind: roleEnum('kind').notNull(), status: verificationStatusEnum('status').notNull().default('draft'),
  evidence: jsonb('evidence').$type<Record<string, unknown>>().notNull().default({}), decisionReason: text('decision_reason'),
  reviewedBy: uuid('reviewed_by').references(() => users.id), reviewedAt: timestamp('reviewed_at', { withTimezone: true }), ...timestamps,
}, (t) => [
  index('verification_requests_status_updated_idx').on(t.status, t.updatedAt),
  index('verification_requests_user_idx').on(t.userId),
]);

export const verificationDocuments = pgTable('verification_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => verificationRequests.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), storageKey: text('storage_key').notNull(), originalFilename: text('original_filename').notNull(),
  mimeType: text('mime_type').notNull(), sizeBytes: integer('size_bytes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('verification_document_storage_key_unique').on(t.storageKey), index('verification_document_request_idx').on(t.requestId)]);

export const socialAccounts = pgTable('social_accounts', {
  id: uuid('id').primaryKey().defaultRandom(), promoterId: uuid('promoter_id').notNull().references(() => promoters.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(), handle: text('handle').notNull(), audienceSize: integer('audience_size'),
  dataSource: text('data_source').notNull().default('self_reported'), verifiedAt: timestamp('verified_at', { withTimezone: true }), ...timestamps,
}, (t) => [index('social_accounts_promoter_idx').on(t.promoterId)]);

export const socialConnections = pgTable('social_connections', {
  id: uuid('id').primaryKey().defaultRandom(), promoterId: uuid('promoter_id').notNull().references(() => promoters.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), providerUserId: text('provider_user_id').notNull(), username: text('username').notNull(),
  accessTokenEncrypted: text('access_token_encrypted'), refreshTokenEncrypted: text('refresh_token_encrypted'), tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  scopes: jsonb('scopes').$type<string[]>().notNull().default([]), status: text('status').notNull().default('active'), lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }), ...timestamps,
}, (t) => [uniqueIndex('social_connection_promoter_provider_unique').on(t.promoterId, t.provider), uniqueIndex('social_connection_provider_user_unique').on(t.provider, t.providerUserId)]);

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(), businessId: uuid('business_id').notNull().references(() => businesses.id),
  title: text('title').notNull(), description: text('description').notNull(), objective: text('objective').notNull().default('acquisition'),
  conversionType: text('conversion_type').notNull().default('signup_completed'), pricingModel: text('pricing_model').notNull().default('CPA'),
  currency: text('currency').notNull().default('NGN'), unitPriceKobo: bigint('unit_price_kobo', { mode: 'number' }).notNull(),
  targetQuantity: integer('target_quantity').notNull(), budgetKobo: bigint('budget_kobo', { mode: 'number' }).notNull(),
  platformFeeKobo: bigint('platform_fee_kobo', { mode: 'number' }).notNull().default(0), verifiedQuantity: integer('verified_quantity').notNull().default(0),
  targeting: jsonb('targeting').$type<Record<string, unknown>>().notNull().default({}), status: campaignStatusEnum('status').notNull().default('draft'),
  termsVersion: integer('terms_version').notNull().default(1), startsAt: timestamp('starts_at', { withTimezone: true }), endsAt: timestamp('ends_at', { withTimezone: true }), ...timestamps,
}, (t) => [
  index('campaigns_business_status_idx').on(t.businessId, t.status),
  index('campaigns_status_updated_idx').on(t.status, t.updatedAt),
]);

export const campaignCreatives = pgTable('campaign_creatives', {
  id: uuid('id').primaryKey().defaultRandom(), campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull(), originalFilename: text('original_filename').notNull(), mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(), altText: text('alt_text'), sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('campaign_creative_storage_key_unique').on(t.storageKey), index('campaign_creative_campaign_idx').on(t.campaignId)]);

export const campaignStatusHistory = pgTable('campaign_status_history', {
  id: uuid('id').primaryKey().defaultRandom(), campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  fromStatus: campaignStatusEnum('from_status'), toStatus: campaignStatusEnum('to_status').notNull(), reason: text('reason'),
  actorUserId: uuid('actor_user_id').notNull().references(() => users.id), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('campaign_status_history_campaign_created_idx').on(t.campaignId, t.createdAt)]);

export const wallets = pgTable('wallets', {
  id: uuid('id').primaryKey().defaultRandom(), ownerType: text('owner_type').notNull(), ownerId: uuid('owner_id').notNull(),
  currency: text('currency').notNull().default('NGN'), ...timestamps,
}, (t) => [uniqueIndex('wallet_owner_currency_unique').on(t.ownerType, t.ownerId, t.currency)]);

export const virtualAccounts = pgTable('virtual_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull().default('paystack'),
  providerCustomerCode: text('provider_customer_code').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  accountName: text('account_name').notNull(),
  accountNumber: text('account_number').notNull(),
  bankName: text('bank_name').notNull(),
  bankSlug: text('bank_slug').notNull(),
  currency: text('currency').notNull().default('NGN'),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
}, (t) => [
  uniqueIndex('virtual_account_business_provider_unique').on(t.businessId, t.provider),
  uniqueIndex('virtual_account_provider_customer_unique').on(t.provider, t.providerCustomerCode),
  uniqueIndex('virtual_account_provider_number_unique').on(t.provider, t.accountNumber),
]);

export const ledgerTransactions = pgTable('ledger_transactions', {
  id: uuid('id').primaryKey().defaultRandom(), type: text('type').notNull(), reference: text('reference').notNull(),
  idempotencyKey: text('idempotency_key').notNull(), status: ledgerTransactionStatusEnum('status').notNull().default('posted'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('ledger_idempotency_unique').on(t.idempotencyKey)]);

export const ledgerEntries = pgTable('ledger_entries', {
  id: uuid('id').primaryKey().defaultRandom(), transactionId: uuid('transaction_id').notNull().references(() => ledgerTransactions.id),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id), direction: ledgerDirectionEnum('direction').notNull(),
  amountKobo: bigint('amount_kobo', { mode: 'number' }).notNull(), currency: text('currency').notNull().default('NGN'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('ledger_entries_wallet_idx').on(t.walletId, t.createdAt),
  index('ledger_entries_transaction_idx').on(t.transactionId),
]);

export const campaignReservations = pgTable('campaign_reservations', {
  id: uuid('id').primaryKey().defaultRandom(), campaignId: uuid('campaign_id').notNull().references(() => campaigns.id),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id), amountKobo: bigint('amount_kobo', { mode: 'number' }).notNull(),
  consumedKobo: bigint('consumed_kobo', { mode: 'number' }).notNull().default(0), releasedKobo: bigint('released_kobo', { mode: 'number' }).notNull().default(0), ...timestamps,
}, (t) => [uniqueIndex('campaign_reservation_unique').on(t.campaignId)]);

export const paymentAttempts = pgTable('payment_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  businessId: uuid('business_id').notNull().references(() => businesses.id),
  provider: text('provider').notNull().default('paystack'),
  reference: text('reference').notNull(),
  accessCode: text('access_code'),
  amountKobo: bigint('amount_kobo', { mode: 'number' }).notNull(),
  currency: text('currency').notNull().default('NGN'),
  status: text('status').notNull().default('initialized'),
  providerResponse: jsonb('provider_response').$type<Record<string, unknown>>().notNull().default({}),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex('payment_attempt_reference_unique').on(t.reference),
  index('payment_attempt_campaign_idx').on(t.campaignId, t.createdAt),
]);

export const promoterApplications = pgTable('promoter_applications', {
  id: uuid('id').primaryKey().defaultRandom(), campaignId: uuid('campaign_id').notNull().references(() => campaigns.id),
  promoterId: uuid('promoter_id').notNull().references(() => promoters.id), status: assignmentStatusEnum('status').notNull().default('applied'),
  message: text('message'), ...timestamps,
}, (t) => [uniqueIndex('application_campaign_promoter_unique').on(t.campaignId, t.promoterId)]);

export const campaignPromoters = pgTable('campaign_promoters', {
  id: uuid('id').primaryKey().defaultRandom(), campaignId: uuid('campaign_id').notNull().references(() => campaigns.id),
  promoterId: uuid('promoter_id').notNull().references(() => promoters.id), status: assignmentStatusEnum('status').notNull().default('accepted'),
  targetQuantity: integer('target_quantity').notNull(), verifiedResults: integer('verified_results').notNull().default(0),
  termsVersion: integer('terms_version').notNull(), ...timestamps,
}, (t) => [uniqueIndex('assignment_campaign_promoter_unique').on(t.campaignId, t.promoterId)]);

export const referralLinks = pgTable('referral_links', {
  id: uuid('id').primaryKey().defaultRandom(), campaignId: uuid('campaign_id').notNull().references(() => campaigns.id),
  promoterId: uuid('promoter_id').notNull().references(() => promoters.id), code: text('code').notNull(), destinationUrl: text('destination_url').notNull(),
  isActive: boolean('is_active').notNull().default(true), ...timestamps,
}, (t) => [uniqueIndex('referral_code_unique').on(t.code), uniqueIndex('referral_campaign_promoter_unique').on(t.campaignId, t.promoterId)]);

export const trackingEvents = pgTable('tracking_events', {
  id: uuid('id').primaryKey().defaultRandom(), campaignId: uuid('campaign_id').notNull().references(() => campaigns.id),
  promoterId: uuid('promoter_id').notNull().references(() => promoters.id), referralId: uuid('referral_id').notNull().references(() => referralLinks.id),
  eventType: text('event_type').notNull(), anonymousIdHash: text('anonymous_id_hash'), ipHash: text('ip_hash'), userAgentHash: text('user_agent_hash'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}), occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('tracking_events_referral_idx').on(t.referralId, t.occurredAt)]);

export const conversions = pgTable('conversions', {
  id: uuid('id').primaryKey().defaultRandom(), campaignId: uuid('campaign_id').notNull().references(() => campaigns.id),
  promoterId: uuid('promoter_id').notNull().references(() => promoters.id), referralId: uuid('referral_id').notNull().references(() => referralLinks.id),
  externalReference: text('external_reference').notNull(), conversionType: text('conversion_type').notNull(),
  valueKobo: bigint('value_kobo', { mode: 'number' }), currency: text('currency').notNull().default('NGN'),
  status: conversionStatusEnum('status').notNull().default('detected'), rejectionReason: text('rejection_reason'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }), ...timestamps,
}, (t) => [
  uniqueIndex('conversion_external_reference_unique').on(t.externalReference),
  index('conversions_campaign_status_created_idx').on(t.campaignId, t.status, t.createdAt),
  index('conversions_promoter_created_idx').on(t.promoterId, t.createdAt),
]);

export const verificationResults = pgTable('verification_results', {
  id: uuid('id').primaryKey().defaultRandom(), conversionId: uuid('conversion_id').notNull().references(() => conversions.id),
  outcome: text('outcome').notNull(), checks: jsonb('checks').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const fraudFlags = pgTable('fraud_flags', {
  id: uuid('id').primaryKey().defaultRandom(), conversionId: uuid('conversion_id').references(() => conversions.id),
  promoterId: uuid('promoter_id').references(() => promoters.id), rule: text('rule').notNull(), riskScore: integer('risk_score').notNull(),
  details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}), resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('fraud_flags_resolved_created_idx').on(t.resolvedAt, t.createdAt)]);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(), actorUserId: uuid('actor_user_id').references(() => users.id), action: text('action').notNull(),
  resourceType: text('resource_type').notNull(), resourceId: uuid('resource_id'), metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('audit_logs_resource_created_idx').on(t.resourceType, t.resourceId, t.createdAt),
  index('audit_logs_actor_created_idx').on(t.actorUserId, t.createdAt),
]);

export const payoutAccounts = pgTable('payout_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  promoterId: uuid('promoter_id').notNull().references(() => promoters.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), bankCode: text('bank_code').notNull(), accountLast4: text('account_last4').notNull(),
  accountName: text('account_name').notNull(), providerRecipientCode: text('provider_recipient_code').notNull(),
  isDefault: boolean('is_default').notNull().default(true), ...timestamps,
}, (t) => [uniqueIndex('payout_provider_recipient_unique').on(t.provider, t.providerRecipientCode)]);

export const withdrawals = pgTable('withdrawals', {
  id: uuid('id').primaryKey().defaultRandom(), promoterId: uuid('promoter_id').notNull().references(() => promoters.id),
  payoutAccountId: uuid('payout_account_id').notNull().references(() => payoutAccounts.id), amountKobo: bigint('amount_kobo', { mode: 'number' }).notNull(),
  feeKobo: bigint('fee_kobo', { mode: 'number' }).notNull().default(0), netAmountKobo: bigint('net_amount_kobo', { mode: 'number' }).notNull(),
  currency: text('currency').notNull().default('NGN'), status: withdrawalStatusEnum('status').notNull().default('requested'),
  idempotencyKey: text('idempotency_key').notNull(), providerReference: text('provider_reference'), failureReason: text('failure_reason'),
  processedBy: uuid('processed_by').references(() => users.id), processedAt: timestamp('processed_at', { withTimezone: true }), ...timestamps,
}, (t) => [
  uniqueIndex('withdrawal_idempotency_unique').on(t.idempotencyKey),
  index('withdrawal_promoter_status_idx').on(t.promoterId, t.status),
  index('withdrawal_status_created_idx').on(t.status, t.createdAt),
]);

export const disputes = pgTable('disputes', {
  id: uuid('id').primaryKey().defaultRandom(), openedByUserId: uuid('opened_by_user_id').notNull().references(() => users.id),
  campaignId: uuid('campaign_id').references(() => campaigns.id), conversionId: uuid('conversion_id').references(() => conversions.id),
  subject: text('subject').notNull(), description: text('description').notNull(), status: disputeStatusEnum('status').notNull().default('open'),
  resolution: text('resolution'), assignedAdminId: uuid('assigned_admin_id').references(() => users.id), resolvedAt: timestamp('resolved_at', { withTimezone: true }), ...timestamps,
}, (t) => [index('dispute_status_created_idx').on(t.status, t.createdAt)]);

export const disputeEvidence = pgTable('dispute_evidence', {
  id: uuid('id').primaryKey().defaultRandom(), disputeId: uuid('dispute_id').notNull().references(() => disputes.id, { onDelete: 'cascade' }),
  submittedByUserId: uuid('submitted_by_user_id').notNull().references(() => users.id), kind: text('kind').notNull(),
  storageKey: text('storage_key'), statement: text('statement'), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const proofSubmissions = pgTable('proof_submissions', {
  id: uuid('id').primaryKey().defaultRandom(), assignmentId: uuid('assignment_id').notNull().references(() => campaignPromoters.id),
  promoterId: uuid('promoter_id').notNull().references(() => promoters.id), platform: text('platform').notNull(), storageKey: text('storage_key'),
  submittedUrl: text('submitted_url'), externalPostId: text('external_post_id'), externalAuthorId: text('external_author_id'),
  verificationMethod: text('verification_method').notNull().default('manual'), automatedChecks: jsonb('automated_checks').$type<Record<string, unknown>>().notNull().default({}),
  claimedViews: integer('claimed_views'), status: proofStatusEnum('status').notNull().default('submitted'),
  reviewedBy: uuid('reviewed_by').references(() => users.id), reviewReason: text('review_reason'), reviewedAt: timestamp('reviewed_at', { withTimezone: true }), ...timestamps,
}, (t) => [index('proof_status_created_idx').on(t.status, t.createdAt), uniqueIndex('proof_platform_post_unique').on(t.platform, t.externalPostId)]);

export const proofMetricSnapshots = pgTable('proof_metric_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(), proofSubmissionId: uuid('proof_submission_id').notNull().references(() => proofSubmissions.id, { onDelete: 'cascade' }),
  views: integer('views'), likes: integer('likes'), comments: integer('comments'), shares: integer('shares'), rawResponseHash: text('raw_response_hash'),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('proof_metrics_submission_idx').on(t.proofSubmissionId, t.capturedAt)]);

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(), userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), title: text('title').notNull(), body: text('body').notNull(), data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  readAt: timestamp('read_at', { withTimezone: true }), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('notifications_user_created_idx').on(t.userId, t.createdAt)]);

export const inboundWebhookEvents = pgTable('inbound_webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(), provider: text('provider').notNull(), externalId: text('external_id').notNull(),
  eventType: text('event_type').notNull(), payloadHash: text('payload_hash').notNull(), status: text('status').notNull().default('received'),
  attempts: integer('attempts').notNull().default(0), lastError: text('last_error'), processedAt: timestamp('processed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('webhook_provider_external_unique').on(t.provider, t.externalId), index('webhook_status_created_idx').on(t.status, t.createdAt)]);
