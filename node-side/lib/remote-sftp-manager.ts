import { Client as SshClient } from "ssh2";
import type { SFTPWrapper, FileEntry } from "ssh2";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import crypto from "crypto";
import { getServerDir } from "./server-manager";

export interface SftpConnectionConfig {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  remotePath?: string;
}

export interface SftpJob {
  id: string;
  serverId: string;
  type: "pull" | "transfer";
  status: "running" | "completed" | "failed";
  progressPercent: number;
  currentFile: string;
  transferredFiles: number;
  totalFiles: number;
  transferredBytes: number;
  totalBytes: number;
  logs: string[];
  error?: string;
  startedAt: number;
  completedAt?: number;
}

// In-memory store of active/recent jobs
const jobs = new Map<string, SftpJob>();

function appendJobLog(job: SftpJob, message: string) {
  const timestamp = new Date().toLocaleTimeString();
  const logLine = `[${timestamp}] ${message}`;
  job.logs.push(logLine);
  if (job.logs.length > 500) {
    job.logs.shift();
  }
}

function connectSftp(config: SftpConnectionConfig): Promise<{ conn: SshClient; sftp: SFTPWrapper }> {
  return new Promise((resolve, reject) => {
    const conn = new SshClient();
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { conn.end(); } catch {}
        reject(new Error("Connection timed out after 15 seconds. Please check host, port, and firewall rules."));
      }
    }, 15000);

    conn.on("ready", () => {
      conn.sftp((err, sftp) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (err) {
          try { conn.end(); } catch {}
          return reject(new Error(`SFTP subsystem initialization failed: ${err.message}`));
        }
        resolve({ conn, sftp });
      });
    });

    conn.on("error", (err: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      let errMsg = err.message || "Failed to establish SSH connection";
      if (err.level === "client-authentication") {
        errMsg = "Authentication failed. Check your SFTP username and password/private key.";
      }
      reject(new Error(errMsg));
    });

    try {
      conn.connect({
        host: config.host.trim(),
        port: config.port ? Number(config.port) : 22,
        username: config.username.trim(),
        password: config.password || undefined,
        privateKey: config.privateKey || undefined,
        passphrase: config.passphrase || undefined,
        readyTimeout: 15000,
        keepaliveInterval: 10000,
      });
    } catch (err: any) {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(err);
      }
    }
  });
}

function isDirectoryEntry(entry: FileEntry): boolean {
  if (typeof (entry.attrs as any).isDirectory === "function") {
    return (entry.attrs as any).isDirectory();
  }
  return ((entry.attrs.mode & 0o170000) === 0o040000);
}

function isPathExcluded(relPath: string, excludeList: string[]): boolean {
  const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
  return excludeList.some(ex => {
    const normEx = ex.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
    if (!normEx) return false;
    return normalized === normEx || normalized.startsWith(normEx + "/");
  });
}

function isPathPreserved(relPath: string, preserveList: string[]): boolean {
  const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
  return preserveList.some(pre => {
    const normPre = pre.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
    if (!normPre) return false;
    return normalized === normPre || normalized.startsWith(normPre + "/") || normPre.startsWith(normalized + "/");
  });
}

/**
 * Tests SFTP connectivity and path listing.
 */
export async function testSftpConnection(config: SftpConnectionConfig): Promise<{
  success: boolean;
  message: string;
  entries?: { name: string; isDir: boolean; size: number }[];
}> {
  let clientConn: SshClient | null = null;
  try {
    const { conn, sftp } = await connectSftp(config);
    clientConn = conn;
    const targetPath = config.remotePath?.trim() || "/";

    return new Promise((resolve) => {
      sftp.readdir(targetPath, (err, list) => {
        try { clientConn?.end(); } catch {}

        if (err) {
          // If reading root fails, try reading "./"
          return resolve({
            success: false,
            message: `Connected to SSH, but failed to read directory '${targetPath}': ${err.message}`,
          });
        }

        const entries = (list || []).map(item => ({
          name: item.filename,
          isDir: isDirectoryEntry(item),
          size: item.attrs?.size || 0,
        }));

        resolve({
          success: true,
          message: `Successfully connected to SFTP host! Found ${entries.length} items in '${targetPath}'.`,
          entries: entries.slice(0, 50),
        });
      });
    });
  } catch (error: any) {
    if (clientConn) {
      try { clientConn.end(); } catch {}
    }
    return {
      success: false,
      message: error.message || "Failed to connect to SFTP host.",
    };
  }
}

