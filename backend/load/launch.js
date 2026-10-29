import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const base = __ENV.BASE_URL;
if (!base || __ENV.ALLOW_LOAD_TEST !== 'yes') throw new Error('Set BASE_URL to staging and ALLOW_LOAD_TEST=yes');
const mode = __ENV.MODE || 'browse';
if (!['browse', 'signup', 'burst'].includes(mode)) throw new Error('MODE must be browse, signup or burst');
const signup = mode !== 'browse';
if (!signup && !__ENV.FRONTEND_URL) throw new Error('Set FRONTEND_URL for browsing tests');
if (signup && !__ENV.RUN_ID) throw new Error('Set a unique RUN_ID: signup tests create real staging accounts');
const rejected = new Rate('capacity_rejected');
const errors = new Rate('unexpected_errors');
export const options = {
  scenarios: mode === 'burst'
    ? { launch: { executor: 'per-vu-iterations', vus: Number(__ENV.VUS || 1000), iterations: 1, maxDuration: '2m' } }
    : { launch: { executor: 'ramping-vus', startVUs: 0, stages: [
      { duration: '30s', target: Number(__ENV.VUS || 100) },
      { duration: '2m', target: Number(__ENV.VUS || 100) },
      { duration: '30s', target: 0 },
    ], gracefulRampDown: '30s' } },
  thresholds: {
    unexpected_errors: ['rate<0.01'],
    capacity_rejected: [`rate<${__ENV.MAX_REJECTION_RATE || '0.01'}`],
    ...(signup ? { 'http_req_duration{operation:register}': ['p(95)<3000', 'p(99)<10000'] } : {}),
    'http_req_duration{operation:health}': ['p(95)<1000'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const health = http.get(`${base}/api/v1/health`, { tags: { operation: 'health' } });
  check(health, { 'API reachable': r => r.status === 200 });
  errors.add(health.status !== 200);
  if (!signup) {
    rejected.add(false);
    const page = http.get(`${__ENV.FRONTEND_URL}${__ITER % 2 ? '/login' : '/'}`, { tags: { operation: 'page' } });
    check(page, { 'page available': r => r.status === 200 });
    errors.add(page.status !== 200);
  }
  if (signup) {
    const email = `load-${__ENV.RUN_ID}-${__VU}-${__ITER}@example.test`;
    const response = http.post(`${base}/api/v1/auth/register`, JSON.stringify({
      email, password: 'Load-test-only-Password42!', displayName: 'Launch test', role: 'business', organizationName: 'Launch test',
    }), { headers: { 'Content-Type': 'application/json' }, tags: { operation: 'register' }, timeout: '15s' });
    const capacity = [429, 503].includes(response.status);
    rejected.add(capacity);
    errors.add(response.status !== 201 && !capacity);
    check(response, { 'account created': r => r.status === 201 });
    if (response.status === 201) {
      const login = http.post(`${base}/api/v1/auth/login`, JSON.stringify({ email, password: 'Load-test-only-Password42!' }), {
        headers: { 'Content-Type': 'application/json' }, tags: { operation: 'login' }, timeout: '15s',
      });
      check(login, { 'new account can sign in': r => r.status === 201 });
      errors.add(login.status !== 201 && ![429, 503].includes(login.status));
      rejected.add([429, 503].includes(login.status));
      const token = response.json('accessToken');
      const profile = http.get(`${base}/api/v1/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }, tags: { operation: 'profile' },
      });
      check(profile, { 'new account profile available': r => r.status === 200 });
      errors.add(profile.status !== 200);
    }
  }
  if (mode !== 'burst') sleep(1 + Math.random() * 3);
}
