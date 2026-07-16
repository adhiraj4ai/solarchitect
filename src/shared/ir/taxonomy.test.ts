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
    expect(isValidNodeType('vercel.compute.Project')).toBe(true);
    expect(isValidNodeType('netlify.storage.Blobs')).toBe(true);
    expect(isValidNodeType('heroku.compute.Dyno')).toBe(true);
    expect(isValidNodeType('supabase.security.Auth')).toBe(true);
    expect(isValidNodeType('snowflake.analytics.DataWarehouse')).toBe(true);
    expect(isValidNodeType('databricks.analytics.Lakehouse')).toBe(true);
    expect(isValidNodeType('flowchart.basic.Process')).toBe(true);
    expect(isValidNodeType('uml.diagram.Actor')).toBe(true);
    expect(isValidNodeType('aws.database.Aurora')).toBe(true);
    expect(isValidNodeType('azure.compute.VirtualDesktop')).toBe(true);
    expect(isValidNodeType('gcp.compute.AppEngine')).toBe(true);
    expect(isValidNodeType('kubernetes.scaling.HPA')).toBe(true);
    expect(isValidNodeType('saas.collaboration.Jira')).toBe(true);
    expect(isValidNodeType('generic.api.REST')).toBe(true);
    expect(isValidNodeType('language.NodeJS')).toBe(true);
    expect(isValidNodeType('framework.React')).toBe(true);
    expect(isValidNodeType('oss.db.PostgreSQL')).toBe(true);
    expect(isValidNodeType('client.Browser')).toBe(true);
    expect(isValidNodeType('ai.OpenAI')).toBe(true);
    expect(isValidNodeType('onprem.ci.ArgoCD')).toBe(true);
    expect(isValidNodeType('uml.shape.Folder')).toBe(true);
    expect(isValidNodeType('uml.shape.Hexagon')).toBe(true);
    
    // Phase 7
    expect(isValidNodeType('snowflake.analytics.Snowpark')).toBe(true);
    expect(isValidNodeType('databricks.ml.MLflow')).toBe(true);
    expect(isValidNodeType('language.Kotlin')).toBe(true);
    expect(isValidNodeType('framework.Svelte')).toBe(true);
    expect(isValidNodeType('oss.db.ClickHouse')).toBe(true);
    expect(isValidNodeType('ai.LangChain')).toBe(true);
    
    // Phase 8
    expect(isValidNodeType('cloudflare.network.Pages')).toBe(true);
    expect(isValidNodeType('vercel.ai.v0')).toBe(true);
    expect(isValidNodeType('firebase.analytics.Crashlytics')).toBe(true);
    expect(isValidNodeType('saas.design.Figma')).toBe(true);
    
    // Phase 9
    expect(isValidNodeType('generic.compute.Script')).toBe(true);
    expect(isValidNodeType('generic.integration.Scheduler')).toBe(true);
    expect(isValidNodeType('generic.data.Parquet')).toBe(true);
    expect(isValidNodeType('oss.db.ScyllaDB')).toBe(true);
    
    // Phase 10
    expect(isValidNodeType('aws.analytics.EMR')).toBe(true);
    expect(isValidNodeType('aws.blockchain.ManagedBlockchain')).toBe(true);
    expect(isValidNodeType('aws.database.DocumentdbMongodbCompatibility')).toBe(true);
    expect(isValidNodeType('aws.ml.SagemakerModel')).toBe(true);
    expect(isValidNodeType('aws.robotics.Robomaker')).toBe(true);
    
    // Phase 11
    expect(isValidNodeType('gcp.compute.ComputeEngine')).toBe(true);
    expect(isValidNodeType('gcp.analytics.BigQuery')).toBe(true);
    expect(isValidNodeType('azure.compute.VM')).toBe(true);
    expect(isValidNodeType('azure.database.CosmosDb')).toBe(true);
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
        'vercel',
        'netlify',
        'heroku',
        'supabase',
        'snowflake',
        'databricks',
        'flowchart',
        'uml',
        'language',
        'framework',
        'oss',
        'client',
        'ai',
        'generic',
      ]),
    );
  });
});
