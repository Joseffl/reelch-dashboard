# Reelch

Reelch is a performance advertising marketplace connecting businesses with promoters and rewarding verified outcomes.

## Repository structure

```text
frontend/   Next.js web application for Business, Promoter, and Admin experiences
backend/    NestJS API and a separate PostgreSQL-backed background worker
```

The applications deliberately keep their own dependencies and lockfiles. Root scripts run checks across both without blending their source trees.

## AI verification and PayPal settlement

Businesses fund campaigns with PayPal Checkout (Orders v2). The budget is held in a campaign escrow wallet in the Reelch ledger. When a promoter submits proof, Reelch:

1. Checks the post with platform data where available (X API, TikTok oEmbed), plus ownership, hashtag and view rules.
2. Sends the campaign brief, the platform data and the screenshot to a multimodal model. The model returns structured JSON: requirement checks, content match, extracted handle and views, and fraud signals.
3. Runs a deterministic policy (`backend/src/platform/proof-review.ts`). A proof is paid without a person only if every check passes. Anything else goes to the admin queue with the reasons.
4. Pays approved earnings to the promoter's PayPal email with the Payouts API, and keeps the payout status in sync through webhooks or polling.

Content match, fraud risk and assurance level ("Platform verified" or "Evidence reviewed") are kept separate. The model never decides a payout by itself.

Configure in `backend/.env`:

- `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`: the default is Gemini `gemini-3.5-flash-lite`. `AI_PROVIDER=openai-compatible` with `AI_BASE_URL` works with OpenAI, OpenRouter, Groq and similar APIs.
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV=sandbox`: from a REST app at developer.paypal.com.
- `PAYPAL_WEBHOOK_ID`: create a webhook pointing at `<api>/api/v1/webhooks/paypal` for `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED` and `PAYMENT.PAYOUTS-ITEM.*`. Locally, payouts sync when the promoter opens Earnings, so webhooks are optional.
- `AI_AUTO_APPROVE_EVIDENCE_ONLY=true` lets screenshot-only proofs auto-pay. Use it for demos only, because a screenshot cannot prove views.

A promoter's campaign slot opens up again if they submit no proof within 72 hours of joining, or don't resubmit within 24 hours of a rejection. Promoters with verified results keep their allocation. The windows are constants in `backend/src/platform/proof-review.ts`.

A business can end a live campaign once its proofs are decided. Unspent budget is refunded to the original PayPal capture, or to the business wallet for other funding. A campaign also completes by itself when its budget is fully spent.

Exact copies of a screenshot are caught by file hash. Re-saved copies are caught within a campaign by an image fingerprint combined with the view count the model read, because honest promoters posting the same creative look alike (`backend/src/platform/evidence-fingerprint.ts`).

`PAYMENT_PROVIDER=paystack` switches new campaigns back to NGN and Paystack. Existing NGN campaigns always settle through Paystack.

## Requirements

- Node.js 22.22.3 or newer in the Node 22 line
- npm 11+
- A hosted PostgreSQL database URL

## Local setup

1. Copy `backend/.env.example` to `backend/.env` and set the hosted `DATABASE_URL` plus application secrets.
2. Copy `frontend/.env.example` to `frontend/.env.local`.
3. Run `npm run db:migrate` from the repository root.
4. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` temporarily, then run `npm run db:seed-admin` once.
5. Run `npm run dev:setup` once to provision the database and job queues.
6. Run `npm run dev` to start the frontend, API and worker together. Ctrl+C stops
   all three. This command enables jobs for local development and watches source
   changes, including the worker; no manual build is needed.

The setup command uses `backend/.env`'s `DATABASE_URL`. Choose your development
database before running it. You can still run `dev:frontend`, `dev:backend` and
`dev:worker` separately when needed.

The API connects directly to the hosted PostgreSQL instance. A local database is not required.

Frontend: <http://localhost:3000>

Backend health: <http://localhost:4000/api/v1/health>

Backend readiness, including database connectivity: <http://localhost:4000/api/v1/ready>

## Licence

Reelch is released under the [MIT licence](./LICENSE).

## Checks

```bash
npm run check
npm run test:e2e
```

## Implemented API slice

- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`
- Business campaign creation, listing, submission, and promoter acceptance
- Admin identity review, campaign moderation, funding confirmation, and risk flags
- Promoter campaign discovery, applications, and earnings workspace
- Public referral redirects with privacy-safe click data
- HMAC-signed conversion ingestion and idempotent verified-result crediting
- Payout accounts, withdrawal holds/settlement/reversals, disputes, evidence, and proof review
- User notifications, admin aggregate analytics, durable webhook receipts, and database readiness

Protected endpoints require `Authorization: Bearer <accessToken>`. Funding confirmation is intentionally admin-only until a payment-provider webhook adapter is selected.

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for delivery phases and release gates.

See [LAUNCH_INFRASTRUCTURE.md](./LAUNCH_INFRASTRUCTURE.md) for worker provisioning,
deployment order, connection budgets, rate-limit/proxy configuration and load tests.

The root `vercel.json` defines a single Vercel Services deployment: Next.js web,
NestJS API at `/api/*`, and a PostgreSQL-backed worker daemon. Import the repository
root with the Services preset and set `NEXT_PUBLIC_API_URL=/api/v1`; provision the
database/queues before enabling `JOBS_ENABLED=true`. The worker Dockerfile lives
in `backend/` and uses that directory as its build context.

## Mobile QA changes

Promoter waitlist submissions now store multiple platforms, including a named Other platform. Apply migration `0010_thin_switch.sql` with `npm run db:migrate` before deploying the updated API. It backfills existing entries from their original primary platform. The public waitlist does not require an account; campaign participation continues to require authentication and existing verification checks.

Selected waitlist platforms each collect their own profile link; WhatsApp collects an international phone number. Migration `0011_worthless_the_captain.sql` adds these associations. Existing entries keep their original single profile link.
