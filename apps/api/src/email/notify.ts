import { eq } from 'drizzle-orm';
import { db, schema as s } from '../db/client.ts';
import { env } from '../lib/env.ts';
import { sendMail } from './index.ts';
import { actionMail } from './templates.ts';

const fill = (template: string, vars: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');

/**
 * Mail one person about a step that is now theirs. Best effort: a mail that
 * fails is logged and never fails the action that caused it — the in-app
 * notification carries the same news either way.
 */
export async function mailUser(
  userId: string,
  copy: { subject: string; body: string },
  path: string,
  vars: Record<string, string> = {},
): Promise<void> {
  try {
    const [user] = await db.select({ email: s.users.email }).from(s.users).where(eq(s.users.id, userId));
    if (!user) return;
    const href = `${env.WEB_ORIGIN.replace(/\/$/, '')}${path}`;
    const mail = actionMail(fill(copy.subject, vars), fill(copy.body, vars), href);
    await sendMail({ to: user.email, ...mail });
  } catch (err) {
    console.warn('[mail] turnover notice failed', (err as Error).message);
  }
}
