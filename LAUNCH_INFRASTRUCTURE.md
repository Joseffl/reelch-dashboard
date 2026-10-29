# Launch infrastructure

The API and background worker share the NestJS codebase and PostgreSQL, but run
as separate processes and can scale independently. No Redis is required.
The queue is pg-boss, which stores durable jobs in the `pgboss` schema.

## Implemented

- Native asynchronous bcrypt with bounded concurrent work, a bounded waiting
  queue and a waiting timeout. Existing bcryptjs hashes remain compatible.
- Atomic PostgreSQL rate limits shared across API replicas for login, signup,
  invite acceptance, waitlist and contact submissions. Email and IP identifiers
  are HMAC-hashed in storage. IPv6 clients are grouped by /64.
- Database pool/query timeouts, idle connection error handling, Vercel pool
  lifecycle integration, and graceful shutdown.
- Signup uniqueness conflicts return 409 even when submissions race.
- Transactional account + welcome job creation when `JOBS_ENABLED=true`.
- Signed Paystack charge-success webhooks persist a receipt and job in one
  transaction before acknowledging. Duplicate references enqueue once.
- Payment workers verify with Paystack before using existing ledger flows.
  Wallet deposit delivery is idempotent under concurrent retries; deposit
  notifications now commit with their ledger transaction.
- Worker retries with backoff, a dead-letter queue, bounded concurrency,
  scheduled rate-limit cleanup, health checks and periodic queue/pool metrics.
- HTTP request IDs, route-pattern logs, latency/status logging, no-store API
  responses and production secret validation.
- A backend Docker image, isolated database integration tests and k6 scenarios.

Social verification and conversion processing retain their existing request
flows. Resend confirmations are available for waitlist submissions and new
accounts; account welcome jobs also create the existing in-app notification.

## Resend confirmation emails

Add these server-only variables to `backend/.env` locally and the Vercel project
environment for both API and daemon:

```dotenv
EMAIL_ENABLED=true
JOBS_ENABLED=true
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=Reelch <hello@your-verified-domain.com>
EMAIL_REPLY_TO=support@your-domain.com
EMAIL_WORKER_CONCURRENCY=1
FRONTEND_URL=https://your-public-app-domain.com
```

`EMAIL_REPLY_TO` is optional; use a monitored mailbox if configured. Verify your
sending domain in Resend by publishing the DNS records it supplies before using
that domain in `EMAIL_FROM`. The API key must have sending permission for it.
Set `FRONTEND_URL=http://localhost:3000` for local links; production links should
use the actual public HTTPS domain. A sending-only integration does not require
an SMTP password or a Resend webhook secret. Delivery/bounce webhooks are a
separate integration, not implemented by these confirmation emails.

Run `npm run dev:setup` after this update to apply the email-delivery migration
and provision the new queue, then restart `npm run dev`. For deployment, run
migrations/provisioning before enabling email and restarting the API/daemon.
Email remains disabled by default until `EMAIL_ENABLED=true`; an API key alone
does not enable it. Startup rejects enabled email with missing sender/key/jobs.
These notifications apply to submissions made after enabling them; existing
waitlist entries/accounts are not automatically bulk emailed.

Waitlist entries are upserted and get one confirmation per entry; resubmission
updates their details without repeated email. Account welcome emails are sent
once per new account. A stored immutable message and its queue job commit with
the account/waitlist write, so workers can retry without losing the request.
Messages include HTML and plain text, escaped user names, and an optional reply-to.
Provider acceptance is recorded with Resend's message ID, which is not proof of
inbox delivery. Inspect delivery status in Resend.

The worker sends a stable idempotency key and skips already accepted messages.
Resend retains those keys for 24 hours; ambiguous retries older than 23 hours
are stopped for manual review instead of risking duplicate email. Inspect the
provider and queue logs before redriving such a message. No real emails were
sent during implementation tests; provider responses were mocked.

