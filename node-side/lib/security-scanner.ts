import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { appendLog } from "./server-manager";

export interface SecurityThreat {
  file: string;
  rule: string;
  description: string;
  line: number;
  snippet: string;
}

export interface SecurityScanResult {
  safe: boolean;
  threats: SecurityThreat[];
  filesScanned: number;
}

// In-memory server quarantine tracking (5-minute temporary suspension)
export interface QuarantineState {
  until: number; // timestamp in ms
  reason: string;
  threatFile: string;
  rule: string;
  snippet: string;
}

const quarantineMap = new Map<string, QuarantineState>();

export function isServerQuarantined(serverId: string): { quarantined: boolean; remainingSec?: number; details?: QuarantineState } {
  const state = quarantineMap.get(serverId);
  if (!state) return { quarantined: false };

  const now = Date.now();
  if (now >= state.until) {
    quarantineMap.delete(serverId);
    return { quarantined: false };
  }

  const remainingSec = Math.ceil((state.until - now) / 1000);
  return { quarantined: true, remainingSec, details: state };
}

export function liftQuarantine(serverId: string) {
  quarantineMap.delete(serverId);
}

export function applyQuarantine(
  serverId: string,
  threat: SecurityThreat,
  durationMs = 5 * 60 * 1000 // 5 minutes
): QuarantineState {
  const now = Date.now();
  const until = now + durationMs;
  const state: QuarantineState = {
    until,
    reason: `Harmful pattern detected: ${threat.description} in ${threat.file} [Rule: ${threat.rule}]`,
    threatFile: threat.file,
    rule: threat.rule,
    snippet: threat.snippet,
  };

  quarantineMap.set(serverId, state);

  // Output highlighted alert banner to server console log
  const expiryDate = new Date(until).toLocaleTimeString();
  appendLog(serverId, "─────────────────────────────────────────────────────────────────────────────");
  appendLog(serverId, "🛑 [SECURITY SHIELD] THREAT DETECTED — SERVER QUARANTINED (5 MIN SUSPENSION)");
  appendLog(serverId, `🚨 Threat File: ${threat.file} (Line ${threat.line})`);
  appendLog(serverId, `🛡️ Violation:   ${threat.description} [${threat.rule}]`);
  appendLog(serverId, `🔍 Evidence:    ${threat.snippet.slice(0, 120)}`);
  appendLog(serverId, `⏱️ Status:      Process execution blocked. Quarantine active until ${expiryDate}.`);
  appendLog(serverId, "─────────────────────────────────────────────────────────────────────────────");

  return state;
}

// ─── THREAT DETECTION PATTERNS ───────────────────────────────────────────────

interface ThreatRule {
  rule: string;
  description: string;
  regex: RegExp;
}

const THREAT_RULES: ThreatRule[] = [
  // 1. Child Process Execution & Shell Spawning
  {
    rule: "CHILD_PROCESS_IMPORT",
    description: "Importing or requiring dangerous child_process module",
    regex: /(?:require\s*\(\s*['"](?:node:)?child_process['"]\s*\)|import\s+(?:(?:\*\s+as\s+\w+|\{[^}]*\}|\w+)\s+from\s+)?['"](?:node:)?child_process['"])/i,
  },
  {
    rule: "CHILD_PROCESS_METHOD_CALL",
    description: "Direct invocation of child process execution methods",
    regex: /\b(?:child_process\s*\.\s*(?:exec|spawn|execSync|spawnSync|execFile|fork)|(?:execSync|spawnSync|execFile)\s*\()/i,
  },
  // 2. Dangerous Download & Execute Pipelines
  {
    rule: "DOWNLOAD_AND_EXECUTE",
    description: "Piping remote download directly into shell",
    regex: /(?:curl\s+[^|\n]+?\|\s*(?:ba)?sh|wget\s+[^|\n]+?\|\s*(?:ba)?sh|Invoke-Expression|powershell(?:\.exe)?\s+-(?:enc|encodedCommand|e)\b)/i,
  },
  // 3. Obfuscated Malicious Code Execution
  {
    rule: "OBFUSCATED_EVAL",
    description: "Obfuscated dynamic code execution via Buffer or Base64",
    regex: /(?:eval\s*\(\s*(?:Buffer\.from|atob|unescape)\s*\(|Function\s*\([^)]*['"](?:child_process|spawn|exec)['"]|\\x63\\x68\\x69\\x6c\\x64\\x5f\\x70\\x72\\x6f\\x63\\x65\\x73\\x73)/i,
  },
  // 4. Reverse Shell Sockets
  {
    rule: "REVERSE_SHELL",
    description: "Reverse shell socket or network execution pipe",
    regex: /(?:nc\s+-[eE]\s+\/bin\/(?:ba)?sh|\/dev\/tcp\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d+)/i,
  },
  // 5. Host File Tampering
  {
    rule: "HOST_SYSTEM_TAMPERING",
    description: "Unauthorized access to host system credentials",
    regex: /(?:\/etc\/passwd|\/etc\/shadow|process\.kill\s*\(\s*1\s*\))/i,
  },
];

// Directories and files to STRICTLY ignore during scan
const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".rp-state.json",
  ".rp-lock",
  ".cache",
  ".npm",
  ".data",
  ".vscode",
]);

const SCANNABLE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".jsx",
  ".tsx",
  ".json",
  ".sh",
  ".bat",
  ".ps1",
  ".py",
  ".php",
  ".env",
  ".txt",
]);

function getBaseServerDir(serverId: string): string {
  const cwd = process.cwd();
  const direct = path.join(cwd, ".data", "servers", serverId);
  const nested = path.join(cwd, "node-side", ".data", "servers", serverId);
  if (fsSync.existsSync(direct)) return direct;
  if (fsSync.existsSync(nested)) return nested;
  return fsSync.existsSync(path.join(cwd, "node-side")) ? nested : direct;
}

/**
 * Recursively scans server directory for malicious patterns.
 * Explicitly skips node_modules, .git, and internal panel files.
 */
export async function scanServerSecurity(serverId: string): Promise<SecurityScanResult> {
  const baseDir = getBaseServerDir(serverId);
  const threats: SecurityThreat[] = [];
  let filesScanned = 0;

  async function walk(currentDir: string) {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SCANNABLE_EXTENSIONS.has(ext) || entry.name === "package.json" || entry.name === "server.js" || entry.name === "index.js") {
          filesScanned++;
          const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/");

          try {
            const stat = await fs.stat(fullPath);
            // Skip files larger than 2MB to keep scanning ultra-fast
            if (stat.size > 2 * 1024 * 1024) continue;

            const content = await fs.readFile(fullPath, "utf-8");
            const lines = content.split("\n");

            for (let i = 0; i < lines.length; i++) {
              const lineContent = lines[i];
              // Skip comments
              const trimmed = lineContent.trim();
              if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
                continue;
              }

              for (const rule of THREAT_RULES) {
                if (rule.regex.test(lineContent)) {
                  threats.push({
                    file: relativePath,
                    rule: rule.rule,
                    description: rule.description,
                    line: i + 1,
                    snippet: lineContent.trim(),
                  });
                  // Break after first threat in this file to avoid duplicate flooding
                  break;
                }
              }

              if (threats.length >= 10) break;
            }
          } catch {
            // Unreadable file
          }
        }
      }
    }
  }

  try {
    await walk(baseDir);
  } catch (err) {
    console.error(`[SecurityScanner] Error scanning server ${serverId}:`, err);
  }

  return {
    safe: threats.length === 0,
    threats,
    filesScanned,
  };
}
