export type Provider =
  | 'aws'
  | 'azure'
  | 'gcp'
  | 'kubernetes'
  | 'onprem'
  | 'cloudflare'
  | 'digitalocean'
  | 'saas'
  | 'generic';

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
  { id: 'aws.compute.Fargate', provider: 'aws', displayName: 'Fargate', category: 'Containers', glyph: 'container' },
  { id: 'aws.storage.EBS', provider: 'aws', displayName: 'EBS', category: 'Storage', glyph: 'volume' },
  { id: 'aws.network.VPC', provider: 'aws', displayName: 'VPC', category: 'Network', glyph: 'vpc' },
  { id: 'aws.integration.SQS', provider: 'aws', displayName: 'SQS', category: 'Integration', glyph: 'queue' },
  { id: 'aws.integration.SNS', provider: 'aws', displayName: 'SNS', category: 'Integration', glyph: 'hub' },
  { id: 'aws.integration.EventBridge', provider: 'aws', displayName: 'EventBridge', category: 'Integration', glyph: 'hub' },
  { id: 'aws.integration.StepFunctions', provider: 'aws', displayName: 'Step Functions', category: 'Integration', glyph: 'steps' },
  { id: 'aws.analytics.Redshift', provider: 'aws', displayName: 'Redshift', category: 'Analytics', glyph: 'analytics' },
  { id: 'aws.analytics.Kinesis', provider: 'aws', displayName: 'Kinesis', category: 'Analytics', glyph: 'hub' },
  { id: 'aws.ml.SageMaker', provider: 'aws', displayName: 'SageMaker', category: 'ML', glyph: 'chip' },
  { id: 'aws.management.CloudWatch', provider: 'aws', displayName: 'CloudWatch', category: 'Management', glyph: 'gauge' },
  { id: 'aws.security.WAF', provider: 'aws', displayName: 'WAF', category: 'Security', glyph: 'firewall' },
  { id: 'aws.security.SecretsManager', provider: 'aws', displayName: 'Secrets Manager', category: 'Security', glyph: 'lock' },
  { id: 'aws.security.IAM', provider: 'aws', displayName: 'IAM', category: 'Security', glyph: 'identity' },
  { id: 'aws.analytics.Glue', provider: 'aws', displayName: 'Glue', category: 'Analytics', glyph: 'etl' },
  { id: 'aws.analytics.Athena', provider: 'aws', displayName: 'Athena', category: 'Analytics', glyph: 'search' },
  { id: 'aws.security.Cognito', provider: 'aws', displayName: 'Cognito', category: 'Security', glyph: 'identity' },
  { id: 'aws.security.KMS', provider: 'aws', displayName: 'KMS', category: 'Security', glyph: 'key' },
  { id: 'aws.network.TransitGateway', provider: 'aws', displayName: 'Transit Gateway', category: 'Network', glyph: 'router' },
  { id: 'aws.integration.AppSync', provider: 'aws', displayName: 'AppSync', category: 'Integration', glyph: 'graph' },
  { id: 'aws.storage.EFS', provider: 'aws', displayName: 'EFS', category: 'Storage', glyph: 'file' },
  { id: 'aws.management.CloudFormation', provider: 'aws', displayName: 'CloudFormation', category: 'Management', glyph: 'iac' },

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
  { id: 'azure.storage.Disk', provider: 'azure', displayName: 'Managed Disk', category: 'Storage', glyph: 'volume' },
  { id: 'azure.network.VirtualNetwork', provider: 'azure', displayName: 'Virtual Network', category: 'Network', glyph: 'vpc' },
  { id: 'azure.integration.ServiceBus', provider: 'azure', displayName: 'Service Bus', category: 'Integration', glyph: 'queue' },
  { id: 'azure.integration.EventGrid', provider: 'azure', displayName: 'Event Grid', category: 'Integration', glyph: 'hub' },
  { id: 'azure.analytics.Synapse', provider: 'azure', displayName: 'Synapse', category: 'Analytics', glyph: 'analytics' },
  { id: 'azure.ml.MachineLearning', provider: 'azure', displayName: 'Machine Learning', category: 'ML', glyph: 'chip' },
  { id: 'azure.management.Monitor', provider: 'azure', displayName: 'Monitor', category: 'Management', glyph: 'gauge' },
  { id: 'azure.security.KeyVault', provider: 'azure', displayName: 'Key Vault', category: 'Security', glyph: 'lock' },
  { id: 'azure.security.ActiveDirectory', provider: 'azure', displayName: 'Entra ID', category: 'Security', glyph: 'identity' },
  { id: 'azure.analytics.DataFactory', provider: 'azure', displayName: 'Data Factory', category: 'Analytics', glyph: 'etl' },
  { id: 'azure.security.Defender', provider: 'azure', displayName: 'Defender', category: 'Security', glyph: 'shield' },
  { id: 'azure.network.TransitGateway', provider: 'azure', displayName: 'Transit Gateway', category: 'Network', glyph: 'router' },
  { id: 'azure.integration.APIManagement', provider: 'azure', displayName: 'API Management', category: 'Integration', glyph: 'gateway' },
  { id: 'azure.storage.Files', provider: 'azure', displayName: 'Azure Files', category: 'Storage', glyph: 'file' },

  // ---- GCP ----
  { id: 'gcp.compute.ComputeEngine', provider: 'gcp', displayName: 'Compute Engine', category: 'Compute', glyph: 'server' },
  { id: 'gcp.compute.CloudFunctions', provider: 'gcp', displayName: 'Cloud Functions', category: 'Serverless', glyph: 'function' },
  { id: 'gcp.compute.GKE', provider: 'gcp', displayName: 'GKE', category: 'Containers', glyph: 'kubernetes' },
  { id: 'gcp.compute.CloudRun', provider: 'gcp', displayName: 'Cloud Run', category: 'Containers', glyph: 'container' },
  { id: 'gcp.database.CloudSQL', provider: 'gcp', displayName: 'Cloud SQL', category: 'Database', glyph: 'database' },
  { id: 'gcp.database.Firestore', provider: 'gcp', displayName: 'Firestore', category: 'Database', glyph: 'nosql' },
  { id: 'gcp.storage.CloudStorage', provider: 'gcp', displayName: 'Cloud Storage', category: 'Storage', glyph: 'bucket' },
  { id: 'gcp.network.LoadBalancing', provider: 'gcp', displayName: 'Load Balancing', category: 'Network', glyph: 'loadbalancer' },
  { id: 'gcp.database.Spanner', provider: 'gcp', displayName: 'Spanner', category: 'Database', glyph: 'database' },
  { id: 'gcp.analytics.BigQuery', provider: 'gcp', displayName: 'BigQuery', category: 'Analytics', glyph: 'analytics' },
  { id: 'gcp.analytics.Dataflow', provider: 'gcp', displayName: 'Dataflow', category: 'Analytics', glyph: 'steps' },
  { id: 'gcp.integration.PubSub', provider: 'gcp', displayName: 'Pub/Sub', category: 'Integration', glyph: 'hub' },
  { id: 'gcp.ml.VertexAI', provider: 'gcp', displayName: 'Vertex AI', category: 'ML', glyph: 'chip' },
  { id: 'gcp.management.Monitoring', provider: 'gcp', displayName: 'Monitoring', category: 'Management', glyph: 'gauge' },
  { id: 'gcp.network.VPC', provider: 'gcp', displayName: 'VPC', category: 'Network', glyph: 'vpc' },
  { id: 'gcp.network.CloudDNS', provider: 'gcp', displayName: 'Cloud DNS', category: 'Network', glyph: 'dns' },
  { id: 'gcp.analytics.DataPrep', provider: 'gcp', displayName: 'DataPrep', category: 'Analytics', glyph: 'etl' },
  { id: 'gcp.security.KMS', provider: 'gcp', displayName: 'Cloud KMS', category: 'Security', glyph: 'key' },
  { id: 'gcp.security.Armor', provider: 'gcp', displayName: 'Cloud Armor', category: 'Security', glyph: 'firewall' },
  { id: 'gcp.network.Interconnect', provider: 'gcp', displayName: 'Interconnect', category: 'Network', glyph: 'router' },
  { id: 'gcp.network.ApiGateway', provider: 'gcp', displayName: 'API Gateway', category: 'Network', glyph: 'gateway' },
  { id: 'gcp.storage.Filestore', provider: 'gcp', displayName: 'Filestore', category: 'Storage', glyph: 'file' },

  // ---- Kubernetes ----
  { id: 'kubernetes.compute.Pod', provider: 'kubernetes', displayName: 'Pod', category: 'Workloads', glyph: 'pod' },
  { id: 'kubernetes.compute.Deployment', provider: 'kubernetes', displayName: 'Deployment', category: 'Workloads', glyph: 'deployment' },
  { id: 'kubernetes.network.Service', provider: 'kubernetes', displayName: 'Service', category: 'Network', glyph: 'loadbalancer' },
  { id: 'kubernetes.network.Ingress', provider: 'kubernetes', displayName: 'Ingress', category: 'Network', glyph: 'gateway' },
  { id: 'kubernetes.compute.StatefulSet', provider: 'kubernetes', displayName: 'StatefulSet', category: 'Workloads', glyph: 'registry' },
  { id: 'kubernetes.compute.DaemonSet', provider: 'kubernetes', displayName: 'DaemonSet', category: 'Workloads', glyph: 'deployment' },
  { id: 'kubernetes.compute.CronJob', provider: 'kubernetes', displayName: 'CronJob', category: 'Workloads', glyph: 'clock' },
  { id: 'kubernetes.storage.PersistentVolume', provider: 'kubernetes', displayName: 'Persistent Volume', category: 'Storage', glyph: 'volume' },
  { id: 'kubernetes.config.ConfigMap', provider: 'kubernetes', displayName: 'ConfigMap', category: 'Config', glyph: 'config' },
  { id: 'kubernetes.config.Secret', provider: 'kubernetes', displayName: 'Secret', category: 'Config', glyph: 'lock' },
  { id: 'kubernetes.group.Namespace', provider: 'kubernetes', displayName: 'Namespace', category: 'Grouping', glyph: 'namespace' },
  { id: 'kubernetes.controller.ReplicaSet', provider: 'kubernetes', displayName: 'ReplicaSet', category: 'Workloads', glyph: 'registry' },
  { id: 'kubernetes.controller.Job', provider: 'kubernetes', displayName: 'Job', category: 'Workloads', glyph: 'gear' },

  // ---- Cloudflare ----
  { id: 'cloudflare.network.DNS', provider: 'cloudflare', displayName: 'DNS Resolver', category: 'Network', glyph: 'dns' },
  { id: 'cloudflare.network.WAF', provider: 'cloudflare', displayName: 'WAF', category: 'Security', glyph: 'firewall' },
  { id: 'cloudflare.network.CDN', provider: 'cloudflare', displayName: 'CDN', category: 'Network', glyph: 'cdn' },
  { id: 'cloudflare.compute.Workers', provider: 'cloudflare', displayName: 'Workers', category: 'Compute', glyph: 'function' },
  { id: 'cloudflare.storage.R2', provider: 'cloudflare', displayName: 'R2 Storage', category: 'Storage', glyph: 'bucket' },
  { id: 'cloudflare.security.SSL', provider: 'cloudflare', displayName: 'SSL/TLS', category: 'Security', glyph: 'certificate' },
  { id: 'cloudflare.network.Tunnel', provider: 'cloudflare', displayName: 'Tunnel', category: 'Network', glyph: 'tunnel' },

  // ---- DigitalOcean ----
  { id: 'digitalocean.compute.Droplet', provider: 'digitalocean', displayName: 'Droplet', category: 'Compute', glyph: 'droplet' },
  { id: 'digitalocean.compute.AppPlatform', provider: 'digitalocean', displayName: 'App Platform', category: 'Compute', glyph: 'app' },
  { id: 'digitalocean.database.ManagedDatabase', provider: 'digitalocean', displayName: 'Managed Database', category: 'Database', glyph: 'database' },
  { id: 'digitalocean.storage.Space', provider: 'digitalocean', displayName: 'Spaces', category: 'Storage', glyph: 'bucket' },
  { id: 'digitalocean.storage.Volume', provider: 'digitalocean', displayName: 'Volume', category: 'Storage', glyph: 'volume' },
  { id: 'digitalocean.network.LoadBalancer', provider: 'digitalocean', displayName: 'Load Balancer', category: 'Network', glyph: 'loadbalancer' },
  { id: 'digitalocean.network.VPC', provider: 'digitalocean', displayName: 'VPC', category: 'Network', glyph: 'vpc' },
  { id: 'digitalocean.compute.DOKS', provider: 'digitalocean', displayName: 'Kubernetes (DOKS)', category: 'Containers', glyph: 'kubernetes' },

  // ---- SaaS ----
  { id: 'saas.communication.Slack', provider: 'saas', displayName: 'Slack', category: 'Communication', glyph: 'slack' },
  { id: 'saas.vcs.GitHub', provider: 'saas', displayName: 'GitHub', category: 'VCS', glyph: 'github' },
  { id: 'saas.payment.Stripe', provider: 'saas', displayName: 'Stripe', category: 'Payment', glyph: 'creditcard' },
  { id: 'saas.auth.Auth0', provider: 'saas', displayName: 'Auth0', category: 'Security', glyph: 'shield' },
  { id: 'saas.communication.Twilio', provider: 'saas', displayName: 'Twilio', category: 'Communication', glyph: 'message' },
  { id: 'saas.communication.SendGrid', provider: 'saas', displayName: 'SendGrid', category: 'Communication', glyph: 'mail' },

  // ---- On-prem / self-hosted (the mingrammer `onprem` catalog) ----
  { id: 'onprem.compute.Server', provider: 'onprem', displayName: 'Server', category: 'Compute', glyph: 'server' },
  { id: 'onprem.container.Docker', provider: 'onprem', displayName: 'Docker', category: 'Containers', glyph: 'container' },
  { id: 'onprem.container.Kubernetes', provider: 'onprem', displayName: 'Kubernetes', category: 'Containers', glyph: 'kubernetes' },
  { id: 'onprem.network.Nginx', provider: 'onprem', displayName: 'Nginx', category: 'Network', glyph: 'proxy' },
  { id: 'onprem.network.Apache', provider: 'onprem', displayName: 'Apache HTTP', category: 'Network', glyph: 'proxy' },
  { id: 'onprem.network.HAProxy', provider: 'onprem', displayName: 'HAProxy', category: 'Network', glyph: 'loadbalancer' },
  { id: 'onprem.network.Traefik', provider: 'onprem', displayName: 'Traefik', category: 'Network', glyph: 'proxy' },
  { id: 'onprem.database.PostgreSQL', provider: 'onprem', displayName: 'PostgreSQL', category: 'Database', glyph: 'database' },
  { id: 'onprem.database.MySQL', provider: 'onprem', displayName: 'MySQL', category: 'Database', glyph: 'database' },
  { id: 'onprem.database.MongoDB', provider: 'onprem', displayName: 'MongoDB', category: 'Database', glyph: 'nosql' },
  { id: 'onprem.database.Cassandra', provider: 'onprem', displayName: 'Cassandra', category: 'Database', glyph: 'nosql' },
  { id: 'onprem.inmemory.Redis', provider: 'onprem', displayName: 'Redis', category: 'Cache', glyph: 'cache' },
  { id: 'onprem.queue.Kafka', provider: 'onprem', displayName: 'Kafka', category: 'Queue', glyph: 'stream' },
  { id: 'onprem.queue.RabbitMQ', provider: 'onprem', displayName: 'RabbitMQ', category: 'Queue', glyph: 'queue' },
  { id: 'onprem.monitoring.Prometheus', provider: 'onprem', displayName: 'Prometheus', category: 'Monitoring', glyph: 'gauge' },
  { id: 'onprem.monitoring.Grafana', provider: 'onprem', displayName: 'Grafana', category: 'Monitoring', glyph: 'dashboard' },
  { id: 'onprem.logging.Fluentd', provider: 'onprem', displayName: 'Fluentd', category: 'Logging', glyph: 'logs' },
  { id: 'onprem.logging.Loki', provider: 'onprem', displayName: 'Loki', category: 'Logging', glyph: 'logs' },
  { id: 'onprem.search.Elasticsearch', provider: 'onprem', displayName: 'Elasticsearch', category: 'Search', glyph: 'search' },
  { id: 'onprem.tracing.Jaeger', provider: 'onprem', displayName: 'Jaeger', category: 'Tracing', glyph: 'graph' },
  { id: 'onprem.ci.Jenkins', provider: 'onprem', displayName: 'Jenkins', category: 'CI/CD', glyph: 'ci' },
  { id: 'onprem.ci.GitLab', provider: 'onprem', displayName: 'GitLab', category: 'CI/CD', glyph: 'ci' },
  { id: 'onprem.vcs.Git', provider: 'onprem', displayName: 'Git', category: 'VCS', glyph: 'github' },
  { id: 'onprem.iac.Terraform', provider: 'onprem', displayName: 'Terraform', category: 'IaC', glyph: 'iac' },
  { id: 'onprem.iac.Ansible', provider: 'onprem', displayName: 'Ansible', category: 'IaC', glyph: 'iac' },
  { id: 'onprem.gitops.ArgoCD', provider: 'onprem', displayName: 'Argo CD', category: 'GitOps', glyph: 'steps' },
  { id: 'onprem.workflow.Airflow', provider: 'onprem', displayName: 'Airflow', category: 'Workflow', glyph: 'steps' },
  { id: 'onprem.client.User', provider: 'onprem', displayName: 'User', category: 'Client', glyph: 'user' },

  // ---- Generic ----
  { id: 'generic.compute.Server', provider: 'generic', displayName: 'Server', category: 'Compute', glyph: 'server' },
  { id: 'generic.storage.Database', provider: 'generic', displayName: 'Database', category: 'Database', glyph: 'database' },
  { id: 'generic.storage.Storage', provider: 'generic', displayName: 'Storage', category: 'Storage', glyph: 'bucket' },
  { id: 'generic.network.LoadBalancer', provider: 'generic', displayName: 'Load Balancer', category: 'Network', glyph: 'loadbalancer' },
  { id: 'generic.network.Firewall', provider: 'generic', displayName: 'Firewall', category: 'Network', glyph: 'firewall' },
  { id: 'generic.network.Internet', provider: 'generic', displayName: 'Internet', category: 'Network', glyph: 'internet' },
  { id: 'generic.integration.Queue', provider: 'generic', displayName: 'Queue', category: 'Integration', glyph: 'queue' },
  { id: 'generic.compute.Cache', provider: 'generic', displayName: 'Cache', category: 'Cache', glyph: 'cache' },
  { id: 'generic.compute.Container', provider: 'generic', displayName: 'Container', category: 'Compute', glyph: 'container' },
  { id: 'generic.compute.Function', provider: 'generic', displayName: 'Function', category: 'Compute', glyph: 'function' },
  { id: 'generic.integration.EventBus', provider: 'generic', displayName: 'Event Bus', category: 'Integration', glyph: 'hub' },
  { id: 'generic.network.Gateway', provider: 'generic', displayName: 'Gateway', category: 'Network', glyph: 'gateway' },
  { id: 'generic.network.CDN', provider: 'generic', displayName: 'CDN', category: 'Network', glyph: 'cdn' },
  { id: 'generic.network.DNS', provider: 'generic', displayName: 'DNS', category: 'Network', glyph: 'dns' },
  { id: 'generic.observability.Monitoring', provider: 'generic', displayName: 'Monitoring', category: 'Observability', glyph: 'gauge' },
  { id: 'generic.security.Secret', provider: 'generic', displayName: 'Secret', category: 'Security', glyph: 'lock' },
  { id: 'generic.ml.Model', provider: 'generic', displayName: 'Model', category: 'ML', glyph: 'chip' },
  { id: 'generic.client.User', provider: 'generic', displayName: 'User', category: 'Client', glyph: 'user' },
  { id: 'generic.client.Browser', provider: 'generic', displayName: 'Browser', category: 'Client', glyph: 'client' },
  { id: 'generic.client.Mobile', provider: 'generic', displayName: 'Mobile', category: 'Client', glyph: 'mobile' },
  { id: 'generic.vcs.Git', provider: 'generic', displayName: 'Git', category: 'VCS', glyph: 'github' },
  { id: 'generic.analytics.Spark', provider: 'generic', displayName: 'Spark', category: 'Analytics', glyph: 'spark' },
  { id: 'generic.search.Elasticsearch', provider: 'generic', displayName: 'Elasticsearch', category: 'Search', glyph: 'search' },
  { id: 'generic.integration.Mail', provider: 'generic', displayName: 'Mail Server', category: 'Integration', glyph: 'mail' },
  { id: 'generic.security.Certificate', provider: 'generic', displayName: 'Certificate', category: 'Security', glyph: 'certificate' },
  { id: 'generic.observability.Alert', provider: 'generic', displayName: 'Alert Manager', category: 'Observability', glyph: 'bell' },
];

const VALID_NODE_TYPE_IDS = new Set(NODE_TAXONOMY.map((n) => n.id));

export function isValidNodeType(typeId: string): boolean {
  return VALID_NODE_TYPE_IDS.has(typeId);
}
