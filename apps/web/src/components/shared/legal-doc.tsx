import { LEGAL_REVIEW_NOTICE } from '@miftan/shared';
import { cn } from '@/lib/utils';

/**
 * The small markdown subset the legal catalog actually uses: `#` / `##`
 * headings, a pipe table (the cookies page), and blank-line paragraphs.
 *
 * Not a markdown library — a parser for exactly the shapes
 * `packages/shared/src/catalog/legal-content.ts` is written in. Bringing in a
 * real markdown dependency for four static documents this product authors
 * itself is more surface area than the problem needs.
 */
export function LegalDoc({ body, className }: { body: string; className?: string }) {
  const blocks = body.trim().split(/\n\n+/);

  return (
    <div className={cn('space-y-4 text-sm leading-7 text-ink-soft', className)}>
      {blocks.map((block, i) => {
        if (block.startsWith('## ')) {
          return (
            <h2 key={i} className="pt-2 text-base font-bold text-ink">
              {block.slice(3)}
            </h2>
          );
        }
        if (block.startsWith('# ')) {
          return (
            <h1 key={i} className="text-xl font-extrabold text-ink">
              {block.slice(2)}
            </h1>
          );
        }
        /* Kept in the body text — so it travels with the document if it is
           ever copied or printed elsewhere, the same reasoning the contract
           templates use for their own disclaimer — but styled apart so it
           reads as a notice rather than blending into the prose. */
        if (block === LEGAL_REVIEW_NOTICE) {
          return (
            <p
              key={i}
              className="rounded-[var(--radius-control)] border border-signal/40 bg-signal-soft px-3.5 py-2.5 text-xs leading-6 text-signal-deep"
            >
              {block}
            </p>
          );
        }
        if (block.includes('|')) {
          return <MarkdownTable key={i} block={block} />;
        }
        return <p key={i}>{block}</p>;
      })}
    </div>
  );
}

function MarkdownTable({ block }: { block: string }) {
  const rows = block
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean)
    /* The `|---|---|` divider row carries no content. */
    .filter((r) => !/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(r));

  const cells = rows.map((r) =>
    r
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim()),
  );
  const [header, ...body] = cells;

  return (
    <div className="overflow-x-auto rounded-[var(--radius-control)] border border-line">
      <table className="w-full text-start text-xs">
        <thead className="bg-surface">
          <tr>
            {header.map((h, i) => (
              <th key={i} className="px-3 py-2 font-bold text-ink">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {body.map((row, i) => (
            <tr key={i}>
              {row.map((c, j) => (
                <td key={j} className="px-3 py-2 text-ink-soft">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
