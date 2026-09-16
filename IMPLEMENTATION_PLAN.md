# Reelch Implementation Plan

## 1. Delivery strategy

Reelch should be built as a sequence of working vertical slices, not as three disconnected dashboards. The first usable release must prove the marketplace loop:

```text
Business creates and funds an acquisition campaign
  -> Admin approves it
  -> Promoter discovers and joins it
  -> Promoter shares a unique referral link
  -> A result is received and verified
  -> Business sees the result
  -> Promoter receives an earning in the ledger
  -> Admin can audit the entire chain
```

This loop is the MVP. Visibility campaigns, sophisticated matching, social APIs, automated fraud scoring, messaging, and real-time features should not delay it.

## 2. Scope decisions for V1

### Included

- One web application with role-based Business, Promoter, and Admin areas
- One user account with one or more role-specific profiles
- Acquisition campaigns, beginning with `signup_completed`
- NGN as the first currency, stored in kobo as integers
- Manual business and promoter verification
- Admin campaign moderation
- Business wallet funding and campaign fund reservation
- Promoter applications and acceptance
- Unique referral links and first-party click tracking
- Signed conversion webhook ingestion
- Manual/automatic basic result verification
- Double-entry-style immutable ledger and promoter earnings
- Withdrawal requests with manual admin processing
- Basic fraud rules, disputes, notifications, and audit logs
- Responsive business/admin UI and mobile-first promoter UI
- WCAG 2.2 AA baseline

### Deferred until after MVP

- Visibility/CPM campaigns and screenshot-based proof at scale
- Purchase/deposit conversion campaigns
- Automated promoter payouts
- Direct Instagram, TikTok, X, or YouTube analytics integrations
- ML recommendation or fraud models
- Full messaging/chat
- Multi-currency support
- Complex team management and fine-grained business workspaces
- WebSockets except where later evidence shows polling is inadequate

## 3. Proposed technical baseline

Use a TypeScript monorepo, but keep the initial deployment surface small.

```text
apps/
  web/                 Next.js: Business, Promoter, and Admin route groups
  api/                 NestJS HTTP API and webhook endpoints
  worker/              BullMQ background jobs
packages/
  ui/                  Shared design system
  database/            PostgreSQL schema, Drizzle, migrations
  contracts/           Shared API types and Zod schemas
  auth/                Roles, permissions, authorization helpers
  config/              Shared TypeScript/lint/build configuration
```

Initial infrastructure:

- PostgreSQL as the source of truth
- Redis for BullMQ, rate limits, idempotency, and short-lived state
- S3-compatible object storage for creatives and verification documents
- Mature hosted authentication provider, with internal `users` records
- Hosted email provider for transactional notifications
- Payment provider selected through a short spike before funding work begins
- Error monitoring, structured logs, and product analytics from the foundation phase

Splitting Business, Promoter, and Admin into separate frontend apps can happen later if deployment cadence, bundle isolation, or team ownership warrants it. Route groups in one web app reduce MVP overhead while shared domain boundaries preserve an easy future split.

## 4. Phased roadmap

## Phase 0 - Product and engineering foundation

**Goal:** Remove high-risk ambiguity and establish a deployable, testable skeleton.

### Product decisions

- Define exactly what a verified signup means.
- Define campaign pricing, platform fee, refund, cancellation, and dispute policies.
- Define verification requirements for businesses and promoters.
- Define withdrawal minimum, fee, review process, and settlement expectation.
- Choose authentication, payment, object-storage, email, and hosting providers.
- Document consent, privacy, data retention, and acceptable campaign rules.

### Engineering deliverables

- Initialize monorepo, package manager, TypeScript, linting, formatting, and CI.
- Scaffold `web`, `api`, `worker`, and shared packages.
- Add environment validation and local Docker services for PostgreSQL and Redis.
- Establish dev, test, staging, and production configuration boundaries.
- Add health/readiness endpoints, structured logging, and error monitoring.
- Create migration and seed workflows.
- Add unit, API integration, and browser smoke-test harnesses.
- Record architecture decisions for money, authentication, campaign states, and event idempotency.

### UX deliverables

- Define tokens for color, typography, spacing, radius, shadow, and motion.
- Build core accessible primitives: button, input, select, dialog, drawer, tabs, badge, card, table, alert, toast, empty state, skeleton, and progress.
- Establish desktop shell and promoter mobile navigation patterns.

### Exit criteria

