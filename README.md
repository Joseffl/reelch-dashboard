# Reelch

Reelch is a performance advertising marketplace connecting businesses with promoters and rewarding verified outcomes.

## Repository structure

```text
frontend/   Next.js web application for Business, Promoter, and Admin experiences
backend/    NestJS API and a separate PostgreSQL-backed background worker
```

The applications deliberately keep their own dependencies and lockfiles. Root scripts run checks across both without blending their source trees.

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