/**
 * Preview pulling server files from remote SFTP.
 * Calculates what will be overwritten, what will be preserved, and what will be deleted.
 */
export async function previewPullManifest(params: {
  serverId: string;
  config: SftpConnectionConfig;
  preservePaths?: string[];
  excludePaths?: string[];
  wipeExisting?: boolean;
}): Promise<{
  success: boolean;
  error?: string;
  manifest?: {
    remoteFilesCount: number;
    remoteTotalBytes: number;
    sampleRemoteFiles: string[];
    localFilesCount: number;
    localTotalBytes: number;
    overwrittenFiles: string[];
    preservedFiles: string[];
    deletedFiles: string[];
    excludedFiles: string[];
  };
}> {
  let clientConn: SshClient | null = null;
  try {
    const { conn, sftp } = await connectSftp(params.config);
    clientConn = conn;
    const remoteRoot = params.config.remotePath?.trim() || "/";
    const excludeList = params.excludePaths || ["logs", "backups", ".cache", "crash-reports"];
    const preserveList = params.preservePaths || ["world", "plugins", "config", "server.properties"];
    const wipeExisting = params.wipeExisting ?? true;

    // Scan remote directory tree
    const remoteFiles: { path: string; size: number }[] = [];
    const excludedFiles: string[] = [];

    async function scanRemote(dirPath: string, relBase = ""): Promise<void> {
      return new Promise((resolve, reject) => {
        sftp.readdir(dirPath, async (err, list) => {
          if (err) return reject(err);
          for (const item of list || []) {
            if (item.filename === "." || item.filename === "..") continue;
            const relPath = relBase ? `${relBase}/${item.filename}` : item.filename;
            const fullItemPath = dirPath.endsWith("/") ? `${dirPath}${item.filename}` : `${dirPath}/${item.filename}`;

            if (isPathExcluded(relPath, excludeList)) {
              excludedFiles.push(relPath);
              continue;
            }

            if (isDirectoryEntry(item)) {
              // Recurse directory
              try {
                await scanRemote(fullItemPath, relPath);
              } catch {
                // Ignore subfolder permission errors
              }
            } else {
              remoteFiles.push({ path: relPath, size: item.attrs?.size || 0 });
            }
          }
          resolve();
        });
      });
    }

    await scanRemote(remoteRoot);
    try { clientConn.end(); } catch {}

    // Scan local directory
    const serverDir = getServerDir(params.serverId);
    const localFiles: { path: string; size: number }[] = [];

    async function scanLocal(dir: string, relBase = ""): Promise<void> {
      if (!fsSync.existsSync(dir)) return;
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scanLocal(fullPath, relPath);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          localFiles.push({ path: relPath, size: stats.size });
        }
      }
    }

    await scanLocal(serverDir);

    const remotePathSet = new Set(remoteFiles.map(f => f.path.toLowerCase().replace(/\\/g, "/")));
    const overwrittenFiles: string[] = [];
    const preservedFiles: string[] = [];
    const deletedFiles: string[] = [];

    for (const lf of localFiles) {
      const normLocal = lf.path.toLowerCase().replace(/\\/g, "/");
      const isRemoteMatch = remotePathSet.has(normLocal);
      const isPreserved = isPathPreserved(lf.path, preserveList);

      if (isPreserved) {
        preservedFiles.push(lf.path);
      } else if (isRemoteMatch) {
        overwrittenFiles.push(lf.path);
      } else if (wipeExisting) {
        deletedFiles.push(lf.path);
      }
    }

    const remoteTotalBytes = remoteFiles.reduce((acc, f) => acc + f.size, 0);
    const localTotalBytes = localFiles.reduce((acc, f) => acc + f.size, 0);

    return {
      success: true,
      manifest: {
        remoteFilesCount: remoteFiles.length,
        remoteTotalBytes,
        sampleRemoteFiles: remoteFiles.slice(0, 30).map(f => f.path),
        localFilesCount: localFiles.length,
        localTotalBytes,
        overwrittenFiles: overwrittenFiles.slice(0, 100),
        preservedFiles: preservedFiles.slice(0, 100),
        deletedFiles: deletedFiles.slice(0, 100),
        excludedFiles: excludedFiles.slice(0, 50),
      },
    };
  } catch (error: any) {
    if (clientConn) {
      try { clientConn.end(); } catch {}
    }
    return {
      success: false,
      error: error.message || "Failed to scan remote SFTP directory.",
    };
  }
}