- CI passes lint, type checks, tests, and production builds.
- Web, API, and worker deploy to staging.
- Database migrations run safely on a clean environment.
- A seeded user can sign in and reach a role-aware placeholder dashboard.
- Provider choices and core business rules are documented.

---

## Phase 1 - Identity, onboarding, and access control

**Goal:** Users can join Reelch, establish a trusted role profile, and only access authorized capabilities.

### Domain and API

- `users`, `user_roles`, `businesses`, `promoters`, `admins`
- `verification_requests`, `verification_documents`, `social_accounts`
- `audit_logs`, `notifications`
- Authentication webhook synchronization with replay protection
- Server-side RBAC and resource ownership checks
- Signed upload flow for private verification documents

### Business experience

- Sign-up and role selection
- Progressive business profile onboarding
- Verification document submission and pending/rejected/verified states
- First-time checklist dashboard

### Promoter experience

- Mobile-first profile onboarding
- Audience/channel details
- Social account entry with an explicit `self_reported` or `verified` data label
- Identity and payout-account readiness checklist

### Admin experience

- Verification queues
- Business/promoter detail and evidence review
- Approve, reject with reason, request more information, suspend
- Audit trail for every sensitive action

### Exit criteria

- An unauthenticated user cannot reach protected routes or APIs.
- A user cannot access another account's resources by changing an ID.
- Verification transitions are enforced on the server and audited.
- Private documents are inaccessible without short-lived authorization.
- Onboarding works with keyboard and screen reader at the WCAG 2.2 AA baseline.

---

## Phase 2 - Campaign creation and moderation

**Goal:** A verified business can draft and submit a measurable acquisition campaign; Admin can moderate it.

### Domain and API

- `campaigns`, `campaign_creatives`, `campaign_requirements`, `campaign_status_history`
- Objective: `acquisition`; first conversion type: `signup_completed`
- Pricing model: `CPA`
- Campaign state machine:

```text
draft -> pending_review -> approved -> funding_required -> scheduled/live
draft/pending_review -> cancelled
pending_review -> rejected -> draft
live -> paused -> live
live/paused -> completed or cancelled
```

- Targeting stored in validated, versioned fields/JSON where appropriate
- Private draft creatives and controlled public delivery for approved campaigns

### Business experience

- Campaign list with draft, pending, live, paused, completed, rejected states
- Seven-step creation flow: objective, details, audience, budget, promoters, tracking, review
- Autosaved draft and validation per step
- Live creative preview
- Plain-language budget calculation in NGN
- Review and submit

### Admin experience

- Moderation queue with business, objective, budget, risk hints, and submission time
- Full campaign review, creative preview, approve/reject/request changes
- Status history and audit trail

### Exit criteria

- Only verified businesses can submit campaigns.
- Invalid status transitions fail regardless of frontend behavior.
- Budget totals use integer kobo and deterministic fee calculations.
- An approved campaign retains an immutable snapshot of the terms reviewed.
- Draft recovery, validation, error, empty, and permission states are covered.

---

## Phase 3 - Wallet, funding, and financial ledger

**Goal:** A business can fund and reserve a campaign without unsafe balance mutation.

### Domain and API

- `wallets`, `ledger_accounts`, `ledger_transactions`, `ledger_entries`
- `payment_intents`, `payment_webhook_events`, `campaign_reservations`
- Idempotency keys on every money-moving command
- Verified webhook storage before asynchronous processing
- Transactional posting with entries that always balance
- Reconciliation job and exception report

### Experiences

- Business wallet overview and transaction history
- Campaign funding checkout and status feedback
- Reserved versus available funds
- Admin transaction explorer and failed-webhook/reconciliation queue
- Refund/cancellation handling according to the Phase 0 policy

### Exit criteria

- A duplicated API call or webhook cannot duplicate funds.
- No code directly edits a cached `balance` as the financial source of truth.
- Campaigns cannot go live without sufficient reserved funds.
- Every displayed balance can be reconstructed from ledger entries.
- Reconciliation detects provider/platform mismatches.
- Financial integration and concurrency tests pass.

---

## Phase 4 - Promoter marketplace and campaign workspace

**Goal:** Eligible promoters can discover, join, and execute live campaigns with unambiguous rules and attribution links.

### Domain and API

- `promoter_applications`, `campaign_promoters`, `referral_links`
- Eligibility filters and deterministic recommendation score V0
- Application/assignment states: invited, applied, accepted, active, completed, rejected, removed
- Cryptographically random, non-enumerable referral codes

### Promoter experience

