import { describe, it, expect } from 'vitest';
import { markdownHeadings, searchMarkdown, headingSlugs } from './markdownOutline';

describe('markdownHeadings', () => {
  it('extracts ATX headings with level, text, and line', () => {
    const md = '# Title\n\nintro\n\n## Section A\ntext\n### Sub\n';
    expect(markdownHeadings(md)).toEqual([
      { id: 'title', level: 1, text: 'Title', line: 0 },
      { id: 'section-a', level: 2, text: 'Section A', line: 4 },
      { id: 'sub', level: 3, text: 'Sub', line: 6 },
    ]);
  });

  it('ignores # inside fenced code blocks', () => {
    const md = '# Real\n\n```\n# not a heading\n```\n## Also real\n';
    expect(markdownHeadings(md).map((h) => h.text)).toEqual(['Real', 'Also real']);
  });

  it('handles ~~~ fences too', () => {
    const md = '# Real\n~~~\n# nope\n~~~\n## Yes\n';
    expect(markdownHeadings(md).map((h) => h.text)).toEqual(['Real', 'Yes']);
  });

  it('disambiguates duplicate heading slugs', () => {
    const md = '# Setup\n# Setup\n';
    expect(markdownHeadings(md).map((h) => h.id)).toEqual(['setup', 'setup-2']);
  });

  it('strips trailing closing hashes', () => {
    expect(markdownHeadings('## Heading ##\n')[0]).toEqual({ id: 'heading', level: 2, text: 'Heading', line: 0 });
  });

  it('returns [] for prose with no headings', () => {
    expect(markdownHeadings('just some text\n\nmore text')).toEqual([]);
  });

  it('headingSlugs produces the same ids the outline uses, disambiguating repeats', () => {
    // The rendered preview slugs its own heading texts with this shared helper,
    // so ids stay aligned with the outline regardless of ATX vs setext source.
    expect(headingSlugs(['Overview', 'Auth', 'Overview'])).toEqual(['overview', 'auth', 'overview-2']);
    expect(markdownHeadings('# Overview\n## Auth\n## Overview\n').map((h) => h.id)).toEqual(
      headingSlugs(['Overview', 'Auth', 'Overview']),
    );
  });

  it('searchMarkdown matches heading text case-insensitively', () => {
    const md = '# Auth\n## Database\n';
    expect(searchMarkdown(md, 'data').map((h) => h.text)).toEqual(['Database']);
    expect(searchMarkdown(md, 'AUTH').map((h) => h.text)).toEqual(['Auth']);
    expect(searchMarkdown(md, '')).toEqual([]);
  });
});
