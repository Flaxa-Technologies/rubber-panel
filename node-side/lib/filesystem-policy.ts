import path from "path";

// ─── FILESYSTEM POLICY ───────────────────────────────────────────────────────
// Controls which paths customers can access in their server directory
// This is enforced server-side — never trust client-supplied paths

const DEFAULT_ALLOWED_PATHS = [
  "/plugins",
  "/mods",
  "/config",
  "/world",
  "/world_nether",
  "/world_the_end",
  "/logs",
  "/crash-reports",
];

const DEFAULT_PROTECTED_PATHS = [
  "/server.jar",
  "/start.sh",
  "/startup.sh",
  "/rubber-panel",
  "/.rubber-panel",
  "/eula.txt",
];

export interface FilesystemPolicy {
  allowedPaths: string[];
  protectedPaths: string[];
  maxFileSizeMb: number;
  allowedExtensions?: string[];
}

export function parsePolicy(server: { allowedPaths: string; protectedPaths: string }): FilesystemPolicy {
  let allowedPaths: string[] = DEFAULT_ALLOWED_PATHS;
  let protectedPaths: string[] = DEFAULT_PROTECTED_PATHS;

  try {
    allowedPaths = JSON.parse(server.allowedPaths);
  } catch {}

  try {
    protectedPaths = JSON.parse(server.protectedPaths);
  } catch {}

  return {
    allowedPaths,
    protectedPaths,
    maxFileSizeMb: 50,
  };
}

export function isPathAllowed(
  requestedPath: string,
  serverRoot: string,
  policy: FilesystemPolicy
): { allowed: boolean; reason?: string } {
  // Normalize and resolve to prevent path traversal
  const normalized = path.normalize("/" + requestedPath.replace(/^\/+/, ""));
  const resolved = path.resolve(serverRoot, "." + normalized);

  // CRITICAL: Must be within server root
  if (!resolved.startsWith(path.resolve(serverRoot))) {
    return { allowed: false, reason: "Path traversal detected" };
  }

  // Relative path from server root
  const relative = "/" + path.relative(serverRoot, resolved).replace(/\\/g, "/");

  // Check protected paths
  for (const protectedPath of policy.protectedPaths) {
    if (relative === protectedPath || relative.startsWith(protectedPath + "/")) {
      return { allowed: false, reason: `Path is protected: ${protectedPath}` };
    }
  }

  // Check allowed paths — must start with one of the allowed dirs (or root / for full access)
  const isAllowed = policy.allowedPaths.length === 0 || policy.allowedPaths.some(
    (allowed) => {
      const normAllowed = path.normalize("/" + allowed.replace(/^\/+/, ""));
      return normAllowed === "/" || relative === normAllowed || relative.startsWith(normAllowed + "/");
    }
  );

  if (!isAllowed) {
    return { allowed: false, reason: "Path is not in allowed list" };
  }

  return { allowed: true };
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._\-\s]/g, "")
    .replace(/\.\./g, "")
    .trim()
    .substring(0, 255);
}
