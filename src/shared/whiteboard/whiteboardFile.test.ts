import { describe, it, expect } from 'vitest';
import {
  parseWhiteboardFile,
  serializeWhiteboardFile,
  emptyWhiteboardFile,
  isWhiteboardEmpty,
} from './whiteboardFile';

describe('whiteboardFile', () => {
  it('round-trips the wrapped format', () => {
    const file = {
      version: 1 as const,
      snapshot: { store: { a: 1 } },
      backdropDiagram: 'payments.yaml',
    };
    const text = serializeWhiteboardFile(file);
    expect(parseWhiteboardFile(text)).toEqual(file);
  });

  it('treats a missing or empty file as empty', () => {
    expect(parseWhiteboardFile(null)).toEqual(emptyWhiteboardFile());
    expect(parseWhiteboardFile('')).toEqual(emptyWhiteboardFile());
    expect(parseWhiteboardFile('   ')).toEqual(emptyWhiteboardFile());
  });

  it('migrates a legacy bare snapshot to the wrapped format with no backdrop', () => {
    const bare = JSON.stringify({ store: { 'shape:1': { typeName: 'shape' } }, schema: {} });
    const parsed = parseWhiteboardFile(bare);
    expect(parsed.version).toBe(1);
    expect(parsed.backdropDiagram).toBeNull();
    expect(parsed.snapshot).toEqual({ store: { 'shape:1': { typeName: 'shape' } }, schema: {} });
  });

  it('preserves legacy pendingAnnotations so the renderer can materialize them', () => {
    const legacy = JSON.stringify({
      pendingAnnotations: [
        { id: 'a1', kind: 'sticky', x: 0, y: 0, width: 10, height: 10, content: 'hi' },
      ],
    });
    const parsed = parseWhiteboardFile(legacy);
    expect(parsed.snapshot).toBeNull();
    expect(parsed.pendingAnnotations).toHaveLength(1);
    expect(parsed.backdropDiagram).toBeNull();
  });

  it('falls back to empty on corrupt JSON (never throws)', () => {
    expect(parseWhiteboardFile('{not json')).toEqual(emptyWhiteboardFile());
  });

  it('treats an unrecognized object (no store, not versioned) as empty', () => {
    expect(parseWhiteboardFile('{"foo":1}')).toEqual(emptyWhiteboardFile());
    expect(parseWhiteboardFile('[]')).toEqual(emptyWhiteboardFile());
    expect(parseWhiteboardFile('42')).toEqual(emptyWhiteboardFile());
  });

  it('reports emptiness for the blank file and non-emptiness once it has content', () => {
    expect(isWhiteboardEmpty(emptyWhiteboardFile())).toBe(true);
    expect(isWhiteboardEmpty({ version: 1, snapshot: { store: {} }, backdropDiagram: null })).toBe(false);
    expect(isWhiteboardEmpty({ version: 1, snapshot: null, backdropDiagram: 'a.yaml' })).toBe(false);
  });
});
