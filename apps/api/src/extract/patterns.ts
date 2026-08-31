import type { ExtractedField } from '@miftan/shared';
import { WANTED, type ContractExtractor, type ExtractionResult } from './index.ts';

/**
 * A pattern-matching extractor for Hebrew rental contracts.
 *
 * Israeli residential leases are near-boilerplate — most are a lightly edited
 * copy of the same few templates — so regular expressions genuinely find the
 * numbers a good part of the time. What they cannot do is understand an unusual
 * clause, which is exactly why nothing here is trusted: every field carries a
 * confidence and the owner confirms it.
 *
 * Confidences are deliberately conservative. A pattern match on a labelled
 * amount is strong; an unlabelled number that merely looks like rent is not,
 * and saying so is the difference between a useful assistant and one that
 * quietly puts the wrong rent on a lease.
 */

const HE_DIGITS = '[0-9,\\.]+';

/** ₪12,500 / 12,500 ש"ח / 12500 שקל */
const MONEY = new RegExp(`(?:₪\\s*(${HE_DIGITS})|(${HE_DIGITS})\\s*(?:ש["״']?ח|שקלים?|₪))`);

/** 01/09/2026, 1.9.2026, 2026-09-01 */
const DATE = /(\d{1,2})[./-](\d{1,2})[./-](\d{4})|(\d{4})-(\d{2})-(\d{2})/;

function toNumber(raw: string): number {
  return Number(raw.replace(/[,\s]/g, ''));
}

function toIso(match: RegExpMatchArray): string | null {
  if (match[4]) return `${match[4]}-${match[5]}-${match[6]}`;
  const [, d, m, y] = match;
  if (!d || !m || !y) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** The line a match sits on, so the owner can find it in the document. */
function lineAround(text: string, index: number): string {
  const start = text.lastIndexOf('\n', index) + 1;
  const end = text.indexOf('\n', index);
  return text.slice(start, end === -1 ? undefined : end).trim().slice(0, 120);
}

interface Rule {
  key: string;
  /** Words that must appear near the value for the match to mean anything */
  anchors: RegExp;
  kind: 'money' | 'date' | 'days' | 'months' | 'text';
  confident: number;
}

const RULES: Rule[] = [
  { key: 'monthlyRent', anchors: /דמי\s*שכירות|שכר\s*דירה|שכ["״']?ד/, kind: 'money', confident: 0.92 },
  { key: 'deposit', anchors: /פיקדון|פקדון|ערבון|בטחון|ביטחון/, kind: 'money', confident: 0.88 },
  { key: 'startDate', anchors: /תחילת|מיום|החל\s*מ|תקופת\s*השכירות/, kind: 'date', confident: 0.85 },
  /* "ותסתיים ביום" is how most of these are actually worded; matching only
     "סיום" missed the commonest phrasing there is. */
  { key: 'endDate', anchors: /[ותי]סתיים|ועד\s*ל?יום|עד\s*ל?יום|תום\s*התקופה|סיום/, kind: 'date', confident: 0.85 },
  { key: 'noticePeriodDays', anchors: /הודעה\s*מוקדמת|התראה\s*מראש/, kind: 'days', confident: 0.8 },
  { key: 'extensionMonths', anchors: /אופציה|הארכה|תקופה\s*נוספת/, kind: 'months', confident: 0.75 },
];

export class PatternExtractor implements ContractExtractor {
  async extract({ text }: { text: string; fileName: string }): Promise<ExtractionResult> {
    const fields: ExtractedField[] = [];
    const lines = text.split('\n');

    for (const rule of RULES) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!rule.anchors.test(line)) continue;

        /* Look on the anchor's own line and the next one: Hebrew contracts
           often break between "דמי השכירות החודשיים" and the amount. */
        const window = `${line}\n${lines[i + 1] ?? ''}`;
        const found = matchOne(rule, window);
        if (!found) continue;

        fields.push({
          key: rule.key,
          label: WANTED.find((w) => w.key === rule.key)?.label ?? rule.key,
          value: found,
          confidence: rule.confident,
          source_hint: lineAround(text, text.indexOf(line)),
        });
        break;
      }
    }

    const seen = new Set(fields.map((f) => f.key));
    return {
      fields,
      missing: WANTED.map((w) => w.key).filter((k) => !seen.has(k)),
    };
  }
}

function matchOne(rule: Rule, window: string): string | null {
  if (rule.kind === 'money') {
    const m = window.match(MONEY);
    if (!m) return null;
    return String(toNumber(m[1] ?? m[2]));
  }
  if (rule.kind === 'date') {
    const m = window.match(DATE);
    return m ? toIso(m) : null;
  }
  if (rule.kind === 'days' || rule.kind === 'months') {
    const unit = rule.kind === 'days' ? /(\d{1,3})\s*ימים/ : /(\d{1,2})\s*חודש/;
    const m = window.match(unit);
    return m ? m[1] : null;
  }
  return null;
}

export function createExtractor(): ContractExtractor {
  /* When an LLM extractor is wired up it slots in here, behind the same
     interface and under the same rule: it proposes, the owner disposes. */
  return new PatternExtractor();
}
