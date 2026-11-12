# Reelch

Reelch is a performance advertising marketplace connecting businesses with promoters and rewarding verified outcomes.

Businesses of every size fund campaigns through PayPal. Everyday social media users promote them on TikTok, Instagram, X and WhatsApp. AI checks every proof, and promoters are paid through PayPal only for verified results.

Live app: <https://www.reelch.com>

## Built with

| Tool | What it does in Reelch | Where |
| --- | --- | --- |
| **PayPal Orders API v2** (sandbox) | Businesses fund campaign budgets through PayPal Checkout. The order is captured and held in a campaign escrow wallet in the Reelch ledger. | `backend/src/platform/paypal.service.ts` |
| **PayPal Payouts API** | Approved earnings are paid automatically to the promoter's PayPal account. Payout item status is synced through webhooks or polling. | `paypal.service.ts`, `backend/src/jobs/` |
| **PayPal Refunds** (Payments API v2) | When a business ends a campaign, the unspent budget is refunded to the original PayPal capture. | `paypal.service.ts` |
| **PayPal Webhooks** | Order approval, capture completion and payout item events keep Reelch in sync with PayPal. Receipts are stored and processed by retry-safe background jobs. | `backend/src/platform/platform.controller.ts` |
| **Google Gemini** (Gemini API, `gemini-3.5-flash-lite` by default) | Reviews each proof against the campaign brief and returns structured JSON: content match, requirement checks, the handle and views it reads, and fraud signals. Also powers **Ask Reelch**, which answers a business's questions from its own verified numbers. | `backend/src/ai/ai.service.ts`, `backend/src/platform/proof-review.ts`, `backend/src/platform/business-assistant.ts` |
| **AG Grid Community** (sponsor tool) | Powers the admin double-entry ledger and withdrawals tables, with sorting, filtering, quick search and CSV export, so every movement of money can be found and checked. | `frontend/src/components/data-grid.tsx`, `admin-ledger.tsx`, `admin-withdrawals.tsx` |
| **TikTok API** (Login Kit and Display API) | Promoters can connect TikTok, so Reelch reads video view counts straight from TikTok instead of relying on a screenshot. Tokens are encrypted with AES-256-GCM. | `backend/src/platform/tiktok.service.ts`, `token-crypto.ts` |

Also used: Next.js and Tailwind CSS (frontend, on Vercel), NestJS with Drizzle ORM on PostgreSQL (Neon), pg-boss for background jobs, Cloudflare R2 for file uploads, and sharp for image fingerprints.

## Repository structure

```text
frontend/   Next.js web application for Business, Promoter, and Admin experiences
backend/    NestJS API and a separate PostgreSQL-backed background worker
```

The applications deliberately keep their own dependencies and lockfiles. Root scripts run checks across both without blending their source trees.

## AI verification and PayPal settlement

Businesses fund campaigns with PayPal Checkout (Orders v2). The budget is held in a campaign escrow wallet in the Reelch ledger. When a promoter submits proof, Reelch:

1. Checks the post with platform data where available (X API, TikTok oEmbed, and view counts from a connected TikTok account), plus ownership, hashtag and view rules.
2. Sends the campaign brief, the platform data and the screenshot to a multimodal model. The model returns structured JSON: requirement checks, content match, extracted handle and views, and fraud signals.
3. Runs a deterministic policy (`backend/src/platform/proof-review.ts`). A proof is paid without a person only if every check passes. Anything else goes to the admin queue with the reasons.
4. Pays approved earnings to the promoter's PayPal email with the Payouts API, and keeps the payout status in sync through webhooks or polling.

Content match, fraud risk and assurance level ("Platform verified" or "Evidence reviewed") are kept separate. The model never decides a payout by itself.

Configure in `backend/.env`:

- `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`: the default is Gemini `gemini-3.5-flash-lite`. `AI_PROVIDER=openai-compatible` with `AI_BASE_URL` works with OpenAI, OpenRouter, Groq and similar APIs.
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV=sandbox`: from a REST app at developer.paypal.com.
- `PAYPAL_WEBHOOK_ID`: create a webhook pointing at `<api>/api/v1/webhooks/paypal` for `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED` and `PAYMENT.PAYOUTS-ITEM.*`. Locally, payouts sync when the promoter opens Earnings, so webhooks are optional.
- `AI_AUTO_APPROVE_EVIDENCE_ONLY=true` lets screenshot-only proofs auto-pay. Use it for demos only, because a screenshot cannot prove views.
- `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`: from a TikTok for Developers app with Login Kit and the `user.info.basic` and `video.list` scopes. Leave blank to turn off the TikTok connection; TikTok proofs then use screenshots.

A promoter's campaign slot opens up again if they submit no proof within 72 hours of joining, or don't resubmit within 24 hours of a rejection. Promoters with verified results keep their allocation. The windows are constants in `backend/src/platform/proof-review.ts`.

A business can end a live campaign once its proofs are decided. Unspent budget is refunded to the original PayPal capture, or to the business wallet for other funding. A campaign also completes by itself when its budget is fully spent.

Exact copies of a screenshot are caught by file hash. Re-saved copies are caught within a campaign by an image fingerprint combined with the view count the model read, because honest promoters posting the same creative look alike (`backend/src/platform/evidence-fingerprint.ts`).

`PAYMENT_PROVIDER=paystack` switches new campaigns back to NGN and Paystack. Existing NGN campaigns always settle through Paystack.

## Analytics, Ask Reelch and the ledger

Each business has an Analytics tab with pie charts of where its views and spending come from, a budget split (paid out, in escrow, refunded), cost per 1,000 views by platform, and results per campaign. Ask Reelch answers questions such as "Which platform gives us the most views for the money?" in plain English. The model only receives that business's own figures, already calculated and formatted, so it never does money maths itself.

Every movement of money is recorded in a double-entry ledger, where each transaction's debits equal its credits. Administrators review it in an AG Grid table they can sort, filter, search and export.

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
