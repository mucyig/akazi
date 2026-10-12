// Sends transactional email through Resend (https://resend.com). Without RESEND_API_KEY (local development)
// the email is printed in the server console instead, so you can click the link yourself.
const { CLIENT_URL, isProd } = require('./env');

const FROM = process.env.MAIL_FROM || 'Akazi <onboarding@resend.dev>';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function layout({ title, intro, ctaLabel, ctaUrl, outro }) {
  return `<!doctype html><html><body style="margin:0;background:#faf9f6;font-family:'Segoe UI',Arial,sans-serif;color:#14201b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #e4e1d8;border-radius:16px;overflow:hidden">
<tr><td style="padding:22px 28px;background:#164536;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-.3px">akazi<span style="color:#f59e0b">.</span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#12382d">${esc(title)}</h1>
<p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#3f4a44">${esc(intro)}</p>
${ctaUrl ? `<p style="margin:0 0 22px"><a href="${esc(ctaUrl)}" style="display:inline-block;background:#1f6b52;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 24px;border-radius:999px">${esc(ctaLabel)}</a></p>
<p style="margin:0 0 6px;font-size:12px;color:#6b756f">If the button does not work, paste this link into your browser:</p>
<p style="margin:0 0 22px;font-size:12px;color:#1f6b52;word-break:break-all">${esc(ctaUrl)}</p>` : ''}
<p style="margin:0;font-size:13px;line-height:1.6;color:#6b756f">${esc(outro || '')}</p>
</td></tr></table>
<p style="font-size:12px;color:#8a938d;margin:16px 0 0">Akazi, Kigali, Rwanda</p>
</td></tr></table></body></html>`;
}

// Test hook: with MAIL_CAPTURE=1 emails are collected here instead of being sent
const outbox = [];

async function sendMail({ to, subject, title, intro, ctaLabel, ctaUrl, outro }) {
  const html = layout({ title: title || subject, intro, ctaLabel, ctaUrl, outro });
  const text = [title || subject, '', intro, ctaUrl ? `\n${ctaLabel}: ${ctaUrl}` : '', outro ? `\n${outro}` : ''].join('\n');

  if (process.env.MAIL_CAPTURE === '1' && !isProd) { outbox.push({ to, subject, intro, ctaUrl }); return { captured: true }; }
  if (!process.env.RESEND_API_KEY) {
    if (!isProd) {
      console.log(`\n[Mail:dev] To: ${to}\n[Mail:dev] Subject: ${subject}\n[Mail:dev] ${intro}${ctaUrl ? `\n[Mail:dev] Link: ${ctaUrl}` : ''}\n`);
    }
    return { skipped: true };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[Mail] Resend rejected the email (${res.status}): ${body.slice(0, 300)}`);
      return { ok: false };
    }
    if (!isProd) console.log(`[Mail] Sent "${subject}" to ${to} through Resend.`);
    return { ok: true };
  } catch (e) {
    console.error('[Mail] Could not reach Resend:', e.message);
    return { ok: false };
  }
}

// Fire-and-forget wrapper so a slow mail provider never slows down (or reveals anything about) a request
const sendMailLater = (opts) => { setImmediate(() => { sendMail(opts).catch(() => {}); }); };

const link = (path, params) => `${CLIENT_URL}${path}?${new URLSearchParams(params).toString()}`;

module.exports = { sendMail, sendMailLater, link, outbox };