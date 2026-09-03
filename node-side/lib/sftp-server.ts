import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import crypto from "crypto";
import { Server as SshServer, ServerChannel } from "ssh2";
import { getServerDir } from "./server-manager";

const ADMIN_API_URL = (process.env.ADMIN_API_URL || "http://localhost:3000").replace(/\/$/, "");
const NODE_TOKEN = process.env.NODE_TOKEN || "";
const SFTP_PORT = parseInt(process.env.SFTP_PORT || "2022", 10);
const HOST_KEY_PATH = path.join(process.cwd(), ".data", "sftp_host_key");

// SFTP Protocol Status Codes
const SFTP_STATUS = {
  OK: 0,
  EOF: 1,
  NO_SUCH_FILE: 2,
  PERMISSION_DENIED: 3,
  FAILURE: 4,
  BAD_MESSAGE: 5,
  NO_CONNECTION: 6,
  CONNECTION_LOST: 7,
  OP_UNSUPPORTED: 8,
};

// SFTP Open Flags
const OPEN_MODE = {
  READ: 0x00000001,
  WRITE: 0x00000002,
  APPEND: 0x00000004,
  CREAT: 0x00000008,
  TRUNC: 0x00000010,
  EXCL: 0x00000020,
};

interface AuthenticatedSession {
  serverId: string;
  serverUuid: string;
  serverName: string;
  username: string;
  allowedPaths: string[];
  protectedPaths: string[];
}

function ensureHostKey(): string {
  const dataDir = path.join(process.cwd(), ".data");
  if (!fsSync.existsSync(dataDir)) {
    fsSync.mkdirSync(dataDir, { recursive: true });
  }

  if (fsSync.existsSync(HOST_KEY_PATH)) {
    try {
      return fsSync.readFileSync(HOST_KEY_PATH, "utf-8");
    } catch {}
  }

  console.log("[SFTP Server] Generating new RSA 2048 host private key...");
  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "pkcs1", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
  });

  fsSync.writeFileSync(HOST_KEY_PATH, privateKey, { mode: 0o600 });
  return privateKey;
}

