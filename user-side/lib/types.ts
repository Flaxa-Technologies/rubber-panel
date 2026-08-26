export interface ServerAllocation {
  id?: string;
  ip: string;
  port: number;
}

export interface ServerBackup {
  id: string;
  name: string;
  status: string;
  size: number | null;
  createdAt: string;
}

export interface UserServer {
  id: string;
  name: string;
  uuid?: string;
  status: string;
  suspended: boolean;
  ram: number;
  cpu: number;
  disk: number;
  diskUsedMb?: number;
  diskUsedBytes?: number;
  ramUsageMb?: number;
  cpuUsage?: number;
  swap?: number;
  createdAt?: string;
  startupCommand?: string | null;
  port?: number;
  node: { id?: string; name: string; status: string; fqdn?: string; port?: number };
  software: { name: string; type: string } | null;
  softwareVersion: { version: string } | null;
  allocations: ServerAllocation[];
  backups?: ServerBackup[];
  // File permissions
  allowedPaths?: string;        // JSON-encoded string array e.g. '["/plugins","/config"]'
  protectedPaths?: string;      // JSON-encoded string array e.g. '["/server.jar"]'
  blockedUploadPaths?: string;  // JSON-encoded string array e.g. '["/config","/world"]'
  allowNodeTransfer?: boolean;
  serverType?: string;
  nodeVersion?: string | null;
  securityProtection?: boolean;
  securitySuspendedUntil?: string | null;
  securityQuarantineReason?: string | null;
  javaVersion?: string | null;
  javaVersionId?: string | null;
  cryoSleepEnabled?: boolean;
  cryoSleepIdleMinutes?: number;
  cryoSleepCustomMotdAllowed?: boolean;
  cryoSleepMotd?: string | null;
  isCryoSleeping?: boolean;
}

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

export type PowerAction = "start" | "stop" | "restart";
