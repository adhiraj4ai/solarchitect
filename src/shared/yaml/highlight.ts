/**
 * Minimal, dependency-free YAML tokenizer that emits HTML with class-tagged
 * spans for syntax colouring. It is deliberately line-oriented and forgiving:
 * the goal is a readable colour wash for the editor, not a spec-complete
 * parser (the real parser in ./parse.ts is the source of truth). Whatever it
 * cannot classify is emitted as plain, escaped text, so malformed input while
 * typing never throws — it just renders uncoloured.
 *
 * Token classes (styled in theme.css as `.tok-*`):
 *   k  key            p  punctuation (:, -, [], {}, ,)
 *   s  string/scalar  n  number       b  boolean/null/anchor   c  comment
 */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function span(cls: string, text: string): string {
  return `<span class="tok-${cls}">${esc(text)}</span>`;
}

/** Colour a scalar value (right-hand side of a key, or a bare list item). */
function value(v: string): string {
  if (v === '') return '';
  // Trailing inline comment: split at the first " #".
  const c = v.match(/(\s+#.*)$/);
  if (c) return value(v.slice(0, v.length - c[1].length)) + span('c', c[1]);

  const t = v.trim();
  const lead = v.slice(0, v.length - v.trimStart().length);
  if (/^(['"]).*\1$/.test(t)) return lead + span('s', t);
  if (/^(true|false|null|~|yes|no|on|off)$/i.test(t)) return lead + span('b', t);
  if (/^-?(\d[\d_]*\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return lead + span('n', t);
  if (/^[[\]{}]$/.test(t)) return lead + span('p', t);
  // Flow collections: colour the brackets/commas, leave the escaped rest plain.
  if (/^[[{]/.test(t)) {
    return lead + esc(t).replace(/[[\]{},]/g, (ch) => `<span class="tok-p">${ch}</span>`);
  }
  return lead + span('s', t);
}

/** Highlight one physical line (no trailing newline). */
export function highlightLine(line: string): string {
  const indentLen = line.length - line.trimStart().length;
  const indent = line.slice(0, indentLen);
  let rest = line.slice(indentLen);
  if (rest === '') return indent;

  // Whole-line comment.
  if (rest.startsWith('#')) return indent + span('c', rest);

  // Leading list markers ("- ", possibly nested like "- - ").
  let markers = '';
  let m: RegExpMatchArray | null;
  while ((m = rest.match(/^(-\s+)/))) {
    markers += span('p', '-') + m[1].slice(1);
    rest = rest.slice(m[1].length);
  }
  if (rest === '-') return indent + markers + span('p', '-');
  if (rest === '') return indent + markers;
  if (rest.startsWith('#')) return indent + markers + span('c', rest);

  // key: value
  const kv = rest.match(/^((?:"[^"]*"|'[^']*'|[^:#\s][^:]*?))(:)(\s|$)([\s\S]*)$/);
  if (kv) {
    const [, key, colon, gap, val] = kv;
    return indent + markers + span('k', key) + span('p', colon) + gap + value(val);
  }

  // Bare scalar (e.g. a list item value).
  return indent + markers + value(rest);
}

/** Highlight a full document, preserving line count exactly. */
export function highlightYaml(text: string): string {
  return text.split('\n').map(highlightLine).join('\n');
}
