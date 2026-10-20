import { env } from '../lib/env.ts';
import { ConsoleMailer, sentMail, type Mailer, type OutboundMail } from './mailer.ts';
import { ResendMailer } from './resend.ts';

export { sentMail };
export type { OutboundMail };

let mailer: Mailer | null = null;

export function getMailer(): Mailer {
  mailer ??=
    env.RESEND_API_KEY && env.NODE_ENV !== 'test'
      ? new ResendMailer(env.RESEND_API_KEY, env.EMAIL_FROM)
      : new ConsoleMailer();
  return mailer;
}

/** Tests replace the adapter without touching env. */
export function setMailer(next: Mailer): void {
  mailer = next;
}

export async function sendMail(mail: OutboundMail): Promise<void> {
  /* Tenants recorded by an owner have a placeholder address under the
     reserved .invalid domain. Nothing is ever sent there. */
  if (/\.invalid$/i.test(mail.to)) return;
  await getMailer().send(mail);
}
