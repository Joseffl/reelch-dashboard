import { BadRequestException } from '@nestjs/common';

export function normalizeProfileLink(input: string, allowPhone = false): string {
  const value = input.trim();
  if (allowPhone && /^\+?[\d\s()-]{7,}$/.test(value)) return value;
  const candidate = value.startsWith('//') ? `https:${value}` : /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password || /\s/.test(candidate)) throw new Error('Invalid profile');
    return url.toString();
  } catch { throw new BadRequestException('Enter a valid profile link, for example x.com/yourname'); }
}
