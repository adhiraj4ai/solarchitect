import { describe, it, expect } from 'vitest';
import { NODE_TAXONOMY, isValidNodeType } from './taxonomy';

describe('taxonomy', () => {
  it('accepts a known AWS node type', () => {
    expect(isValidNodeType('aws.compute.EC2')).toBe(true);
  });

  it('accepts new provider node types', () => {
    expect(isValidNodeType('cloudflare.network.DNS')).toBe(true);
    expect(isValidNodeType('digitalocean.compute.Droplet')).toBe(true);
    expect(isValidNodeType('saas.communication.Slack')).toBe(true);
    expect(isValidNodeType('onprem.database.PostgreSQL')).toBe(true);
    expect(isValidNodeType('onprem.queue.Kafka')).toBe(true);
    expect(isValidNodeType('oracle.database.Autonomous')).toBe(true);
    expect(isValidNodeType('firebase.database.Firestore')).toBe(true);
    expect(isValidNodeType('elastic.search.Elasticsearch')).toBe(true);
  });

  it('rejects an unknown node type', () => {
    expect(isValidNodeType('aws.compute.NotARealService')).toBe(false);
  });

  it('covers all curated providers', () => {
    const providers = new Set(NODE_TAXONOMY.map((n) => n.provider));
    expect(providers).toEqual(
      new Set([
        'aws',
        'azure',
        'gcp',
        'oracle',
        'ibm',
        'alibaba',
        'kubernetes',
        'onprem',
        'cloudflare',
        'digitalocean',
        'firebase',
        'elastic',
        'saas',
        'generic',
      ]),
    );
  });
});
