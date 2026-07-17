/**
 * Pure heading extraction for markdown documents, feeding the Outline and Search
 * panels. Deliberately tiny: ATX headings only, code fences skipped. Not a full
 * markdown parser — rendering uses `marked` in the renderer.
 */

export interface MarkdownHeading {
  id: string;
  level: number;
  text: string;
  line: number;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

export function markdownHeadings(text: string): MarkdownHeading[] {
  const lines = text.split('\n');
  const headings: MarkdownHeading[] = [];
  const used = new Map<string, number>();
  let inFence = false;

  lines.forEach((raw, line) => {
    if (/^\s*(```|~~~)/.test(raw)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const m = /^(#{1,6})\s+(.*\S)\s*$/.exec(raw);
    if (!m) return;
    const level = m[1].length;
    const headingText = m[2].replace(/\s+#+\s*$/, ''); // strip trailing closing #'s
    const base = slugify(headingText);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    const id = seen === 0 ? base : `${base}-${seen + 1}`;
    headings.push({ id, level, text: headingText, line });
  });

  return headings;
}

export function searchMarkdown(text: string, query: string): MarkdownHeading[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return markdownHeadings(text).filter((h) => h.text.toLowerCase().includes(q));
}
