/**
 * A wa.me link, for contacting a tradesperson.
 *
 * This is not the WhatsApp Business API — no message is sent by the product,
 * no account is required, and nothing is logged on our side. It is a plain
 * link that opens WhatsApp with a message already typed in, which the owner
 * still has to press send on. That is deliberately the whole feature: real
 * WhatsApp Business integration needs Meta's app review, which has its own
 * timeline, and a plain link needs none of that to be useful today.
 */

/** Israeli local (05X-XXXXXXX) or already-international, digits only either way. */
function toInternational(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;
  return digits;
}

export function whatsAppLink(phone: string, message: string): string {
  return `https://wa.me/${toInternational(phone)}?text=${encodeURIComponent(message)}`;
}

/** The message body for "tell this tradesperson about a maintenance problem". */
export function ticketWhatsAppMessage(input: {
  propertyLabel: string;
  title: string;
  description?: string | null;
  severity?: string;
}): string {
  const lines = [`שלום, פנייה לגבי תקלה ב${input.propertyLabel}.`, `נושא: ${input.title}`];
  if (input.severity === 'urgent') lines.push('דחיפות: דחוף');
  if (input.description) lines.push(`פרטים: ${input.description}`);
  return lines.join('\n');
}

/** A plain opening greeting, for contacting a vendor with no specific job in mind. */
export function vendorWhatsAppGreeting(vendorFirstName: string): string {
  return `שלום ${vendorFirstName}, מדובר על עבודה עבור הדירה שלי.`;
}
