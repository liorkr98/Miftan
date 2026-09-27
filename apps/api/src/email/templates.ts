import { APP_NAME, t } from '@miftan/shared';

function wrap(title: string, body: string, href: string, cta: string): { subject: string; text: string; html: string } {
  const text = `${title}\n\n${body}\n\n${href}\n`;
  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f1ea;font-family:Assistant,Arial,sans-serif;color:#1c1914;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fffdf8;border:1px solid #e6dfd2;border-radius:12px;padding:28px 24px;text-align:right;direction:rtl;">
        <tr><td style="font-size:13px;font-weight:700;letter-spacing:.04em;color:#8a7d68;">${APP_NAME}</td></tr>
        <tr><td style="padding-top:16px;font-size:22px;font-weight:800;line-height:1.3;">${title}</td></tr>
        <tr><td style="padding-top:12px;font-size:16px;line-height:1.6;color:#3f3a33;">${body}</td></tr>
        <tr><td style="padding-top:22px;">
          <a href="${href}" style="display:inline-block;background:#1c1914;color:#fffdf8;text-decoration:none;font-weight:700;font-size:15px;padding:12px 18px;border-radius:10px;">${cta}</a>
        </td></tr>
        <tr><td style="padding-top:18px;font-size:12px;color:#8a7d68;word-break:break-all;">${href}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject: title, text, html };
}

export function resetMail(href: string) {
  return wrap(t.email.resetSubject, t.email.resetBody, href, t.email.resetCta);
}

export function verifyMail(href: string) {
  return wrap(t.email.verifySubject, t.email.verifyBody, href, t.email.verifyCta);
}

export function alreadyRegisteredMail(href: string) {
  return wrap(t.email.takenSubject, t.email.takenBody, href, t.email.takenCta);
}

export function emailChangeMail(href: string) {
  return wrap(t.email.changeSubject, t.email.changeBody, href, t.email.changeCta);
}
