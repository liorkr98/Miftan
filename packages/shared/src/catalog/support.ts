/**
 * Public contact details. Named in the contact page and the legal footer.
 * The WhatsApp number is unset until a real Business line exists — a made-up
 * number would be worse than no number.
 */
export const SUPPORT = {
  email: 'support@baalabait.co.il',
  privacy: 'privacy@baalabait.co.il',
  accessibility: 'accessibility@baalabait.co.il',
  whatsapp: null as string | null,
  hours: 'ראשון–חמישי, 9:00–18:00',
  reply: 'מענה תוך יום עסקים אחד',
} as const;
