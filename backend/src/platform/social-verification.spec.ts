import { afterEach, describe, expect, it, vi } from 'vitest';
import { SocialVerificationService } from './social-verification.service.js';

describe('social verification', () => {
  afterEach(() => vi.unstubAllGlobals());
  const service = new SocialVerificationService();
  const failingFetch = () => vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));

  it('checks TikTok posts from their evidence when TikTok cannot confirm the link', async () => {
    failingFetch();
    const result = await service.verify('tiktok', 'https://www.tiktok.com/@ada/video/7311111111111111111', { hasEvidence: true });
    expect(result).toMatchObject({ method: 'manual', externalPostId: '7311111111111111111' });
  });
  it('still turns away unconfirmed TikTok links that have no evidence', async () => {
    failingFetch();
    await expect(service.verify('tiktok', 'https://www.tiktok.com/@ada/video/7311111111111111111')).rejects.toThrow('could not be verified');
  });
  it('never accepts links from the wrong site', async () => {
    await expect(service.verify('tiktok', 'https://example.com/video/1', { hasEvidence: true })).rejects.toThrow('valid TikTok');
  });
  it('reviews X and Instagram posts from evidence when no platform API is configured', async () => {
    vi.stubEnv('X_BEARER_TOKEN', '');
    expect((await service.verify('x', 'https://x.com/ada/status/1855000000000000000')).method).toBe('manual');
    expect((await service.verify('instagram', 'https://www.instagram.com/p/Cabc123/')).method).toBe('manual');
    vi.unstubAllEnvs();
  });
});
