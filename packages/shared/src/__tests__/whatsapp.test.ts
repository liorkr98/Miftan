import { describe, expect, it } from 'vitest';
import { ticketWhatsAppMessage, whatsAppLink } from '../lib/whatsapp';

describe('whatsAppLink', () => {
  it('converts an Israeli local number to international format', () => {
    const link = whatsAppLink('054-2273865', 'שלום');
    expect(link.split('?')[0]).toBe('https://wa.me/972542273865');
    expect(link).not.toContain('054');
  });

  it('leaves an already-international number alone', () => {
    const link = whatsAppLink('972542273865', 'שלום');
    expect(link.split('?')[0]).toBe('https://wa.me/972542273865');
    expect(new URL(link).searchParams.get('text')).toBe('שלום');
  });

  it('encodes the message so it survives as a URL', () => {
    const link = whatsAppLink('0501234567', 'תקלה ברחוב הרצל 88');
    const url = new URL(link);
    expect(url.searchParams.get('text')).toBe('תקלה ברחוב הרצל 88');
  });
});

describe('ticketWhatsAppMessage', () => {
  it('names the property and the fault', () => {
    const msg = ticketWhatsAppMessage({ propertyLabel: 'הרצל 88', title: 'נזילה מתחת לכיור' });
    expect(msg).toContain('הרצל 88');
    expect(msg).toContain('נזילה מתחת לכיור');
  });

  it('flags urgency only when the ticket is actually urgent', () => {
    const urgent = ticketWhatsAppMessage({ propertyLabel: 'x', title: 'y', severity: 'urgent' });
    const routine = ticketWhatsAppMessage({ propertyLabel: 'x', title: 'y', severity: 'medium' });
    expect(urgent).toContain('דחוף');
    expect(routine).not.toContain('דחוף');
  });

  it('omits the description line when there is none', () => {
    const msg = ticketWhatsAppMessage({ propertyLabel: 'x', title: 'y' });
    expect(msg).not.toContain('פרטים');
  });
});
