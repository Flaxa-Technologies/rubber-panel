import net from "net";
import http from "http";

// ─── MINECRAFT VARINT & PACKET PROTOCOL UTILITIES ─────────────────────────────

export function readVarInt(buffer: Buffer, offset = 0): { value: number; size: number } {
  let value = 0;
  let size = 0;
  let byte: number;
  do {
    if (offset + size >= buffer.length) {
      throw new Error("Buffer underflow reading VarInt");
    }
    byte = buffer.readUInt8(offset + size);
    value |= (byte & 0x7f) << (7 * size);
    size++;
    if (size > 5) throw new Error("VarInt too large");
  } while ((byte & 0x80) !== 0);
  return { value, size };
}

export function writeVarInt(value: number): Buffer {
  const bytes: number[] = [];
  let v = value;
  do {
    let temp = v & 0x7f;
    v >>>= 7;
    if (v !== 0) temp |= 0x80;
    bytes.push(temp);
  } while (v !== 0);
  return Buffer.from(bytes);
}

export function writeString(str: string): Buffer {
  const strBuf = Buffer.from(str, "utf-8");
  const lenBuf = writeVarInt(strBuf.length);
  return Buffer.concat([lenBuf, strBuf]);
}

export function createPacket(packetId: number, data: Buffer): Buffer {
  const idBuf = writeVarInt(packetId);
  const totalLen = idBuf.length + data.length;
  const lenBuf = writeVarInt(totalLen);
  return Buffer.concat([lenBuf, idBuf, data]);
}

// ─── MOTD & BRANDING FORMATTING ───────────────────────────────────────────────

export const DEFAULT_CRYO_MOTD = "§b⚡ Rubber Panel §8| §3💤 Server is in Cryo-Sleep\n§e§lClick to Connect & Auto-Wake Instance!";
export const DEFAULT_WAKE_MESSAGE = "§b⚡ §lRubber Panel §8— §3💤 §lCRYO-SLEEP WAKE-UP\n\n§a✓ Server wake sequence initiated!\n§7The instance is now booting from hibernation.\n\n§e§lPlease reconnect in 10-15 seconds! §r§8(0-RAM Power Savings)";

export interface CryoProxyOptions {
  serverId: string;
  serverName: string;
  port: number;
  serverType?: "MINECRAFT" | "NODEJS";
  motd?: string;
  wakeMessage?: string;
  onWake: (serverId: string, details: { player?: string; ip?: string; source: string }) => Promise<void> | void;
}

export interface ActiveWakeProxy {
  serverId: string;
  port: number;
  close: () => Promise<void>;
}

// Active proxies map: serverId -> ActiveWakeProxy
const activeProxies = new Map<string, ActiveWakeProxy>();

/**
 * Starts a lightweight native TCP wake proxy on the server's primary port.
 */