/**
 * Start asynchronous Pull operation from Remote SFTP.
 */
export function startPullJob(params: {
  serverId: string;
  config: SftpConnectionConfig;
  preservePaths?: string[];
  excludePaths?: string[];
  wipeExisting?: boolean;
}): { jobId: string } {
  const jobId = `pull_${crypto.randomUUID()}`;
  const job: SftpJob = {
    id: jobId,
    serverId: params.serverId,
    type: "pull",
    status: "running",
    progressPercent: 0,
    currentFile: "Connecting to remote SFTP...",
    transferredFiles: 0,
    totalFiles: 0,
    transferredBytes: 0,
    totalBytes: 0,
    logs: [],
    startedAt: Date.now(),
  };

  jobs.set(jobId, job);
  appendJobLog(job, `Initialized SFTP pull for server ${params.serverId}`);
  appendJobLog(job, `Remote Host: ${params.config.host}:${params.config.port || 22}, User: ${params.config.username}`);

  // Run async in background
  (async () => {
    let clientConn: SshClient | null = null;
    try {
      appendJobLog(job, "Connecting to remote SFTP host...");
      const { conn, sftp } = await connectSftp(params.config);
      clientConn = conn;
      appendJobLog(job, "Successfully authenticated with remote SFTP host.");

      const remoteRoot = params.config.remotePath?.trim() || "/";
      const excludeList = params.excludePaths || ["logs", "backups", ".cache", "crash-reports"];
      const preserveList = params.preservePaths || ["world", "plugins", "config", "server.properties"];
      const wipeExisting = params.wipeExisting ?? true;
      const serverDir = getServerDir(params.serverId);

      // 1. Gather all remote files
      appendJobLog(job, `Scanning remote files in '${remoteRoot}'...`);
      const remoteFiles: { fullPath: string; relPath: string; size: number }[] = [];

      async function scanRemote(dirPath: string, relBase = ""): Promise<void> {
        return new Promise((resolve, reject) => {
          sftp.readdir(dirPath, async (err, list) => {
            if (err) return reject(err);
            for (const item of list || []) {
              if (item.filename === "." || item.filename === "..") continue;
              const relPath = relBase ? `${relBase}/${item.filename}` : item.filename;
              const fullItemPath = dirPath.endsWith("/") ? `${dirPath}${item.filename}` : `${dirPath}/${item.filename}`;

              if (isPathExcluded(relPath, excludeList)) {
                continue;
              }

              if (isDirectoryEntry(item)) {
                try {
                  await scanRemote(fullItemPath, relPath);
                } catch {}
              } else {
                remoteFiles.push({ fullPath: fullItemPath, relPath, size: item.attrs?.size || 0 });
              }
            }
            resolve();
          });
        });
      }

      await scanRemote(remoteRoot);
      job.totalFiles = remoteFiles.length;
      job.totalBytes = remoteFiles.reduce((sum, f) => sum + f.size, 0);
      appendJobLog(job, `Found ${remoteFiles.length} files (${(job.totalBytes / (1024 * 1024)).toFixed(2)} MB) to pull.`);

      // 2. Wipe non-preserved local files if requested
      if (wipeExisting && fsSync.existsSync(serverDir)) {
        appendJobLog(job, "Cleaning existing local server directory (protecting preserved paths)...");
        async function cleanLocalDir(currentDir: string, relBase = "") {
          const entries = await fs.readdir(currentDir, { withFileTypes: true });
          for (const entry of entries) {
            const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
            const fullPath = path.join(currentDir, entry.name);

            if (isPathPreserved(relPath, preserveList)) {
              appendJobLog(job, `[Preserved] Keeping: ${relPath}`);
              continue;
            }

            if (entry.isDirectory()) {
              await cleanLocalDir(fullPath, relPath);
              // If directory is now empty, remove it
              try {
                const remaining = await fs.readdir(fullPath);
                if (remaining.length === 0) {
                  await fs.rm(fullPath, { recursive: true, force: true });
                }
              } catch {}
            } else {
              await fs.rm(fullPath, { force: true });
            }
          }
        }
        await cleanLocalDir(serverDir);
      }

      await fs.mkdir(serverDir, { recursive: true });

      // 3. Download files one by one with fastGet
      for (let i = 0; i < remoteFiles.length; i++) {
        const file = remoteFiles[i];
        job.currentFile = file.relPath;
        const localDest = path.join(serverDir, file.relPath);
        await fs.mkdir(path.dirname(localDest), { recursive: true });

        await new Promise<void>((resolve, reject) => {
          sftp.fastGet(file.fullPath, localDest, (err) => {
            if (err) {
              appendJobLog(job, `[Error] Failed to download ${file.relPath}: ${err.message}`);
              // Continue with next file rather than aborting entire pull
              return resolve();
            }
            job.transferredFiles++;
            job.transferredBytes += file.size;
            job.progressPercent = Math.min(99, Math.round((job.transferredFiles / job.totalFiles) * 100));
            if (i % 5 === 0 || i === remoteFiles.length - 1) {
              appendJobLog(job, `[Downloaded] ${file.relPath} (${(file.size / 1024).toFixed(1)} KB) [${job.transferredFiles}/${job.totalFiles}]`);
            }
            resolve();
          });
        });
      }

      job.progressPercent = 100;
      job.status = "completed";
      job.completedAt = Date.now();
      job.currentFile = "Pull completed successfully!";
      appendJobLog(job, `Server pull completed successfully! Transferred ${job.transferredFiles} files.`);
    } catch (error: any) {
      job.status = "failed";
      job.error = error.message || "Failed during server pull";
      appendJobLog(job, `[Fatal Error] ${job.error}`);
    } finally {
      if (clientConn) {
        try { clientConn.end(); } catch {}
      }
    }
  })();

  return { jobId };
}

