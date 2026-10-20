/**
 * Outbound mail. The adapter is chosen at boot: Resend when a key is present,
 * the console otherwise (dev, tests, demo). Callers never talk to Resend
 * themselves, so a missing key cannot silently skip a reset mail.
 */

export interface OutboundMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(mail: OutboundMail): Promise<void>;
}

/** Captured in tests. Cleared between tests. */
export const sentMail: OutboundMail[] = [];

export class ConsoleMailer implements Mailer {
  async send(mail: OutboundMail): Promise<void> {
    sentMail.push(mail);
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[mail] to=${mail.to} subject=${mail.subject}`);
    }
  }
}