- Discovery marketplace with filters and sorting
- Campaign detail with reward, target, potential earnings, requirements, and prohibited behavior
- Apply/accept flow
- Workspace with progress, referral link, approved creative, brief, and status
- Copy/share link experience optimized for mobile

### Business experience

- Automatic matching as the default
- Review applicants, invite, accept, or remove promoters
- Promoter profile focused on verified historical performance rather than follower count

### Exit criteria

- Only eligible promoters can view protected campaign assets or join a campaign.
- A promoter has one active referral identity per campaign.
- Campaign terms presented to a promoter are versioned and auditable.
- Discovery and workspace are usable at narrow mobile widths.
- Empty, full, expired, removed, and paused campaign states are handled.

---

## Phase 5 - Attribution, verification, and earnings vertical slice

**Goal:** A unique referral can generate a trustworthy, billable signup and corresponding promoter earning.

### Domain and pipeline

- `tracking_sessions`, `events`, `webhook_events`, `conversions`
- `verification_results`, `fraud_flags`
- Redirect endpoint captures click/referral context with privacy-safe identifiers
- Signed conversion webhook accepts a stable external reference
- Raw webhook is persisted, acknowledged, and processed asynchronously
- Conversion pipeline:

```text
received -> detected -> pending_verification -> verified -> billable
                                             -> rejected
```

- Attribution rule documented and versioned (for example, last eligible Reelch referral within a defined window)
- Verification checks: signature, duplicate external reference, campaign eligibility, time window, promoter assignment, velocity/IP/device heuristics
- Atomic transaction reserves/consumes campaign funds, records business spend, platform fee, and pending promoter earning

### Experiences

- Business campaign command center with spend, verified results, CPA, progress, and promoter table
- Promoter workspace with detected, pending, verified, and rejected results
- Promoter earnings with available, pending, and lifetime totals
- Admin conversion trace showing source event, attribution, verification, fraud signals, and ledger transaction

### Exit criteria

- Replaying any webhook or job is financially harmless.
- A conversion can be traced from referral click through verification and ledger entries.
- Rejected conversions never consume campaign funds or credit earnings.
- Concurrent conversions cannot overspend the campaign reservation.
- PII is minimized, hashed where appropriate, access-controlled, and subject to retention rules.
- End-to-end test proves the complete marketplace loop.

This phase produces the first true MVP release candidate.

---

## Phase 6 - Withdrawals, disputes, and operational readiness

**Goal:** Promoters can request payouts and both marketplace sides have an auditable exception process.

### Domain and API

- `payout_accounts`, `withdrawals`, `withdrawal_attempts`
- `disputes`, `dispute_evidence`, `dispute_decisions`
- Available/pending/held earning states
- Withdrawal idempotency and balance locking
- Manual payout execution first; automated provider payout later

### Experiences

- Promoter withdrawal request, confirmation, history, and failure states
- Admin payout queue, review, mark processed/failed, and reconciliation
- Business and promoter dispute creation with structured evidence
- Admin dispute timeline, decision, adjustment/reversal, and required reason
- Email and in-app notifications for major state changes

### Exit criteria

- Pending/held money cannot be withdrawn.
- Concurrent requests cannot withdraw the same balance twice.
- Financial adjustments are compensating ledger transactions, never edits/deletes.
- Dispute and payout decisions require permissions, reasons, and audit records.
- Support runbooks cover stuck webhooks, failed jobs, reconciliation mismatches, and payout failure.

At this point the MVP can enter a controlled pilot with a small number of businesses and promoters.

---

## Phase 7 - Pilot hardening and visibility campaigns

**Goal:** Incorporate pilot evidence, improve resilience, then add the second objective without weakening verification.

### Pilot hardening

- Observability dashboards and alerts for webhook failures, queue lag, ledger imbalance, conversion anomalies, and error rates
- Rate limiting, abuse controls, file validation/malware scanning, security review, backups, and restore drill
- Performance/load testing around redirects, event ingestion, and conversion processing
- Data export/deletion and retention jobs
- Accessibility audit and remediation
- Funnel analytics for onboarding, campaign creation, promoter application, and conversion verification

### Visibility objective

- Add visibility pricing only after defining a credible verification method
- Start with narrowly supported platforms/proof types
- Proof submission and evidence review queues
- Impression/view deduplication and proof confidence status
- Explicitly distinguish verified platform data, manually reviewed proof, and self-reported metrics

### Exit criteria

- Pilot severity-one issues are closed or explicitly accepted.
- Recovery objectives and incident ownership are documented and tested.
- Visibility results cannot be represented as verified without supporting evidence.

---

