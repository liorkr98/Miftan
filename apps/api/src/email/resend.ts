import type { Mailer, OutboundMail } from './mailer.ts';

/**
 * Resend over fetch. No SDK — a new dependency needs an explicit OK, and
 * this is one POST.
 */
export class ResendMailer implements Mailer {
  readonly apiKey: string;
  readonly from: string;

  constructor(apiKey: string, from: string) {
    this.apiKey = apiKey;
    this.from = from;
  }

  async send(mail: OutboundMail): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Resend ${res.status}: ${detail.slice(0, 200)}`);
    }
  }
}
