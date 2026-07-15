export type Provider = 'aws' | 'azure' | 'gcp' | 'kubernetes' | 'generic';

export interface NodeTypeDefinition {
  id: string;
  provider: Provider;
  displayName: string;
  iconAsset: string;
}

export const NODE_TAXONOMY: NodeTypeDefinition[] = [
  { id: 'aws.compute.EC2', provider: 'aws', displayName: 'EC2', iconAsset: 'aws/ec2.svg' },
  { id: 'aws.database.RDS', provider: 'aws', displayName: 'RDS', iconAsset: 'aws/rds.svg' },
  { id: 'aws.network.ELB', provider: 'aws', displayName: 'Elastic Load Balancer', iconAsset: 'aws/elb.svg' },
  { id: 'azure.compute.VM', provider: 'azure', displayName: 'Virtual Machine', iconAsset: 'azure/vm.svg' },
  {
    id: 'azure.database.SQLDatabase',
    provider: 'azure',
    displayName: 'SQL Database',
    iconAsset: 'azure/sql-database.svg',
  },
  {
    id: 'gcp.compute.ComputeEngine',
    provider: 'gcp',
    displayName: 'Compute Engine',
    iconAsset: 'gcp/compute-engine.svg',
  },
  { id: 'gcp.database.CloudSQL', provider: 'gcp', displayName: 'Cloud SQL', iconAsset: 'gcp/cloud-sql.svg' },
  { id: 'kubernetes.compute.Pod', provider: 'kubernetes', displayName: 'Pod', iconAsset: 'kubernetes/pod.svg' },
  {
    id: 'kubernetes.network.Service',
    provider: 'kubernetes',
    displayName: 'Service',
    iconAsset: 'kubernetes/service.svg',
  },
  { id: 'generic.compute.Server', provider: 'generic', displayName: 'Server', iconAsset: 'generic/server.svg' },
  {
    id: 'generic.storage.Database',
    provider: 'generic',
    displayName: 'Database',
    iconAsset: 'generic/database.svg',
  },
];

const VALID_NODE_TYPE_IDS = new Set(NODE_TAXONOMY.map((n) => n.id));

export function isValidNodeType(typeId: string): boolean {
  return VALID_NODE_TYPE_IDS.has(typeId);
}