## Phase 8 - Scale and product expansion

**Goal:** Improve automation and marketplace efficiency after enough real data exists.

- Purchase/subscription/deposit conversion types
- Automated payouts and richer payment reconciliation
- Rule engine for fraud and campaign approval
- Risk center and anomaly investigation tools
- Better recommendation ranking based on verified outcomes
- Business teams and expanded admin permission matrix
- Campaign quality score and optimization suggestions
- Richer funnel/ROI analytics and exports
- Messaging if research shows it is necessary
- Select social/platform integrations
- Additional currencies/countries after legal and payment readiness
- Split frontend deployments if operational needs justify it

---

## Phase 9 - Insight and communication

**Goal:** Turn operational data into useful decisions and keep users informed about consequential state changes.

- Role-scoped in-app notification feed with read state
- Notifications for verification, moderation, proof, dispute, and withdrawal decisions
- Admin aggregate analytics for campaigns, verified outcomes, users, disputes, and risk
- Business efficiency and funnel analytics built from verified events
- Promoter performance and earnings analytics
- Accessible data alternatives for every chart

---

## Phase 10 - Production readiness

**Goal:** Make the platform observable, recoverable, and safe to operate with real money and customer data.

- Separate liveness and database-readiness probes
- Durable inbound webhook receipts, retries, and idempotency
- Serializable withdrawal accounting and compensating reversals
- Expanded audit coverage for financial and trust decisions
- Rate limits, security headers, secret rotation, and session revocation
- Queue monitoring, reconciliation alerts, backup verification, and incident runbooks
- Load, accessibility, and security testing before broader release

## 5. Core data model sequence

Create tables in dependency order rather than all at once:

1. Identity: users, roles, businesses, promoters, admins, verification requests, social accounts.
2. Campaigns: campaigns, creatives, requirements, status history.
3. Finance: wallets, ledger accounts, transactions, entries, payments, reservations.
4. Marketplace: applications, assignments, referral links.
5. Attribution: sessions, events, webhooks, conversions, verification results, fraud flags.
6. Operations: withdrawals, disputes, notifications, audit logs.

All important domain records should use opaque IDs, timestamps, explicit status fields, and optimistic/concurrency controls where state races are possible. Financial and audit records are append-only.

## 6. Cross-cutting definition of done

Every feature is complete only when it includes:

- Server-side authorization and validated input
- Loading, empty, error, success, partial, pending, disabled, and permission states as applicable
- Accessible keyboard, focus, label, error, status, and touch behavior
- Responsive behavior for its target user
- Structured logs, actionable error reporting, and an audit record for sensitive actions
- Unit tests for domain rules, integration tests for persistence/API behavior, and a browser test for the critical path
- Migration, seed/fixture, API contract, and concise operational documentation
- No floating-point money, direct balance mutations, unsigned webhooks, or client-only permission checks

## 7. Initial implementation backlog

The first implementation cycle should complete these items in order:

1. Initialize the monorepo and pin the runtime/package-manager versions.
2. Scaffold web, API, worker, database, contracts, UI, auth, and config packages.
3. Add local PostgreSQL and Redis plus typed environment validation.
4. Configure CI for lint, type check, unit/integration tests, and production builds.
5. Add the initial users/roles schema and migrations.
6. Integrate authentication and synchronize authenticated users into PostgreSQL.
7. Implement server-side role and resource authorization.
8. Build the shared application shell and essential design-system components.
9. Seed Business, Promoter, Operations Admin, and Finance Admin test accounts.
10. Deliver role-aware placeholder dashboards and a full authentication browser test.

## 8. Decisions required before Phase 1 closes

These decisions should be made early, but they do not block repository scaffolding:

- Authentication provider
- Nigerian payment collection and payout provider(s)
- Hosting region/provider and managed PostgreSQL/Redis choices
- Object storage provider
- Business/promoter identity verification process and provider, if any
- Exact definition and evidence contract for a `verified signup`
- Platform fee, refund, cancellation, dispute, and withdrawal policies
- Attribution window and conflict rule
- Data retention periods and legal/privacy review owner

## 9. Release gates

- **Internal alpha:** End of Phase 4. Humans can exercise campaigns and referral links; conversion crediting may still be simulated.
- **MVP release candidate:** End of Phase 5. The full verified outcome and ledger loop works end to end.
- **Controlled pilot:** End of Phase 6. Withdrawals, disputes, reconciliation, auditability, and support procedures exist.
- **Broader beta:** Phase 7 hardening gates pass and pilot findings are addressed.
