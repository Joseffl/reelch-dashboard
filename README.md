# Reelch

Reelch is a performance advertising marketplace connecting businesses with promoters and rewarding verified outcomes.

## Repository structure

```text
frontend/   Next.js web application for Business, Promoter, and Admin experiences
backend/    NestJS API; workers will remain a separate backend process when added
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
5. Run `npm run dev:backend` and `npm run dev:frontend` in separate terminals.

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