async function authenticateClient(username: string, password: string): Promise<AuthenticatedSession | null> {
  try {
    const res = await fetch(`${ADMIN_API_URL}/api/node/sftp/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-node-token": NODE_TOKEN,
      },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success || !data.serverId) return null;

    return {
      serverId: data.serverId,
      serverUuid: data.serverUuid,
      serverName: data.serverName,
      username: data.username,
      allowedPaths: data.allowedPaths || ["/"],
      protectedPaths: data.protectedPaths || [],
    };
  } catch (err: any) {
    console.error("[SFTP Server] Auth error:", err?.message);
    return null;
  }
}

function resolveSafePath(baseDir: string, reqPath: string): string | null {
  const clean = path.normalize("/" + reqPath).replace(/^(\.\.[\/\\])+/, "");
  const resolved = path.resolve(baseDir, "." + clean);

  // Security check: Must remain strictly inside baseDir
  if (!resolved.startsWith(baseDir)) {
    return null;
  }
  return resolved;
}

function isPathProtected(virtualPath: string, protectedPaths: string[]): boolean {
  const clean = path.normalize("/" + virtualPath).toLowerCase();
  for (const p of protectedPaths) {
    const protClean = path.normalize("/" + p).toLowerCase();
    if (clean === protClean || clean.startsWith(protClean + "/")) {
      return true;
    }
  }
  return false;
}

let sftpServerInstance: SshServer | null = null;

export function startSftpServer() {
  if (sftpServerInstance) return;

  const hostKey = ensureHostKey();

  const server = new SshServer({
    hostKeys: [hostKey],
  }, (client) => {
    let sessionAuth: AuthenticatedSession | null = null;

    client.on("authentication", async (ctx) => {
      if (ctx.method === "password") {
        const auth = await authenticateClient(ctx.username, ctx.password);
        if (auth) {
          sessionAuth = auth;
          console.log(`[SFTP Server] User '${auth.username}' authenticated for server '${auth.serverName}' (${auth.serverId})`);
          return ctx.accept();
        }
      }
      return ctx.reject(["password"]);
    });

    client.on("ready", () => {
      client.on("session", (accept, reject) => {
        const session = accept();

        session.on("sftp", (acceptSftp, rejectSftp) => {
          if (!sessionAuth) return rejectSftp();

          const sftpStream = acceptSftp();
          const serverDir = getServerDir(sessionAuth.serverId);
          const auth = sessionAuth;

          // Ensure server directory exists
          try {
            if (!fsSync.existsSync(serverDir)) {
              fsSync.mkdirSync(serverDir, { recursive: true });
            }
          } catch {}

          const openHandles = new Map<number, { fd?: number; dirEntries?: string[]; dirIndex?: number; isDir?: boolean; virtualPath?: string }>();
          let handleCounter = 0;

          // REALPATH — Resolve virtual path
          sftpStream.on("REALPATH", (reqid, reqPath) => {
            const normalized = path.normalize("/" + reqPath);
            sftpStream.name(reqid, [{ filename: normalized, longname: normalized, attrs: {} as any }]);
          });

          // STAT / LSTAT
          const handleStat = async (reqid: number, reqPath: string) => {
            const resolved = resolveSafePath(serverDir, reqPath);
            if (!resolved) return sftpStream.status(reqid, SFTP_STATUS.PERMISSION_DENIED);

            try {
              const stat = await fs.stat(resolved);
              sftpStream.attrs(reqid, stat as any);
            } catch {
              sftpStream.status(reqid, SFTP_STATUS.NO_SUCH_FILE);
            }
          };

          sftpStream.on("STAT", handleStat);
          sftpStream.on("LSTAT", handleStat);

          // OPENDIR
          sftpStream.on("OPENDIR", async (reqid, reqPath) => {
            const resolved = resolveSafePath(serverDir, reqPath);
            if (!resolved) return sftpStream.status(reqid, SFTP_STATUS.PERMISSION_DENIED);

            try {
              const entries = await fs.readdir(resolved);
              const handleId = ++handleCounter;
              const handleBuf = Buffer.alloc(4);
              handleBuf.writeUInt32BE(handleId, 0);

              openHandles.set(handleId, {
                isDir: true,
                dirEntries: entries,
                dirIndex: 0,
                virtualPath: reqPath,
              });

              sftpStream.handle(reqid, handleBuf);
            } catch {
              sftpStream.status(reqid, SFTP_STATUS.NO_SUCH_FILE);
            }
          });

          // READDIR
          sftpStream.on("READDIR", async (reqid, handle) => {
            const handleId = handle.readUInt32BE(0);
            const state = openHandles.get(handleId);
            if (!state || !state.isDir || !state.dirEntries) {
              return sftpStream.status(reqid, SFTP_STATUS.FAILURE);
            }

            const entries = state.dirEntries;
            const index = state.dirIndex || 0;

            if (index >= entries.length) {
              return sftpStream.status(reqid, SFTP_STATUS.EOF);
            }

            const batch = entries.slice(index, index + 32);
            state.dirIndex = index + batch.length;

            const resolvedDir = resolveSafePath(serverDir, state.virtualPath || "/") || serverDir;
            const fileList: any[] = [];

            for (const name of batch) {
              try {
                const fullPath = path.join(resolvedDir, name);
                const stat = await fs.stat(fullPath);
                const isDirectory = stat.isDirectory();
                const perms = (isDirectory ? "d" : "-") + "rw-r--r--";
                const size = stat.size;
                const mtime = stat.mtime.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                const longname = `${perms} 1 owner owner ${size.toString().padStart(8, " ")} ${mtime} ${name}`;

                fileList.push({
                  filename: name,
                  longname,
                  attrs: stat as any,
                });
              } catch {
                fileList.push({
                  filename: name,
                  longname: `-rw-r--r-- 1 owner owner 0 Jan 1 ${name}`,
                  attrs: {} as any,
                });
              }
            }

            sftpStream.name(reqid, fileList);
          });

          // OPEN File
          sftpStream.on("OPEN", (reqid, filename, flags, attrs) => {
            const resolved = resolveSafePath(serverDir, filename);
            if (!resolved) return sftpStream.status(reqid, SFTP_STATUS.PERMISSION_DENIED);

            const isWrite = Boolean(flags & (OPEN_MODE.WRITE | OPEN_MODE.APPEND | OPEN_MODE.CREAT | OPEN_MODE.TRUNC));
            if (isWrite && isPathProtected(filename, auth.protectedPaths)) {
              return sftpStream.status(reqid, SFTP_STATUS.PERMISSION_DENIED);
            }

            let nodeFlags = "r";
            if ((flags & OPEN_MODE.READ) && (flags & OPEN_MODE.WRITE)) nodeFlags = "r+";
            else if (flags & OPEN_MODE.WRITE) nodeFlags = "w";
            if (flags & OPEN_MODE.APPEND) nodeFlags = "a";
            if ((flags & OPEN_MODE.CREAT) && (flags & OPEN_MODE.WRITE)) nodeFlags = "w+";

            fsSync.open(resolved, nodeFlags, attrs.mode || 0o644, (err, fd) => {
              if (err) {
                if (err.code === "ENOENT") return sftpStream.status(reqid, SFTP_STATUS.NO_SUCH_FILE);
                if (err.code === "EACCES") return sftpStream.status(reqid, SFTP_STATUS.PERMISSION_DENIED);
                return sftpStream.status(reqid, SFTP_STATUS.FAILURE);
              }

              const handleId = ++handleCounter;
              const handleBuf = Buffer.alloc(4);
              handleBuf.writeUInt32BE(handleId, 0);

              openHandles.set(handleId, { fd, isDir: false, virtualPath: filename });
              sftpStream.handle(reqid, handleBuf);
            });
          });

          // READ File
          sftpStream.on("READ", (reqid, handle, offset, length) => {
            const handleId = handle.readUInt32BE(0);
            const state = openHandles.get(handleId);
            if (!state || state.fd === undefined) return sftpStream.status(reqid, SFTP_STATUS.FAILURE);

            const buffer = Buffer.alloc(length);
            fsSync.read(state.fd, buffer, 0, length, offset, (err, bytesRead) => {
              if (err) return sftpStream.status(reqid, SFTP_STATUS.FAILURE);
              if (bytesRead === 0) return sftpStream.status(reqid, SFTP_STATUS.EOF);

              sftpStream.data(reqid, buffer.subarray(0, bytesRead));
            });
          });

          // WRITE File
          sftpStream.on("WRITE", (reqid, handle, offset, data) => {
            const handleId = handle.readUInt32BE(0);
            const state = openHandles.get(handleId);
            if (!state || state.fd === undefined) return sftpStream.status(reqid, SFTP_STATUS.FAILURE);

            fsSync.write(state.fd, data, 0, data.length, offset, (err) => {
              if (err) return sftpStream.status(reqid, SFTP_STATUS.FAILURE);
              sftpStream.status(reqid, SFTP_STATUS.OK);
            });
          });

          // CLOSE
          sftpStream.on("CLOSE", (reqid, handle) => {
            const handleId = handle.readUInt32BE(0);
            const state = openHandles.get(handleId);
            if (state) {
              if (state.fd !== undefined) {
                try { fsSync.closeSync(state.fd); } catch {}
              }
              openHandles.delete(handleId);
            }
            sftpStream.status(reqid, SFTP_STATUS.OK);
          });

          // FSTAT
          sftpStream.on("FSTAT", (reqid, handle) => {
            const handleId = handle.readUInt32BE(0);
            const state = openHandles.get(handleId);
            if (!state || state.fd === undefined) return sftpStream.status(reqid, SFTP_STATUS.FAILURE);

            fsSync.fstat(state.fd, (err, stat) => {
              if (err) return sftpStream.status(reqid, SFTP_STATUS.FAILURE);
              sftpStream.attrs(reqid, stat as any);
            });
          });

          // SETSTAT / FSETSTAT
          sftpStream.on("SETSTAT", (reqid, reqPath, attrs) => {
            const resolved = resolveSafePath(serverDir, reqPath);
            if (!resolved) return sftpStream.status(reqid, SFTP_STATUS.PERMISSION_DENIED);

            if (attrs.mode !== undefined) {
              try {
                fsSync.chmodSync(resolved, attrs.mode);
              } catch {}
            }
            sftpStream.status(reqid, SFTP_STATUS.OK);
          });

          // REMOVE (UNLINK)
          sftpStream.on("REMOVE", async (reqid, reqPath) => {
            const resolved = resolveSafePath(serverDir, reqPath);
            if (!resolved) return sftpStream.status(reqid, SFTP_STATUS.PERMISSION_DENIED);
            if (isPathProtected(reqPath, auth.protectedPaths)) {
              return sftpStream.status(reqid, SFTP_STATUS.PERMISSION_DENIED);
            }

            try {
              await fs.unlink(resolved);
              sftpStream.status(reqid, SFTP_STATUS.OK);
            } catch (err: any) {
              sftpStream.status(reqid, err.code === "ENOENT" ? SFTP_STATUS.NO_SUCH_FILE : SFTP_STATUS.FAILURE);
            }
          });

          // RMDIR
          sftpStream.on("RMDIR", async (reqid, reqPath) => {
            const resolved = resolveSafePath(serverDir, reqPath);
            if (!resolved) return sftpStream.status(reqid, SFTP_STATUS.PERMISSION_DENIED);
            if (isPathProtected(reqPath, auth.protectedPaths)) {
              return sftpStream.status(reqid, SFTP_STATUS.PERMISSION_DENIED);
            }

            try {
              await fs.rm(resolved, { recursive: true, force: true });
              sftpStream.status(reqid, SFTP_STATUS.OK);
            } catch {
              sftpStream.status(reqid, SFTP_STATUS.FAILURE);
            }
          });

          // MKDIR
          sftpStream.on("MKDIR", async (reqid, reqPath) => {
            const resolved = resolveSafePath(serverDir, reqPath);
            if (!resolved) return sftpStream.status(reqid, SFTP_STATUS.PERMISSION_DENIED);

            try {
              await fs.mkdir(resolved, { recursive: true });
              sftpStream.status(reqid, SFTP_STATUS.OK);
            } catch {
              sftpStream.status(reqid, SFTP_STATUS.FAILURE);
            }
          });

          // RENAME
          sftpStream.on("RENAME", async (reqid, oldPath, newPath) => {
            const resolvedOld = resolveSafePath(serverDir, oldPath);
            const resolvedNew = resolveSafePath(serverDir, newPath);
            if (!resolvedOld || !resolvedNew) return sftpStream.status(reqid, SFTP_STATUS.PERMISSION_DENIED);
            if (isPathProtected(oldPath, auth.protectedPaths) || isPathProtected(newPath, auth.protectedPaths)) {
              return sftpStream.status(reqid, SFTP_STATUS.PERMISSION_DENIED);
            }

            try {
              await fs.rename(resolvedOld, resolvedNew);
              sftpStream.status(reqid, SFTP_STATUS.OK);
            } catch {
              sftpStream.status(reqid, SFTP_STATUS.FAILURE);
            }
          });
        });
      });
    });

    client.on("error", (err) => {
      // Clean error catch for dropped/aborted SSH clients
    });
  });

  server.listen(SFTP_PORT, "0.0.0.0", () => {
    console.log(`[SFTP Server] 🚀 SFTP file transfer daemon active on port ${SFTP_PORT} (0.0.0.0:${SFTP_PORT})`);
  });

  server.on("error", (err: any) => {
    console.error(`[SFTP Server] Failed to bind port ${SFTP_PORT}:`, err?.message);
  });

  sftpServerInstance = server;
}