export function startWakeProxy(options: CryoProxyOptions): Promise<ActiveWakeProxy> {
  return new Promise(async (resolve, reject) => {
    const { serverId, serverName, port, serverType = "MINECRAFT", onWake } = options;

    // If an existing proxy for this server is already running on this port, return it
    const existing = activeProxies.get(serverId);
    if (existing) {
      if (existing.port === port) {
        return resolve(existing);
      }
      await existing.close().catch(() => {});
      activeProxies.delete(serverId);
    }

    const isNodeJs = serverType === "NODEJS";
    let isClosing = false;
    const sockets = new Set<net.Socket>();

    if (isNodeJs) {
      // ─── HTTP WAKE PROXY FOR NODE.JS APPS ─────────────────────────────────
      const server = http.createServer(async (req, res) => {
        if (isClosing) return;
        const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
        console.log(`[Cryo-Sleep:HTTP] Wake trigger from ${clientIp} for server "${serverName}" (${serverId})`);

        // Trigger wake sequence
        onWake(serverId, { ip: clientIp, source: "HTTP" });

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="6">
  <title>⚡ Waking from Cryo-Sleep — ${serverName}</title>
  <style>
    body {
      margin: 0; padding: 0; min-height: 100vh;
      background: radial-gradient(circle at center, #0f172a 0%, #020617 100%);
      font-family: system-ui, -apple-system, sans-serif;
      display: flex; align-items: center; justify-content: center; color: #f8fafc;
    }
    .box {
      background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(20px);
      border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 24px;
      padding: 40px; text-align: center; max-width: 480px; box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(56,189,248,0.2);
    }
    .spinner {
      width: 48px; height: 48px; border: 4px solid rgba(56, 189, 248, 0.2);
      border-top-color: #38bdf8; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 24px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 20px; font-weight: 700; margin: 0 0 10px; color: #ffffff; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 20px; }
    .pill { display: inline-block; padding: 4px 12px; background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.4); color: #38bdf8; border-radius: 999px; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="box">
    <div class="spinner"></div>
    <div class="pill">💤 CRYO-SLEEP AUTO-WAKE</div>
    <h1 style="margin-top: 16px;">Waking "${serverName}"...</h1>
    <p>This instance was sleeping to save resources. Rubber Panel has initiated the wake sequence. This page will reload automatically in a few seconds!</p>
  </div>
</body>
</html>
        `);
      });

      server.on("connection", (socket) => {
        sockets.add(socket);
        socket.on("close", () => sockets.delete(socket));
      });

      server.listen(port, "0.0.0.0", () => {
        console.log(`[Cryo-Sleep:Proxy] HTTP Wake Proxy active on port ${port} for "${serverName}" (${serverId})`);
        const proxyObj: ActiveWakeProxy = {
          serverId,
          port,
          close: () => new Promise<void>((res) => {
            isClosing = true;
            for (const s of sockets) {
              try { s.destroy(); } catch {}
            }
            sockets.clear();
            server.close(() => {
              console.log(`[Cryo-Sleep:Proxy] Released HTTP port ${port} for server ${serverId}`);
              res();
            });
            setTimeout(res, 200);
          }),
        };
        activeProxies.set(serverId, proxyObj);
        resolve(proxyObj);
      });

      server.on("error", (err) => {
        console.error(`[Cryo-Sleep:Proxy] Failed to bind HTTP proxy on port ${port}:`, err.message);
        reject(err);
      });
      return;
    }

    // ─── MINECRAFT TCP SLP & WAKE PROXY ───────────────────────────────────────
    const tcpServer = net.createServer((socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      let state: "HANDSHAKE" | "STATUS" | "LOGIN" = "HANDSHAKE";
      let clientProtocol = 767; // default modern MC 1.21

      socket.on("data", (data) => {
        if (isClosing) return;
        try {
          let offset = 0;
          while (offset < data.length) {
            const { value: packetLength, size: lenSize } = readVarInt(data, offset);
            offset += lenSize;
            if (offset >= data.length) break;

            const { value: packetId, size: idSize } = readVarInt(data, offset);
            offset += idSize;

            const packetData = data.subarray(offset, offset + packetLength - idSize);
            offset += packetLength - idSize;

            // 1. HANDSHAKE STATE
            if (state === "HANDSHAKE" && packetId === 0x00) {
              let pOffset = 0;
              const proto = readVarInt(packetData, pOffset);
              pOffset += proto.size;
              clientProtocol = proto.value;

              const hostLen = readVarInt(packetData, pOffset);
              pOffset += hostLen.size;
              const host = packetData.subarray(pOffset, pOffset + hostLen.value).toString("utf-8");
              pOffset += hostLen.value;

              // 2 bytes for port
              pOffset += 2;

              const nextState = readVarInt(packetData, pOffset).value;

              if (nextState === 1) {
                state = "STATUS";
              } else if (nextState === 2) {
                state = "LOGIN";
              }
              continue;
            }

            // 2. STATUS STATE (Server List Ping)
            if (state === "STATUS") {
              if (packetId === 0x00) {
                // Status Request -> Send Status Response
                const customMotd = options.motd || DEFAULT_CRYO_MOTD;
                const statusJson = JSON.stringify({
                  version: {
                    name: "§b💤 Cryo-Sleep [Click to Wake]",
                    protocol: clientProtocol || 767,
                  },
                  players: {
                    max: 20,
                    online: 0,
                    sample: [
                      { name: "§e⚡ Rubber Panel Auto-Wake Proxy", id: "00000000-0000-0000-0000-000000000000" },
                      { name: "§7Connect to instantly wake server!", id: "00000000-0000-0000-0000-000000000001" },
                    ],
                  },
                  description: {
                    text: customMotd,
                  },
                });

                const responsePacket = createPacket(0x00, writeString(statusJson));
                socket.write(responsePacket);
              } else if (packetId === 0x01) {
                // Ping Request -> Echo Ping Response (8 bytes)
                const pongPacket = createPacket(0x01, packetData);
                socket.write(pongPacket);
                socket.end();
              }
              continue;
            }

            // 3. LOGIN STATE (Player Connecting to Wake Server!)
            if (state === "LOGIN" && packetId === 0x00) {
              // Login Start packet: extract username
              let playerName = "Player";
              try {
                const nameLen = readVarInt(packetData, 0);
                playerName = packetData.subarray(nameLen.size, nameLen.size + nameLen.value).toString("utf-8");
              } catch {}

              const clientIp = socket.remoteAddress || "unknown";
              console.log(`[Cryo-Sleep:Proxy] Auto-Wake triggered by player "${playerName}" (${clientIp}) on "${serverName}" (${serverId})`);

              // 1. Immediately fire wake trigger in background
              onWake(serverId, { player: playerName, ip: clientIp, source: "MINECRAFT_LOGIN" });

              // 2. Reply with Login Disconnect (Packet 0x00 in login state)
              const wakeKickMessage = options.wakeMessage || DEFAULT_WAKE_MESSAGE;
              const disconnectJson = JSON.stringify({ text: wakeKickMessage });
              const disconnectPacket = createPacket(0x00, writeString(disconnectJson));
              socket.write(disconnectPacket);

              // 3. Gracefully close socket
              setTimeout(() => {
                try { socket.end(); } catch {}
              }, 250);
              break;
            }
          }
        } catch (err: any) {
          // Ignore malformed probe packets
        }
      });

      socket.on("error", () => {});
    });

    tcpServer.listen(port, "0.0.0.0", () => {
      console.log(`[Cryo-Sleep:Proxy] Minecraft Wake Proxy active on port ${port} for "${serverName}" (${serverId})`);
      const proxyObj: ActiveWakeProxy = {
        serverId,
        port,
        close: () => new Promise<void>((res) => {
          isClosing = true;
          for (const s of sockets) {
            try { s.destroy(); } catch {}
          }
          sockets.clear();
          tcpServer.close(() => {
            console.log(`[Cryo-Sleep:Proxy] Released port ${port} for server ${serverId}`);
            res();
          });
          setTimeout(res, 200);
        }),
      };
      activeProxies.set(serverId, proxyObj);
      resolve(proxyObj);
    });

    tcpServer.on("error", (err) => {
      console.error(`[Cryo-Sleep:Proxy] Failed to bind TCP proxy on port ${port}:`, err.message);
      reject(err);
    });
  });
}

/**
 * Stops an active wake proxy for a server and releases its port.
 */
export async function stopWakeProxy(serverId: string): Promise<void> {
  const proxy = activeProxies.get(serverId);
  if (proxy) {
    await proxy.close();
    activeProxies.delete(serverId);
  }
}

/**
 * Checks if a wake proxy is currently running for a server.
 */
export function isWakeProxyRunning(serverId: string): boolean {
  return activeProxies.has(serverId);
}
