import type { Property, SeasonalTaskTemplate, TicketCategory } from '../types';
import { seasonalTemplates } from '../catalog/seasonal-templates';

/**
 * When preventive work is due, and what skipping it is actually worth.
 *
 * Both halves used to live in the web store, which meant the API could not
 * schedule a task or price one without reimplementing them — and two
 * implementations of "what does this save you" is how an owner ends up shown
 * one number on a dashboard and a different one in a report.
 */

/** A template applies to a unit only if the unit has the thing it maintains. */
export function appliesTo(template: SeasonalTaskTemplate, property: Pick<Property, 'amenities'>): boolean {
  if (!template.requires_amenity) return true;
  return property.amenities.includes(template.requires_amenity);
}

/**
 * The next occurrence of the template's month. Mid-month, because a task due
 * "in April" is not due on the 1st and pretending otherwise makes everything
 * look overdue on April 2nd.
 */
export function nextDueDate(template: SeasonalTaskTemplate, from = new Date()): string {
  let due = new Date(from.getFullYear(), template.due_month - 1, 15);
  if (due < from) due = new Date(from.getFullYear() + 1, template.due_month - 1, 15);
  return due.toISOString().slice(0, 10);
}

/**
 * The expected value of doing the work, in shekels.
 *
 * `avoided_cost` alone would assume every skipped task ends in the failure it
 * prevents, which is not true and not a number to put in front of an owner —
 * still less an investor. Multiplying by `failure_rate` and subtracting what
 * the work itself costs is the honest version, and it is allowed to be zero:
 * some preventive work does not pay for itself, and the product should say so
 * rather than quietly rounding it up.
 */
export function expectedSaving(template: SeasonalTaskTemplate): number {
  return Math.max(0, template.avoided_cost * template.failure_rate - template.typical_cost);
}

export function totalExpectedSaving(templates: SeasonalTaskTemplate[]): number {
  return templates.reduce((sum, t) => sum + expectedSaving(t), 0);
}

/**
 * Preventive work becomes an ordinary maintenance ticket, but the seasonal
 * calendar knows three kinds of job the ticket categories do not: gutters, gas
 * and general inspection. They land in `other` rather than being forced into a
 * neighbouring trade — a gas check filed as `boiler` sends the wrong
 * tradesperson, which is worse than a vague label.
 */
export function ticketCategoryFor(template: SeasonalTaskTemplate): TicketCategory {
  switch (template.category) {
    case 'gutters':
    case 'gas':
    case 'inspection':
      return 'other';
    default:
      return template.category;
  }
}

export function templateById(id: string): SeasonalTaskTemplate | undefined {
  return seasonalTemplates.find((t) => t.id === id);
}

/** Every template/unit pair that should exist, with its due date. */
export function scheduleFor(
  properties: Array<Pick<Property, 'id' | 'amenities'>>,
  from = new Date(),
): Array<{ templateId: string; propertyId: string; dueDate: string; year: number }> {
  const out = [];
  for (const template of seasonalTemplates) {
    for (const property of properties) {
      if (!appliesTo(template, property)) continue;
      const dueDate = nextDueDate(template, from);
      out.push({
        templateId: template.id,
        propertyId: property.id,
        dueDate,
        year: Number(dueDate.slice(0, 4)),
      });
    }
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
