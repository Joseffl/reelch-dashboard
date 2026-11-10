import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TiktokApiError, TiktokService, tiktokVideoId } from './tiktok.service.js';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('TikTok service', () => {
  beforeEach(() => { vi.stubEnv('TIKTOK_CLIENT_KEY', 'key-123'); vi.stubEnv('TIKTOK_CLIENT_SECRET', 'secret-456'); vi.stubEnv('TIKTOK_REDIRECT_URI', 'https://api.example.com/cb'); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  const service = new TiktokService();

  it('builds the authorize URL with read-only scopes', () => {
    const url = new URL(service.authorizeUrl('state-abc'));
    expect(url.origin + url.pathname).toBe('https://www.tiktok.com/v2/auth/authorize/');
    expect(Object.fromEntries(url.searchParams)).toEqual({ client_key: 'key-123', response_type: 'code', scope: 'user.info.basic,video.list', redirect_uri: 'https://api.example.com/cb', state: 'state-abc' });
    expect(service.configured).toBe(true);
  });
  it('exchanges a code for tokens', async () => {
    const fetchMock = vi.fn(async () => json({ access_token: 'act.1', refresh_token: 'rft.1', open_id: 'open-1', expires_in: 86400, scope: 'user.info.basic,video.list' }));
    vi.stubGlobal('fetch', fetchMock);
    const tokens = await service.exchangeCode('code-xyz');
    expect(tokens).toMatchObject({ accessToken: 'act.1', refreshToken: 'rft.1', openId: 'open-1', scopes: ['user.info.basic', 'video.list'] });
    const body = new URLSearchParams(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(Object.fromEntries(body)).toMatchObject({ client_key: 'key-123', client_secret: 'secret-456', code: 'code-xyz', grant_type: 'authorization_code', redirect_uri: 'https://api.example.com/cb' });
  });
  it('reports TikTok errors instead of returning bad tokens', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'invalid_grant', error_description: 'Authorization code expired' }, 400)));
    await expect(service.exchangeCode('old')).rejects.toBeInstanceOf(TiktokApiError);
  });
  it('reads one of the promoter\'s own videos with its view count', async () => {
    const fetchMock = vi.fn(async () => json({ data: { videos: [{ id: '7311', video_description: 'Cold brew #BrightsideBrew', view_count: 12400, like_count: 900, create_time: 1762700000 }] }, error: { code: 'ok' } }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await service.findOwnVideo('act.1', '7311')).toMatchObject({ id: '7311', description: 'Cold brew #BrightsideBrew', views: 12400, likes: 900 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/v2/video/query/?fields=');
    expect(JSON.parse(String(init.body))).toEqual({ filters: { video_ids: ['7311'] } });
  });
  it('returns null for a video that is not on the connected account', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ data: { videos: [] }, error: { code: 'ok' } })));
    expect(await service.findOwnVideo('act.1', '999')).toBeNull();
  });
  it('treats an expired token as an API error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ data: {}, error: { code: 'access_token_invalid', message: 'expired' } }, 401)));
    await expect(service.findOwnVideo('act.1', '7311')).rejects.toBeInstanceOf(TiktokApiError);
  });
  it('finds video ids in TikTok links', () => {
    expect(tiktokVideoId(new URL('https://www.tiktok.com/@emma/video/7311111111111111111?is_from_webapp=1'))).toBe('7311111111111111111');
    expect(tiktokVideoId(new URL('https://vm.tiktok.com/ZMabc/'))).toBeUndefined();
  });
});
