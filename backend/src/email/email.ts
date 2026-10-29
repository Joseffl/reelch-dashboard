export type EmailPayload = { from: string; to: string[]; subject: string; html: string; text: string; reply_to?: string };

export function emailConfiguration(source: NodeJS.ProcessEnv = process.env) {
  if (source.EMAIL_ENABLED !== 'true') return undefined;
  if (source.JOBS_ENABLED !== 'true') throw new Error('EMAIL_ENABLED requires JOBS_ENABLED=true');
  if (!source.RESEND_API_KEY?.trim()) throw new Error('RESEND_API_KEY is required when email is enabled');
  const mailbox = /^(?:[^<>\r\n]+<)?[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>?$/;
  const from = source.EMAIL_FROM?.trim();
  const replyTo = source.EMAIL_REPLY_TO?.trim();
  if (!from || !mailbox.test(from)) throw new Error('EMAIL_FROM must be a sender address on your verified Resend domain');
  if (replyTo && !mailbox.test(replyTo)) throw new Error('EMAIL_REPLY_TO must be a valid mailbox');
  return { apiKey: source.RESEND_API_KEY.trim(), from, replyTo };
}

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function confirmationEmail(kind: 'waitlist' | 'account', name: string, email: string): EmailPayload | undefined {
  const config = emailConfiguration();
  if (!config) return undefined;
  const title = kind === 'waitlist' ? 'You’re on the Reelch waitlist' : 'Welcome to Reelch';
  const message = kind === 'waitlist'
    ? 'Thanks for joining the Reelch promoter waitlist. We’ve received your details and will email you when early access is available.'
    : 'Your Reelch account has been created. Complete your profile to get ready for campaigns and opportunities.';
  const link = new URL(kind === 'waitlist' ? '/' : '/login', process.env.FRONTEND_URL ?? 'http://localhost:3000').toString();
  const label = kind === 'waitlist' ? 'Visit Reelch' : 'Sign in to Reelch';
  const text = `Hi ${name},\n\n${message}\n\n${label}: ${link}\n\nThe Reelch team`;
  return { from: config.from, to: [email], subject: title, text,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#171811"><h1 style="letter-spacing:-1px">REELCH.</h1><h2>${title}</h2><p>Hi ${escape(name)},</p><p style="line-height:1.7">${message}</p><p><a href="${escape(link)}" style="display:inline-block;background:#171811;color:#fff;padding:14px 22px;border-radius:8px;text-decoration:none">${label}</a></p><p>The Reelch team</p></div>`,
    ...(config.replyTo ? { reply_to: config.replyTo } : {}) };
}
