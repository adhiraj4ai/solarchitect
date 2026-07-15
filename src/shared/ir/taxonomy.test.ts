import { describe, it, expect } from 'vitest';
import { NODE_TAXONOMY, isValidNodeType } from './taxonomy';

describe('taxonomy', () => {
  it('accepts a known AWS node type', () => {
    expect(isValidNodeType('aws.compute.EC2')).toBe(true);
  });

  it('rejects an unknown node type', () => {
    expect(isValidNodeType('aws.compute.NotARealService')).toBe(false);
  });

  it('covers all v1 curated providers', () => {
    const providers = new Set(NODE_TAXONOMY.map((n) => n.provider));
    expect(providers).toEqual(new Set(['aws', 'azure', 'gcp', 'kubernetes', 'generic']));
  });
});
