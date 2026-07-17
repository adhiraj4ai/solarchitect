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

/** Slugify a single heading's text to an anchor base (before disambiguation). */
export function slugifyHeading(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

/**
 * Turn an ordered list of heading texts into unique anchor ids, disambiguating
 * repeats (`setup`, `setup-2`, …). Shared so the source-derived outline and the
 * rendered preview compute identical ids for the same heading text.
 */
export function headingSlugs(texts: string[]): string[] {
  const used = new Map<string, number>();
  return texts.map((t) => {
    const base = slugifyHeading(t);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    return seen === 0 ? base : `${base}-${seen + 1}`;
  });
}

export function markdownHeadings(text: string): MarkdownHeading[] {
  const lines = text.split('\n');
  const found: { level: number; text: string; line: number }[] = [];
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
    found.push({ level, text: headingText, line });
  });

  const ids = headingSlugs(found.map((h) => h.text));
  return found.map((h, i) => ({ id: ids[i], level: h.level, text: h.text, line: h.line }));
}

export function searchMarkdown(text: string, query: string): MarkdownHeading[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return markdownHeadings(text).filter((h) => h.text.toLowerCase().includes(q));
}