References: [verified domains](https://resend.com/docs/dashboard/domains/introduction),
[email API](https://resend.com/docs/api-reference/emails/send-email),
[retry idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Deployment order

### Vercel Services and Daemon (primary deployment)

The root `vercel.json` deploys `frontend/` as the Next.js `web` service,
`backend/` as the NestJS `api` service, and `backend/Dockerfile.worker` as a
private worker daemon. `/api/*` routes to NestJS with its original path;
all other paths route to Next.js. npm and the separate service lockfiles remain.
There are no internal bindings because browser calls use the public `/api/v1`
route and the worker consumes PostgreSQL directly.

API functions and one initial daemon instance run in `cle1`, near the current
Neon `us-east-2` database. Change both region settings if the database moves.
Worker count is explicit, not automatic queue-depth scaling. Increase it only
within the database connection budget. Daemon shutdown grace is 45 seconds,
allowing the worker's 30-second graceful job shutdown to finish.

Vercel dashboard setup:

1. Import/link the repository root (`./`) and select the **Services** framework
   preset. Remove dashboard build/output overrides from the old separate projects;
   each service's checked-in configuration owns its install and build commands.
2. Set Node 22.x. Use a current Vercel CLI for local checks; the installed
   CLI 50.31.1 predates this Services/daemon configuration. Do not rewrite valid
   object-form service destinations to accommodate that older CLI.
3. Configure the project environment values below, using a separate staging
   database/Neon branch and Paystack test keys for acceptance testing.
4. Run the migration and queue provisioning commands below against that target
   database from a trusted release environment, before enabling workers/API jobs.
5. Set `JOBS_ENABLED=true` and deploy. The worker image starts
   `node dist/worker.js`, sets `REELCH_WORKER=true` and disables HTTP probes.
   Do not import it as an HTTP service or route traffic to it. Observe
   `worker_ready` and `worker_metrics` in Vercel logs instead.
6. Verify `/api/v1/health`, `/api/v1/ready`, web login, signup, welcome notification
   delivery, signed Paystack webhooks and private uploads before moving domains.
   Keep the old projects available until that verification succeeds; avoid running
   duplicate worker fleets against the same production queue during cutover.

Required project settings include:

```dotenv
NEXT_PUBLIC_API_URL=/api/v1
FRONTEND_URL=https://YOUR-SHARED-APP-DOMAIN
NODE_ENV=production
JOBS_ENABLED=true
```

Also set `DATABASE_URL`, production-strength signing/encryption secrets, R2
credentials, Paystack keys and callback URL, and the relevant limits from
`backend/.env.example`. Never expose secrets through `NEXT_PUBLIC_` variables.
Clear any old localhost or separate-backend `NEXT_PUBLIC_API_URL` override;
it is embedded at build time, so rebuild after changing it. `FRONTEND_URL` must
be the public browser origin. Point Paystack's webhook at
`https://YOUR-SHARED-APP-DOMAIN/api/v1/webhooks/paystack`, configure callback/R2
CORS for that origin, and ensure deployment protection allows signed webhooks.
Worker-specific flags are baked into its image; don't set `REELCH_WORKER` or
`WORKER_HTTP_ENABLED=false` globally for the HTTP services.

Local Docker and pnpm are not required. npm runs both HTTP services and the Node
worker locally. Vercel uses `Dockerfile.worker` to build the deployed daemon
remotely, just as in the HMS setup. Local testing does not verify that remote
container build, so retain the hosted staging acceptance step.

Daemons currently run on Production deployments. Use a separate Vercel staging
project's Production deployment with a staging database to test the full stack;
don't treat a Preview deployment as proof a worker is running. `vercel dev --local`
does not start the daemon; run `npm --prefix backend run start:worker` separately
after building, against the same test database. Standalone development keeps its
localhost API default; Vercel builds default to the shared `/api/v1` route.

Backend constructors use explicit `@Inject(...)` tokens because Vercel's source
transpilation does not reliably emit inferred TypeScript constructor metadata.
Keep these tokens when adding or changing injected dependencies.

References: [Services](https://vercel.com/docs/services),
[routing](https://vercel.com/docs/services/routing),
[daemon configuration](https://vercel.com/docs/daemons/config-reference).

### Database provisioning and alternative hosts

Use Node 22.22.3 or newer in the Node 22 line. API, worker and database should
be in the same region. Use a managed PostgreSQL database with automated backups
and point-in-time recovery; perform a restore drill before launch.

1. Install backend dependencies with `npm ci` and run `npm run build`.
2. Set deployment secrets, `DATABASE_URL`, and an HTTPS `FRONTEND_URL`.
   Production JWT and conversion webhook secrets must be non-placeholder values
   of at least 32 characters. API and workers need the same relevant secrets.
3. Run `npm run db:migrate` from `backend/` once per release, before rolling out
   the new API. The new rate-limit table is required even with jobs disabled.
4. Run `npm run jobs:provision` from `backend/` once to install/upgrade pg-boss
   and create the queues. Use a migration role with schema/table creation rights.
   Runtime processes do not migrate pg-boss automatically.
5. Deploy a persistent worker with `JOBS_ENABLED=true`, start command
   `npm run start:worker`, and readiness probe `/ready` on `WORKER_PORT` (4001).
   Set `SERVICE_NAME=reelch-worker` for database connection identification.
   Ensure the worker has Paystack and storage configuration needed by its jobs.
6. Deploy API instances with `JOBS_ENABLED=true`, start command
   `npm run start:prod`, and readiness probe `/api/v1/ready` on `PORT` (4000).
   The API readiness check verifies DB connectivity and required queue existence;
   it does not prove a consumer is running. Monitor workers separately.
7. Verify signup, login, welcome delivery and a Paystack test-mode deposit in
   staging before directing launch traffic to production.

`JOBS_ENABLED` defaults to false to allow deployment before queues and consumers
are provisioned. False uses the existing synchronous payment webhook path and
does not create welcome jobs. Drain queued jobs before removing worker capacity;
disabling producers does not drain jobs already stored.

For a container deployment, build with `docker build -t reelch-backend backend`.
The default command starts the API. Use `node dist/worker.js` for the worker
service from the same image. Set the worker service port to 4001 explicitly.
Run migration/provision commands from a release job with development dependencies
installed, or use the compiled `node dist/jobs/provision.js` for queue provisioning.
Give processes at least 40 seconds to terminate so workers can finish jobs.

For Vercel, the root Services configuration owns routing. The old backend-only
rewrite configuration and `api/index.ts` wrapper were removed to avoid conflicting
with native NestJS service detection. The cached NestJS implementation lives in
`backend/src/main.ts`; it opens a TCP listener only outside Vercel. The general
`backend/Dockerfile` remains available for other hosts; the daemon uses
`backend/Dockerfile.worker`, whose build context is `backend/`.

Repository checks and isolated integration tests passed during implementation,
including a compiled-worker readiness/delivery/shutdown smoke test. The Docker
image build was not exercised because the local Docker daemon was unavailable.
The dependency audit still reports existing findings (19 total, including 7 high
at implementation time); review and remediate these separately before launch.

## Connection and scaling budget

The main limit is the database, not the number of Node processes. Budget:

```
(maximum API instances × API DB_POOL_MAX)
+ (maximum worker instances × worker DB_POOL_MAX)
+ migration, admin and monitoring headroom
<= usable database connection limit
```

An illustrative starting budget for a database with 100 usable connections is
6 API instances × 8 connections, 2 workers × 8 connections, and 20 connections
of headroom: 84 connections total. This is a budget example, not a tested sizing
recommendation. pg-boss reuses each worker/API process's application pool.

Use a provider pooler if needed and validate it with transaction/queue tests.
Workers use polling, not LISTEN/NOTIFY. Keep migration/provisioning on a direct
database connection. Keep server-side statement timeouts in the pooler's database
configuration where startup parameters are unsupported.

Use the hosting platform's autoscaling rather than spawning Node instances in
the app. Start with warm API capacity and a persistent worker. Choose maximum
replicas from the connection budget. Scale APIs on sustained CPU/request latency;
scale workers on ready-job count and oldest-ready-job age. Validate thresholds
with staging measurements before using them for production autoscaling.

Defaults are deliberately bounded: `PASSWORD_CONCURRENCY=4`,
`PASSWORD_QUEUE_MAX=64`, `PASSWORD_QUEUE_TIMEOUT_MS=5000`,
`WORKER_CONCURRENCY=4`, `PAYMENT_WORKER_CONCURRENCY=2`.
Set `UV_THREADPOOL_SIZE` before starting Node and coordinate it with CPU capacity.
More hashing threads do not create more CPU. Overload returns 503; callers should
show a retry message, and financial retries must preserve idempotency keys.

## Rate limits and proxies

The default window is 10 minutes. Login and signup allow 120 requests per IP;
login additionally allows 20 per email, signup 5 per email. Waitlist allows 120,
contact 30, and administrator invite acceptance 30 per IP. All are configurable
in `backend/.env.example`. Tune IP limits for users sharing carrier/NAT addresses.
An account limit can temporarily block a targeted email; monitor abuse and tune
the limits rather than relying on these alone for bot defense.

`TRUSTED_PROXY_CIDRS` is empty by default, so forwarded IP headers are ignored.
For a reverse proxy, configure the exact proxy addresses/CIDRs supplied by your
host. Check the real request IP behavior in staging: without correct proxy trust,
clients may share a proxy's IP and throttle one another. Do not set blanket trust
or accept caller-controlled forwarded headers. Add platform/CDN WAF and bot rules
before the API to stop floods before they consume database connections. Those
rules require hosting/account configuration and have not been provisioned here.

The cleanup worker removes expired rate-limit records every 10 minutes in batches
of 10,000. If workers are disabled, schedule equivalent database housekeeping:

```sql
DELETE FROM request_rate_limits WHERE key IN (
  SELECT key FROM request_rate_limits
  WHERE expires_at < now() - interval '1 hour' LIMIT 10000
);
```

## Monitoring and failed jobs

Ingest structured `http_request`, `worker_error` and `worker_metrics` logs into
your monitoring provider. HTTP logs contain route patterns rather than invitation
tokens or query strings. Alert on elevated 5xx/429, registration p95/p99 latency,
CPU/memory, database waiting connections, oldest-ready-job age, failed/dead-letter
jobs, and missing worker metric heartbeats. Worker metrics are emitted every
30 seconds. Set database and hosting spending alerts before launch.

From `backend/`, run `npm run jobs:manage -- status` to inspect queue counts and
age. Inspect a failed job in an authorized database/admin tool, fix the cause,
then use `npm run jobs:manage -- redrive <dead-letter-job-uuid>` for one reviewed
job. Do not replay all financial jobs indiscriminately. Welcome notifications
use a stable recipient-derived ID, including across dead-letter redrives.
The original queue retains terminal failures according to its retention policy;
queue retention is seven days for welcome/payment jobs. Inspect and remediate
failures before that window expires, and retain webhook receipts for audit.

## Verification and load testing

Local acceptance was exercised through Vercel CLI 65.5.0's Services router with
PostgreSQL on localhost and a separate native Node worker, without Docker:

- `npm run check` passed: frontend/backend lint, regular tests and both builds.
- All 18 backend unit/database integration tests, three HTTP entrypoint/webhook
  tests and seven browser tests passed in the October 28, 2026 acceptance run.
- API health and database/queue readiness returned 200 through `/api/v1`.
- Seven Chromium browser checks passed: admin login/sidebar navigation, business
  and promoter registration/onboarding, verification review/approval, desktop and
  mobile early-access navigation, and incomplete administrator invitation handling.
- Eight concurrent signups, eight login/profile checks and eight actual worker
  welcome deliveries passed. A separately re-enqueued welcome job did not create
  a duplicate notification. Registration took 346–590 ms in that small local run;
  these timings are not a production capacity prediction.
- The backend suite covers signup races, shared limits, transactional rollback,
  signed webhooks, concurrent payment deduplication and retry handling. External
  payment verification is mocked; no real payment was made.

To repeat browser acceptance, start the Services router with a current Vercel CLI
and `NEXT_PUBLIC_API_URL=/api/v1`, and set its `DATABASE_URL` to the same disposable
localhost database as the worker. Use `FRONTEND_URL=http://localhost:3100` with
`vercel dev --local --listen 3100`. Run the worker with
`WORKER_HTTP_ENABLED=false` to match the daemon behavior. Provision queues first
and seed a test-only admin in that local database. Keep test credentials separate
from hosted credentials and set `DOTENV_CONFIG_PATH=/dev/null` when isolating
backend processes from `backend/.env`.

```sh
# From frontend/; ADMIN_EMAIL and ADMIN_PASSWORD must refer to the local test admin.
TEST_DATABASE_URL=postgresql://user:password@127.0.0.1:5432/reelch_launch PLAYWRIGHT_BASE_URL=http://localhost:3100 npm run test:e2e
# From backend/, while the local router and worker are running:
TEST_DATABASE_URL=postgresql://user:password@127.0.0.1:5432/reelch_launch LOCAL_BASE_URL=http://localhost:3100 npm run test:local-stack
```

Install Chromium with `npx playwright install chromium` if needed. Browser tests
no longer load `backend/.env` and refuse a non-local test database. The stack smoke
script also enforces localhost endpoints and creates fixture accounts in that
disposable database. Stop test workers before running the backend queue integration
suite, which owns its own consumer for retry assertions.

Regular checks from `backend/`:

```sh
npm run lint
npm run test
npm run test:e2e
npm run build
```

Integration tests only run with an explicit `TEST_DATABASE_URL` pointing to
localhost. Use a dedicated disposable PostgreSQL database, migrate it first,
then run:

```sh
TEST_DATABASE_URL=postgresql://user:password@127.0.0.1:5432/reelch_launch npm run test:launch
```

These tests create accounts/financial fixtures in that database and validate
signup races, transactional queue rollback, shared rate limits, spoofed forwarding
headers, signed webhook deduplication, concurrent deposit delivery, and job retry
deduplication. They do not contact Paystack; its verification response is mocked.

Install k6 separately, then run from the repository root against staging:

```sh
ALLOW_LOAD_TEST=yes BASE_URL=https://staging-api.example.com FRONTEND_URL=https://staging.example.com MODE=browse VUS=100 k6 run backend/load/launch.js
ALLOW_LOAD_TEST=yes BASE_URL=https://staging-api.example.com MODE=signup RUN_ID=unique-run-id VUS=100 k6 run backend/load/launch.js
ALLOW_LOAD_TEST=yes BASE_URL=https://staging-api.example.com MODE=burst RUN_ID=another-unique-id VUS=1000 k6 run backend/load/launch.js
```

Signup and burst modes create real staging accounts. They exercise registration,
login and profile retrieval; browse exercises frontend pages and API health.
Use distinct run IDs across distributed generators. A single generator shares an
IP and will hit protective rate limits. First test that protection; then run a
capacity test with distributed generators or raise staging-only IP limits while
leaving production protection enabled. Don't spoof forwarding headers to bypass
limits. Count 429/503 separately; they still fail the default success thresholds.

Test ramp-up, sudden bursts, sustained load, worker restarts, external dependency
outages and recovery. Database transactions and queues do not by themselves prove
capacity for 1,000 simultaneous signups. The 1,000-user load test has not been run
as part of this implementation. Provision staging capacity and tune from results.

## Cloudflare

Cloudflare R2 remains the upload storage path. Cloudflare CDN/WAF/bot protection
can be used independently of the job runtime. Cloudflare Workers with Queues is
an alternative managed execution model, not a prerequisite for these workers.
Moving there would require a separate queue adapter, runtime/dependency review,
and an outbox to retain atomic database-write/job-publication guarantees across
PostgreSQL and the external queue. No Cloudflare resources were provisioned.

References: [pg-boss](https://pgboss.io/introduction),
[Cloudflare Queues](https://developers.cloudflare.com/queues/reference/how-queues-works/),
[Workers compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/),
[Vercel connection pooling](https://vercel.com/kb/guide/connection-pooling-with-functions).
