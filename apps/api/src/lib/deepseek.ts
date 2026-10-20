import { TEL_AVIV_AREAS, israelToday } from '@miftan/shared';

/**
 * Free text → search filters, through DeepSeek's chat API.
 *
 * Only the words the person typed are sent: no account, no id, no history.
 * The answer is untrusted and goes through `normalizeModelIntent` before it
 * can touch a filter. Any failure — no key, a timeout, a non-JSON reply —
 * throws, and the caller falls back to the built-in rule parser, so search
 * never depends on a third party being up.
 */

export interface ModelConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function systemPrompt(today: string): string {
  const areas = TEL_AVIV_AREAS.map((a) => `- "${a.name}" (${a.en}; also: ${a.aliases.join(', ')})`).join('\n');
  return `You convert an Israeli apartment-rental request (usually Hebrew) into JSON search filters.
Today is ${today}. Rent is in shekels per month. The search covers Tel Aviv only, in these nine areas — use the quoted canonical name exactly:
${areas}

Return ONE JSON object with only these keys (omit any key the user did not express):
- "areas": array of canonical area names from the list. "Central Tel Aviv" / "מרכז תל אביב" means "לב העיר".
- "minRooms", "maxRooms": numbers (Israeli room count, halves allowed). "3 rooms" → both 3. "2-3" → 2 and 3. Bedrooms are NOT rooms; if only bedrooms are given, rooms = bedrooms + 1.
- "minPrice", "maxPrice": integers in shekels. "עד 8,500" → maxPrice 8500. "7.5 אלף" → 7500.
- "minSqm", "maxSqm": integers, square metres.
- "availableFrom", "availableBy": "YYYY-MM-DD". "before December" → availableBy = last day of November (next occurrence from today). "in October" → both bounds of that month. "within a month" → availableBy = today + 30 days.
- "required": amenities the user insists on; "preferred": amenities marked as nice-to-have ("רצוי", "עדיף", "preferably"). Allowed values only: elevator, parking, balcony, mamad, furnished, ac, pets_allowed, storage, accessible, renovated.
- "smart": any of "below_market" (cheaper than similar apartments / below the area average), "soon" (available soon / within ~30 days), "low_competition" (few other applicants).
- "sort": one of "price_asc" (cheapest), "sqm" (largest), "ppsqm" (best value per m²), "date", "recommended".
- "unsupported": concepts the user asked for that cannot be filtered: "quiet", "transit" (public transport, train, light rail), "schools", "view", "garden", "similar" ("like this one"), "other_city" (any city other than Tel Aviv).
Never invent values the user did not state. Output JSON only.`;
}

export async function interpretWithModel(text: string, cfg: ModelConfig, now: Date = new Date()): Promise<unknown> {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const res = await fetchImpl(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt(israelToday(now)) },
        { role: 'user', content: text },
      ],
    }),
    signal: AbortSignal.timeout(cfg.timeoutMs ?? 8000),
  });
  if (!res.ok) throw new Error(`model responded ${res.status}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('model returned no content');
  return JSON.parse(content);
}
