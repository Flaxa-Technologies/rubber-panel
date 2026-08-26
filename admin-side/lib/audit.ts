import db from "./db";

export type AuditAction =
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_SUSPENDED"
  | "USER_UNSUSPENDED"
  | "USER_DELETED"
  | "USER_LOGIN"
  | "USER_LOGIN_FAILED"
  | "USER_PASSWORD_RESET"
  | "SERVER_CREATED"
  | "SERVER_DELETED"
  | "SERVER_SUSPENDED"
  | "SERVER_UNSUSPENDED"
  | "SERVER_STARTED"
  | "SERVER_STOPPED"
  | "SERVER_RESTARTED"
  | "SERVER_UPDATED"
  | "SERVER_REINSTALLED"
  | "NODE_CREATED"
  | "NODE_UPDATED"
  | "NODE_DELETED"
  | "NODE_TOKEN_REGENERATED"
  | "NODE_MAINTENANCE_TOGGLED"
  | "ALLOCATION_CREATED"
  | "ALLOCATION_UPDATED"
  | "ALLOCATION_DELETED"
  | "ALLOCATION_RELEASED"
  | "SETTINGS_CHANGED"
  | "BRANDING_LOGO_UPDATED"
  | "SECURITY_QUARANTINE_TRIGGERED"
  | "API_KEY_CREATED"
  | "API_KEY_DELETED"
  | "BACKUP_CREATED"
  | "BACKUP_DELETED"
  | "BACKUP_RESTORED"
  | "UPDATE_APPLIED";

interface AuditLogParams {
  actorId?: string;
  actorEmail?: string;
  action: AuditAction;
  target?: string;
  targetId?: string;
  result?: "SUCCESS" | "FAILED";
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

export function getIpFromRequest(req: { headers: { get(name: string): string | null } }): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
}

export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: params.actorId,
        actorEmail: params.actorEmail,
        action: params.action,
        target: params.target,
        targetId: params.targetId,
        result: params.result ?? "SUCCESS",
        ipAddress: params.ipAddress,
        metadata: JSON.stringify(params.metadata ?? {}),
      },
    });
  } catch (error) {
    // Audit logging should never break the main flow
    console.error("Failed to create audit log:", error);
  }
}

