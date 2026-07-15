export type Provider = 'aws' | 'azure' | 'gcp' | 'kubernetes' | 'generic';

export interface NodeTypeDefinition {
  id: string;
  provider: Provider;
  displayName: string;
  /** Grouping within a provider (Compute, Database, Storage, …) — shown in the library. */
  category: string;
  /** Key into the renderer's glyph set (src/renderer/src/canvas/icons.tsx). */
  glyph: string;
}

// Curated subset of the mingrammer `diagrams` vocabulary — the most-drawn
// services per provider. Each maps to a recognizable glyph; expanding is just
// another row here plus (if new) a glyph in the icon set.
export const NODE_TAXONOMY: NodeTypeDefinition[] = [
  // ---- AWS ----
  { id: 'aws.compute.EC2', provider: 'aws', displayName: 'EC2', category: 'Compute', glyph: 'server' },
  { id: 'aws.compute.Lambda', provider: 'aws', displayName: 'Lambda', category: 'Serverless', glyph: 'function' },
  { id: 'aws.compute.ECS', provider: 'aws', displayName: 'ECS', category: 'Containers', glyph: 'container' },
  { id: 'aws.compute.EKS', provider: 'aws', displayName: 'EKS', category: 'Containers', glyph: 'kubernetes' },
  { id: 'aws.database.RDS', provider: 'aws', displayName: 'RDS', category: 'Database', glyph: 'database' },
  { id: 'aws.database.DynamoDB', provider: 'aws', displayName: 'DynamoDB', category: 'Database', glyph: 'nosql' },
  { id: 'aws.database.ElastiCache', provider: 'aws', displayName: 'ElastiCache', category: 'Cache', glyph: 'cache' },
  { id: 'aws.storage.S3', provider: 'aws', displayName: 'S3', category: 'Storage', glyph: 'bucket' },
  { id: 'aws.network.ELB', provider: 'aws', displayName: 'Elastic Load Balancer', category: 'Network', glyph: 'loadbalancer' },
  { id: 'aws.network.CloudFront', provider: 'aws', displayName: 'CloudFront', category: 'Network', glyph: 'cdn' },
  { id: 'aws.network.Route53', provider: 'aws', displayName: 'Route 53', category: 'Network', glyph: 'dns' },
  { id: 'aws.network.APIGateway', provider: 'aws', displayName: 'API Gateway', category: 'Network', glyph: 'gateway' },
  { id: 'aws.integration.SQS', provider: 'aws', displayName: 'SQS', category: 'Integration', glyph: 'queue' },
  { id: 'aws.security.IAM', provider: 'aws', displayName: 'IAM', category: 'Security', glyph: 'identity' },

  // ---- Azure ----
  { id: 'azure.compute.VM', provider: 'azure', displayName: 'Virtual Machine', category: 'Compute', glyph: 'vm' },
  { id: 'azure.compute.Functions', provider: 'azure', displayName: 'Functions', category: 'Serverless', glyph: 'function' },
  { id: 'azure.compute.AKS', provider: 'azure', displayName: 'AKS', category: 'Containers', glyph: 'kubernetes' },
  { id: 'azure.compute.AppService', provider: 'azure', displayName: 'App Service', category: 'Compute', glyph: 'app' },
  { id: 'azure.database.SQLDatabase', provider: 'azure', displayName: 'SQL Database', category: 'Database', glyph: 'database' },
  { id: 'azure.database.CosmosDB', provider: 'azure', displayName: 'Cosmos DB', category: 'Database', glyph: 'nosql' },
  { id: 'azure.storage.BlobStorage', provider: 'azure', displayName: 'Blob Storage', category: 'Storage', glyph: 'bucket' },
  { id: 'azure.network.LoadBalancer', provider: 'azure', displayName: 'Load Balancer', category: 'Network', glyph: 'loadbalancer' },
  { id: 'azure.network.CDN', provider: 'azure', displayName: 'CDN', category: 'Network', glyph: 'cdn' },
  { id: 'azure.network.DNS', provider: 'azure', displayName: 'DNS', category: 'Network', glyph: 'dns' },
  { id: 'azure.integration.ServiceBus', provider: 'azure', displayName: 'Service Bus', category: 'Integration', glyph: 'queue' },
  { id: 'azure.security.ActiveDirectory', provider: 'azure', displayName: 'Entra ID', category: 'Security', glyph: 'identity' },

  // ---- GCP ----
  { id: 'gcp.compute.ComputeEngine', provider: 'gcp', displayName: 'Compute Engine', category: 'Compute', glyph: 'server' },
  { id: 'gcp.compute.CloudFunctions', provider: 'gcp', displayName: 'Cloud Functions', category: 'Serverless', glyph: 'function' },
  { id: 'gcp.compute.GKE', provider: 'gcp', displayName: 'GKE', category: 'Containers', glyph: 'kubernetes' },
  { id: 'gcp.compute.CloudRun', provider: 'gcp', displayName: 'Cloud Run', category: 'Containers', glyph: 'container' },
  { id: 'gcp.database.CloudSQL', provider: 'gcp', displayName: 'Cloud SQL', category: 'Database', glyph: 'database' },
  { id: 'gcp.database.Firestore', provider: 'gcp', displayName: 'Firestore', category: 'Database', glyph: 'nosql' },
  { id: 'gcp.storage.CloudStorage', provider: 'gcp', displayName: 'Cloud Storage', category: 'Storage', glyph: 'bucket' },
  { id: 'gcp.network.LoadBalancing', provider: 'gcp', displayName: 'Load Balancing', category: 'Network', glyph: 'loadbalancer' },
  { id: 'gcp.analytics.BigQuery', provider: 'gcp', displayName: 'BigQuery', category: 'Analytics', glyph: 'analytics' },
  { id: 'gcp.network.CloudDNS', provider: 'gcp', displayName: 'Cloud DNS', category: 'Network', glyph: 'dns' },

  // ---- Kubernetes ----
  { id: 'kubernetes.compute.Pod', provider: 'kubernetes', displayName: 'Pod', category: 'Workloads', glyph: 'pod' },
  { id: 'kubernetes.compute.Deployment', provider: 'kubernetes', displayName: 'Deployment', category: 'Workloads', glyph: 'deployment' },
  { id: 'kubernetes.network.Service', provider: 'kubernetes', displayName: 'Service', category: 'Network', glyph: 'loadbalancer' },
  { id: 'kubernetes.network.Ingress', provider: 'kubernetes', displayName: 'Ingress', category: 'Network', glyph: 'gateway' },
  { id: 'kubernetes.storage.PersistentVolume', provider: 'kubernetes', displayName: 'Persistent Volume', category: 'Storage', glyph: 'volume' },
  { id: 'kubernetes.config.ConfigMap', provider: 'kubernetes', displayName: 'ConfigMap', category: 'Config', glyph: 'config' },

  // ---- Generic ----
  { id: 'generic.compute.Server', provider: 'generic', displayName: 'Server', category: 'Compute', glyph: 'server' },
  { id: 'generic.storage.Database', provider: 'generic', displayName: 'Database', category: 'Database', glyph: 'database' },
  { id: 'generic.storage.Storage', provider: 'generic', displayName: 'Storage', category: 'Storage', glyph: 'bucket' },
  { id: 'generic.network.LoadBalancer', provider: 'generic', displayName: 'Load Balancer', category: 'Network', glyph: 'loadbalancer' },
  { id: 'generic.network.Firewall', provider: 'generic', displayName: 'Firewall', category: 'Network', glyph: 'firewall' },
  { id: 'generic.network.Internet', provider: 'generic', displayName: 'Internet', category: 'Network', glyph: 'internet' },
  { id: 'generic.integration.Queue', provider: 'generic', displayName: 'Queue', category: 'Integration', glyph: 'queue' },
  { id: 'generic.compute.Cache', provider: 'generic', displayName: 'Cache', category: 'Cache', glyph: 'cache' },
  { id: 'generic.client.User', provider: 'generic', displayName: 'User', category: 'Client', glyph: 'user' },
  { id: 'generic.client.Browser', provider: 'generic', displayName: 'Browser', category: 'Client', glyph: 'client' },
  { id: 'generic.client.Mobile', provider: 'generic', displayName: 'Mobile', category: 'Client', glyph: 'mobile' },
];

const VALID_NODE_TYPE_IDS = new Set(NODE_TAXONOMY.map((n) => n.id));

export function isValidNodeType(typeId: string): boolean {
  return VALID_NODE_TYPE_IDS.has(typeId);
}
