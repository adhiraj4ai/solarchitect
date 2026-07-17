import { describe, it, expect } from 'vitest';
import {
  documentTypeForFile,
  isDocumentFile,
  documentExtension,
  DOCUMENT_TYPES,
} from './documentType';

describe('documentType', () => {
  it('classifies by extension, longest-match first', () => {
    expect(documentTypeForFile('payments.yaml')).toBe('diagram');
    expect(documentTypeForFile('sketch.whiteboard.json')).toBe('whiteboard');
    expect(documentTypeForFile('notes.md')).toBe('markdown');
  });

  it('does not classify the templates file or unknown/plain files', () => {
    expect(documentTypeForFile('templates.yaml')).toBeNull();
    expect(documentTypeForFile('data.json')).toBeNull(); // plain .json is not a whiteboard
    expect(documentTypeForFile('image.png')).toBeNull();
    expect(documentTypeForFile('README')).toBeNull();
  });

  it('treats .whiteboard.json as whiteboard, never as a diagram or plain json', () => {
    expect(documentTypeForFile('a.whiteboard.json')).toBe('whiteboard');
    expect(isDocumentFile('a.whiteboard.json')).toBe(true);
  });

  it('is case-insensitive on the extension', () => {
    expect(documentTypeForFile('X.YAML')).toBe('diagram');
    expect(documentTypeForFile('X.MD')).toBe('markdown');
    expect(documentTypeForFile('X.WHITEBOARD.JSON')).toBe('whiteboard');
  });

  it('accepts .yml as a diagram too', () => {
    expect(documentTypeForFile('overview.yml')).toBe('diagram');
  });

  it('maps each type to its canonical extension', () => {
    expect(documentExtension('diagram')).toBe('.yaml');
    expect(documentExtension('whiteboard')).toBe('.whiteboard.json');
    expect(documentExtension('markdown')).toBe('.md');
    expect(DOCUMENT_TYPES).toEqual(['diagram', 'whiteboard', 'markdown']);
  });
});
