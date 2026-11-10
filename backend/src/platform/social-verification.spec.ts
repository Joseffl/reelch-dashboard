import { afterEach, describe, expect, it, vi } from 'vitest';
import { SocialVerificationService } from './social-verification.service.js';
import { TiktokService } from './tiktok.service.js';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const VIDEO = 'https://www.tiktok.com/@emma/video/7311111111111111111';

describe('social verification', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  const service = new SocialVerificationService(new TiktokService());

  it('reads views from a connected TikTok account and proves ownership', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ data: { videos: [{ id: '7311111111111111111', video_description: 'Cold brew #BrightsideBrew', view_count: 12400 }] }, error: { code: 'ok' } })));
    const result = await service.verify('tiktok', VIDEO, { tiktokAccessToken: 'act.1' });
    expect(result).toMatchObject({ method: 'platform_api', metrics: { views: 12400 }, checks: { linkCheck: 'confirmed', ownedByConnectedAccount: true, text: 'Cold brew #BrightsideBrew' } });
  });
  it('flags a TikTok video that is not on the connected account', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ data: { videos: [] }, error: { code: 'ok' } })));
    const result = await service.verify('tiktok', VIDEO, { tiktokAccessToken: 'act.1', hasEvidence: true });
    expect(result).toMatchObject({ method: 'manual', checks: { linkCheck: 'failed', ownedByConnectedAccount: false } });
  });
  it('falls back to the public check when the TikTok token is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => String(url).includes('open.tiktokapis.com')
      ? json({ error: { code: 'access_token_invalid', message: 'expired' } }, 401)
      : json({ author_name: 'Emma', author_url: 'https://www.tiktok.com/@emma', title: 'Cold brew #BrightsideBrew' })));
    expect(await service.verify('tiktok', VIDEO, { tiktokAccessToken: 'act.1' })).toMatchObject({ method: 'public_metadata', checks: { linkCheck: 'confirmed', authorHandle: 'emma' } });
  });
  it('checks unconnected TikTok posts from their evidence when TikTok cannot confirm the link', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
    expect(await service.verify('tiktok', VIDEO, { hasEvidence: true })).toMatchObject({ method: 'manual', checks: { linkCheck: 'failed' } });
    await expect(service.verify('tiktok', VIDEO)).rejects.toThrow('could not be verified');
  });
  it('never accepts links from the wrong site', async () => {
    await expect(service.verify('tiktok', 'https://example.com/video/1', { hasEvidence: true })).rejects.toThrow('valid TikTok');
    await expect(service.verify('instagram', 'https://example.com/p/abc')).rejects.toThrow('valid Instagram');
  });
  it('confirms Instagram posts through the public embed lookup', async () => {
    const fetchMock = vi.fn(async () => json({ author_name: 'sofia.lane', title: 'Brunch #BrightsideBrunch' })); vi.stubGlobal('fetch', fetchMock);
    expect(await service.verify('instagram', 'https://www.instagram.com/reel/Cabc123/?igsh=x')).toMatchObject({ method: 'manual', externalPostId: 'Cabc123', checks: { linkCheck: 'confirmed', authorHandle: 'sofia.lane' } });
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toContain('instagram_oembed?url=https%3A%2F%2Fwww.instagram.com%2Fp%2FCabc123%2F');
  });
  it('flags Instagram links that do not exist, but does not punish an outage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    expect((await service.verify('instagram', 'https://www.instagram.com/p/Cfake/')).checks.linkCheck).toBe('failed');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    expect((await service.verify('instagram', 'https://www.instagram.com/p/Cfake/')).checks.linkCheck).toBe('unavailable');
  });
  it('reads real X views when an API key is configured', async () => {
    vi.stubEnv('X_BEARER_TOKEN', 'x-token');
    vi.stubGlobal('fetch', vi.fn(async () => json({ data: { id: '1855', text: 'Cold brew #BrightsideBrew', author_id: '9', public_metrics: { impression_count: 2210, like_count: 40 } }, includes: { users: [{ id: '9', username: 'danielk' }] } })));
    expect(await service.verify('x', 'https://x.com/danielk/status/1855')).toMatchObject({ method: 'platform_api', metrics: { views: 2210 }, checks: { linkCheck: 'confirmed', username: 'danielk' } });
  });
  it('uses the screenshot for X views when no API key is configured', async () => {
    vi.stubEnv('X_BEARER_TOKEN', '');
    expect(await service.verify('x', 'https://x.com/danielk/status/1855')).toMatchObject({ method: 'manual', checks: { linkCheck: 'unavailable' } });
  });
});
