import db from "./db";

export interface PermissionGroup {
  name: string;
  description: string;
  permissions: {
    key: string;
    label: string;
    description: string;
  }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    name: "Control & Power",
    description: "Permissions to view live console and perform power actions",
    permissions: [
      { key: "control.start", label: "Start Server", description: "Allows starting the server container" },
      { key: "control.stop", label: "Stop Server", description: "Allows stopping the server container gracefully" },
      { key: "control.restart", label: "Restart Server", description: "Allows rebooting the instance" },
      { key: "control.console", label: "View Console", description: "Allows viewing live streaming terminal logs" },
      { key: "control.command", label: "Send Commands", description: "Allows executing commands in the live terminal" },
    ],
  },
  {
    name: "File Manager",
    description: "Permissions to browse, modify, and manage files",
    permissions: [
      { key: "file.read", label: "Read Files", description: "View directory listings and file contents" },
      { key: "file.create", label: "Create Files", description: "Create new files and folders" },
      { key: "file.edit", label: "Edit Files", description: "Modify and save existing files" },
      { key: "file.delete", label: "Delete Files", description: "Delete files and directories" },
      { key: "file.upload", label: "Upload Files", description: "Upload single or multiple files" },
      { key: "file.archive", label: "Extract Archives", description: "Extract / Unzip .zip and archive files" },
    ],
  },
  {
    name: "Backups",
    description: "Permissions to create, restore, and manage backups",
    permissions: [
      { key: "backup.view", label: "View Backups", description: "View list of existing server backups" },
      { key: "backup.create", label: "Create Backup", description: "Trigger new manual backup creation" },
      { key: "backup.restore", label: "Restore Backup", description: "Restore server state from a backup" },
      { key: "backup.delete", label: "Delete Backup", description: "Permanently delete backups" },
      { key: "backup.download", label: "Download Backup", description: "Download backup archive" },
    ],
  },
  {
    name: "Schedules & Automations",
    description: "Permissions to configure cron automation tasks",
    permissions: [
      { key: "schedule.view", label: "View Schedules", description: "View automated schedules and tasks" },
      { key: "schedule.create", label: "Create Schedule", description: "Create new cron schedules" },
      { key: "schedule.edit", label: "Edit Schedule", description: "Edit schedule tasks and timing" },
      { key: "schedule.delete", label: "Delete Schedule", description: "Remove automated schedules" },
      { key: "schedule.trigger", label: "Trigger Schedule", description: "Manually run automation schedules" },
    ],
  },
  {
    name: "Subusers & Collaborators",
    description: "Permissions to manage server collaborators and roles",
    permissions: [
      { key: "user.view", label: "View Subusers", description: "View list of invited collaborators" },
      { key: "user.create", label: "Invite Subuser", description: "Invite new users by email" },
      { key: "user.edit", label: "Edit Permissions", description: "Modify subuser roles and permissions" },
      { key: "user.delete", label: "Remove Subuser", description: "Revoke collaborator access" },
    ],
  },
  {
    name: "Network & Settings",
    description: "Permissions to view ports and server configuration",
    permissions: [
      { key: "network.view", label: "View Network", description: "View assigned IP and port allocations" },
      { key: "settings.view", label: "View Settings", description: "View server settings and startup command" },
      { key: "settings.rename", label: "Rename Instance", description: "Rename the server title" },
    ],
  },
];

export const ROLE_PRESETS = [
  {
    name: "Co-Owner / Admin",
    description: "Full administrative control over all aspects of the server",
    permissions: ["*"],
  },
  {
    name: "Server Manager",
    description: "Manage power, files, backups, and automation schedules",
    permissions: [
      "control.start", "control.stop", "control.restart", "control.console", "control.command",
      "file.read", "file.create", "file.edit", "file.delete", "file.upload", "file.archive",
      "backup.view", "backup.create", "backup.restore", "backup.delete", "backup.download",
      "schedule.view", "schedule.create", "schedule.edit", "schedule.delete", "schedule.trigger",
      "network.view", "settings.view",
    ],
  },
  {
    name: "Moderator",
    description: "Monitor live console, execute commands, and restart",
    permissions: [
      "control.start", "control.restart", "control.console", "control.command",
      "file.read", "backup.view", "schedule.view", "network.view",
    ],
  },
  {
    name: "Developer / Plugin Dev",
    description: "Full file manager and console access to upload plugins and debug",
    permissions: [
      "control.start", "control.restart", "control.console", "control.command",
      "file.read", "file.create", "file.edit", "file.delete", "file.upload", "file.archive",
      "backup.view", "backup.create", "network.view", "settings.view",
    ],
  },
];

export function checkPermission(userPermissions: string[], required: string): boolean {
  if (userPermissions.includes("*")) return true;
  if (userPermissions.includes(required)) return true;

  const [category] = required.split(".");
  if (userPermissions.includes(`${category}.*`)) return true;

  return false;
}

export async function verifyServerAccess(
  serverId: string,
  userId: string,
  requiredPermission?: string
): Promise<{ allowed: boolean; isOwner: boolean; isAdmin: boolean; subuser?: any; error?: string }> {
  // Check global admin
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") {
    return { allowed: true, isOwner: true, isAdmin: true };
  }

  const server = await db.server.findUnique({
    where: { id: serverId },
    select: {
      id: true,
      ownerId: true,
      subusers: {
        where: { userId },
        select: { id: true, roleName: true, permissions: true },
      },
    },
  });

  if (!server) {
    return { allowed: false, isOwner: false, isAdmin: false, error: "Server not found" };
  }

  if (server.ownerId === userId) {
    return { allowed: true, isOwner: true, isAdmin: false };
  }

  const subuser = server.subusers[0];
  if (!subuser) {
    return { allowed: false, isOwner: false, isAdmin: false, error: "Access denied: you are not a collaborator on this server." };
  }

  if (!requiredPermission) {
    return { allowed: true, isOwner: false, isAdmin: false, subuser };
  }

  let userPerms: string[] = [];
  try {
    userPerms = JSON.parse(subuser.permissions);
  } catch {
    userPerms = [];
  }

  const hasPerm = checkPermission(userPerms, requiredPermission);
  if (!hasPerm) {
    return {
      allowed: false,
      isOwner: false,
      isAdmin: false,
      subuser,
      error: `Permission Denied: missing '${requiredPermission}' capability.`,
    };
  }

  return { allowed: true, isOwner: false, isAdmin: false, subuser };
}
