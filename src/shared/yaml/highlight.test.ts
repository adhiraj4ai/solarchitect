import { describe, it, expect } from 'vitest';
import { highlightYaml, highlightLine } from './highlight';

describe('highlightYaml', () => {
  it('tags a key and its scalar value', () => {
    const html = highlightLine('  type: aws.compute.EC2');
    expect(html).toContain('<span class="tok-k">type</span>');
    expect(html).toContain('<span class="tok-p">:</span>');
    expect(html).toContain('<span class="tok-s">aws.compute.EC2</span>');
    expect(html.startsWith('  ')).toBe(true); // indentation preserved
  });

  it('tags numbers and booleans distinctly', () => {
    expect(highlightLine('x: 42')).toContain('<span class="tok-n">42</span>');
    expect(highlightLine('x: -12.5')).toContain('<span class="tok-n">-12.5</span>');
    expect(highlightLine('visible: true')).toContain('<span class="tok-b">true</span>');
    expect(highlightLine('parent: null')).toContain('<span class="tok-b">null</span>');
  });

  it('tags list markers and empty flow collections', () => {
    expect(highlightLine('- id: a')).toContain('<span class="tok-p">-</span>');
    expect(highlightLine('nodes: []')).toContain('<span class="tok-p">[</span>');
    expect(highlightLine('nodes: []')).toContain('<span class="tok-p">]</span>');
  });

  it('tags comments, whole-line and trailing', () => {
    expect(highlightLine('# a note')).toBe('<span class="tok-c"># a note</span>');
    expect(highlightLine('x: 1 # trailing')).toContain('<span class="tok-c"> # trailing</span>');
  });

  it('escapes HTML so content can never inject markup', () => {
    const html = highlightLine('label: "<script>&"');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;&amp;');
  });

  it('preserves the exact line count for gutter alignment', () => {
    const src = 'nodes:\n  - id: a\n\nedges: []';
    expect(highlightYaml(src).split('\n')).toHaveLength(4);
  });

  it('never throws on malformed/partial input', () => {
    expect(() => highlightYaml('nodes:\n  - [unclosed\n:::\n   ')).not.toThrow();
  });
});