/**
 * Start asynchronous Transfer/Export operation to Remote SFTP.
 */
export function startTransferJob(params: {
  serverId: string;
  config: SftpConnectionConfig;
  excludePaths?: string[];
}): { jobId: string } {
  const jobId = `xfer_${crypto.randomUUID()}`;
  const job: SftpJob = {
    id: jobId,
    serverId: params.serverId,
    type: "transfer",
    status: "running",
    progressPercent: 0,
    currentFile: "Connecting to target SFTP...",
    transferredFiles: 0,
    totalFiles: 0,
    transferredBytes: 0,
    totalBytes: 0,
    logs: [],
    startedAt: Date.now(),
  };

  jobs.set(jobId, job);
  appendJobLog(job, `Initialized SFTP export for server ${params.serverId}`);
  appendJobLog(job, `Target Host: ${params.config.host}:${params.config.port || 22}, Path: ${params.config.remotePath || "/"}`);

  (async () => {
    let clientConn: SshClient | null = null;
    try {
      appendJobLog(job, "Connecting to target SFTP host...");
      const { conn, sftp } = await connectSftp(params.config);
      clientConn = conn;
      appendJobLog(job, "Successfully authenticated with target SFTP host.");

      const remoteRoot = (params.config.remotePath?.trim() || "/").replace(/\\/g, "/");
      const excludeList = params.excludePaths || ["logs", "backups", ".cache", "crash-reports"];
      const serverDir = getServerDir(params.serverId);

      if (!fsSync.existsSync(serverDir)) {
        throw new Error("Server directory does not exist on this node.");
      }

      // 1. Scan local files
      appendJobLog(job, "Scanning local server files...");
      const localFiles: { fullPath: string; relPath: string; size: number }[] = [];

      async function scanLocal(dir: string, relBase = "") {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
          const fullPath = path.join(dir, entry.name);

          if (isPathExcluded(relPath, excludeList)) {
            continue;
          }

          if (entry.isDirectory()) {
            await scanLocal(fullPath, relPath);
          } else if (entry.isFile()) {
            const stats = await fs.stat(fullPath);
            localFiles.push({ fullPath, relPath, size: stats.size });
          }
        }
      }

      await scanLocal(serverDir);
      job.totalFiles = localFiles.length;
      job.totalBytes = localFiles.reduce((acc, f) => acc + f.size, 0);
      appendJobLog(job, `Found ${localFiles.length} files (${(job.totalBytes / (1024 * 1024)).toFixed(2)} MB) to transfer.`);

      // Helper to ensure remote directory path exists
      const createdRemoteDirs = new Set<string>();
      async function ensureRemoteDir(dirPath: string): Promise<void> {
        const normalized = dirPath.replace(/\\/g, "/").replace(/\/+$/, "");
        if (!normalized || normalized === "/" || normalized === "." || createdRemoteDirs.has(normalized)) return;

        const parts = normalized.split("/").filter(Boolean);
        let current = normalized.startsWith("/") ? "" : ".";

        for (const part of parts) {
          current = current === "" ? `/${part}` : `${current}/${part}`;
          if (createdRemoteDirs.has(current)) continue;

          await new Promise<void>((resolve) => {
            sftp.stat(current, (err) => {
              if (err) {
                sftp.mkdir(current, () => {
                  createdRemoteDirs.add(current);
                  resolve();
                });
              } else {
                createdRemoteDirs.add(current);
                resolve();
              }
            });
          });
        }
      }

      await ensureRemoteDir(remoteRoot);

      // 2. Upload files one by one with fastPut
      for (let i = 0; i < localFiles.length; i++) {
        const file = localFiles[i];
        job.currentFile = file.relPath;

        const targetRemoteFile = remoteRoot.endsWith("/")
          ? `${remoteRoot}${file.relPath.replace(/\\/g, "/")}`
          : `${remoteRoot}/${file.relPath.replace(/\\/g, "/")}`;

        const remoteDirName = path.posix.dirname(targetRemoteFile);
        await ensureRemoteDir(remoteDirName);

        await new Promise<void>((resolve) => {
          sftp.fastPut(file.fullPath, targetRemoteFile, (err) => {
            if (err) {
              appendJobLog(job, `[Error] Failed to upload ${file.relPath}: ${err.message}`);
              return resolve();
            }
            job.transferredFiles++;
            job.transferredBytes += file.size;
            job.progressPercent = Math.min(99, Math.round((job.transferredFiles / job.totalFiles) * 100));
            if (i % 5 === 0 || i === localFiles.length - 1) {
              appendJobLog(job, `[Uploaded] ${file.relPath} (${(file.size / 1024).toFixed(1)} KB) [${job.transferredFiles}/${job.totalFiles}]`);
            }
            resolve();
          });
        });
      }

      job.progressPercent = 100;
      job.status = "completed";
      job.completedAt = Date.now();
      job.currentFile = "Transfer completed successfully!";
      appendJobLog(job, `Server transfer completed successfully! Uploaded ${job.transferredFiles} files to remote SFTP host.`);
    } catch (error: any) {
      job.status = "failed";
      job.error = error.message || "Failed during server transfer";
      appendJobLog(job, `[Fatal Error] ${job.error}`);
    } finally {
      if (clientConn) {
        try { clientConn.end(); } catch {}
      }
    }
  })();

  return { jobId };
}

/**
 * Get job status and log slice.
 */
export function getJobStatus(jobId: string): SftpJob | null {
  return jobs.get(jobId) || null;
}
