import { NextRequest, NextResponse } from "next/server";
import { verifyServerAccess } from "@/lib/permissions";
import { getNodeBaseUrl, sendNodeCommand } from "@/lib/node-client";
import db from "@/lib/db";

function getAuthHeaders(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const userId = request.headers.get("x-user-id");
  return { internalSecret, expectedSecret, userId };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { internalSecret, expectedSecret, userId } = getAuthHeaders(req);

    if (!expectedSecret || internalSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

    const access = await verifyServerAccess(id, userId, "settings.view");
    if (!access.allowed) {
      return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
    }

    const [server, activeTransfer, allNodes] = await Promise.all([
      db.server.findUnique({
        where: { id },
        include: {
          node: { select: { id: true, name: true, location: true } },
          allocations: { select: { id: true, ip: true, port: true } },
        },
      }),
      db.serverTransfer.findFirst({
        where: { serverId: id },
        orderBy: { createdAt: "desc" },
        include: {
          sourceNode: { select: { id: true, name: true, location: true } },
          targetNode: { select: { id: true, name: true, location: true } },
        },
      }),
      db.node.findMany({
        where: { maintenanceMode: false, status: "ONLINE" },
        select: {
          id: true,
          name: true,
          location: true,
          status: true,
          allocations: {
            where: { assigned: false, disabled: false },
            select: { id: true, port: true },
          },
        },
      }),
    ]);

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    if (!server.allowNodeTransfer && !access.isAdmin) {
      return NextResponse.json({ error: "Node transfer is not enabled for this server instance" }, { status: 403 });
    }

    return NextResponse.json({
      server: {
        id: server.id,
        name: server.name,
        nodeId: server.nodeId,
        nodeName: server.node.name,
        status: server.status,
        allowNodeTransfer: server.allowNodeTransfer,
        allocations: server.allocations,
      },
      activeTransfer,
      availableNodes: allNodes
        .filter((n) => n.id !== server.nodeId)
        .map((n) => ({
          id: n.id,
          name: n.name,
          location: n.location,
          status: n.status,
          freeAllocations: n.allocations.length,
        })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load transfer options" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { internalSecret, expectedSecret, userId } = getAuthHeaders(req);

    if (!expectedSecret || internalSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!userId) return NextResponse.json({ error: "User ID required" }, { status: 400 });

    const access = await verifyServerAccess(id, userId, "settings.edit");
    if (!access.allowed) {
      return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
    }

    const server = await db.server.findUnique({
      where: { id },
      include: { node: true, allocations: true },
    });

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    if (server.status === "TRANSFERRING") {
      return NextResponse.json({ error: "A transfer is already actively in progress for this server instance." }, { status: 400 });
    }

    if (!server.allowNodeTransfer && !access.isAdmin) {
      return NextResponse.json({ error: "Node transfer is disabled by administration for this server." }, { status: 403 });
    }

    const body = await req.json();
    const {
      targetNodeId,
      excludePaths = ["logs", "backups", ".cache"],
      autoStartAfter = true,
    } = body;

    if (!targetNodeId) {
      return NextResponse.json({ error: "Destination node ID is required" }, { status: 400 });
    }

    if (server.nodeId === targetNodeId) {
      return NextResponse.json({ error: "Destination node must be different from current node" }, { status: 400 });
    }

    const targetNode = await db.node.findUnique({
      where: { id: targetNodeId },
      include: {
        allocations: {
          where: { assigned: false, disabled: false },
          orderBy: { port: "asc" },
          take: 1,
        },
      },
    });

    if (!targetNode || targetNode.maintenanceMode) {
      return NextResponse.json({ error: "Selected node is unavailable or under maintenance" }, { status: 400 });
    }

    const targetAllocation = targetNode.allocations[0];
    if (!targetAllocation) {
      return NextResponse.json({
        error: `Target node "${targetNode.name}" has no available port allocations. Please create free allocations on the target node before transferring.`,
      }, { status: 400 });
    }

    // Immediately LOCK the server in the database
    await db.server.update({
      where: { id },
      data: { status: "TRANSFERRING" },
    });

    // Create Transfer Record
    const transferRecord = await db.serverTransfer.create({
      data: {
        serverId: id,
        sourceNodeId: server.nodeId,
        targetNodeId: targetNode.id,
        targetAllocationId: targetAllocation.id,
        status: "PREPARING",
        progress: 10,
        currentStep: "Server locked. Preparing transfer pipeline...",
        options: JSON.stringify({
          excludePaths,
          autoStartAfter,
        }),
        initiatedBy: userId,
      },
    });

    // Run migration pipeline asynchronously
    (async () => {
      try {
        const sourceBaseUrl = getNodeBaseUrl(server.node);
        const targetBaseUrl = getNodeBaseUrl(targetNode);

        // 1. Stop server safely if running
        if (server.status === "RUNNING") {
          await db.serverTransfer.update({
            where: { id: transferRecord.id },
            data: {
              progress: 15,
              currentStep: "Stopping server safely on source node...",
            },
          });
          await sendNodeCommand(server.nodeId, `/api/agent/servers/${id}/power`, "POST", { action: "stop", waitSeconds: 5 }).catch(() => {});
        }

        // 2. Export archive from source node
        await db.serverTransfer.update({
          where: { id: transferRecord.id },
          data: {
            status: "TRANSFERRING",
            progress: 30,
            currentStep: "Packaging files, world, and plugins on source node...",
          },
        });

        const candidateExportUrls = Array.from(new Set([
          `${sourceBaseUrl}/api/agent/servers/${id}/transfer/export`,
          `http://127.0.0.1:${server.node.port}/api/agent/servers/${id}/transfer/export`,
          `http://localhost:${server.node.port}/api/agent/servers/${id}/transfer/export`,
        ]));

        let exportRes: Response | null = null;
        for (const url of candidateExportUrls) {
          try {
            const res = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${server.node.authToken}`,
                "X-Rubber-Panel": "admin",
              },
              body: JSON.stringify({ excludePaths }),
            });
            if (res.ok) {
              exportRes = res;
              break;
            }
          } catch (err) {
            console.warn(`[UserTransfer] Export via ${url} failed:`, err);
          }
        }

        if (!exportRes || !exportRes.ok) {
          throw new Error("Failed to export server archive from source node");
        }

        const fileCount = exportRes.headers.get("X-Transfer-Total-Files") || "0";
        const totalBytes = Number(exportRes.headers.get("X-Transfer-Total-Bytes") || 0);
        const mbStr = (totalBytes / (1024 * 1024)).toFixed(1);

        await db.serverTransfer.update({
          where: { id: transferRecord.id },
          data: {
            progress: 55,
            currentStep: `Packaged ${fileCount} files (${mbStr} MB). Streaming archive to target node (${targetNode.name})...`,
          },
        });

        const zipBuffer = await exportRes.arrayBuffer();

        // 3. Prepare exact clone metadata with target allocation port
        let cleanEnv: Record<string, string> = {};
        if (typeof server.environment === "string") {
          try { cleanEnv = JSON.parse(server.environment); } catch {}
        } else if (server.environment && typeof server.environment === "object") {
          cleanEnv = { ...(server.environment as any) };
        }
        for (const k of Object.keys(cleanEnv)) {
          if (/^\d+$/.test(k)) delete cleanEnv[k];
        }
        cleanEnv.SERVER_PORT = String(targetAllocation.port);
        cleanEnv.PORT = String(targetAllocation.port);

        const serverMeta = {
          id: server.id,
          name: server.name,
          ram: server.ram,
          cpu: server.cpu,
          disk: server.disk,
          port: targetAllocation.port,
          internalPort: server.internalPort,
          startupCommand: server.startupCommand,
          environment: cleanEnv,
          serverType: server.serverType,
          javaVersion: server.javaVersion,
          softwareVersion: server.softwareVersionId,
          cryoSleepEnabled: server.cryoSleepEnabled,
          cryoSleepIdleMinutes: server.cryoSleepIdleMinutes,
          cryoSleepMotd: server.cryoSleepMotd,
        };

        const metaBase64 = Buffer.from(JSON.stringify(serverMeta)).toString("base64");

        await db.serverTransfer.update({
          where: { id: transferRecord.id },
          data: {
            progress: 75,
            currentStep: `Unpacking ${fileCount} files on target node (${targetNode.name})...`,
          },
        });

        // 4. Upload & unpack onto target node
        const candidateImportUrls = Array.from(new Set([
          `${targetBaseUrl}/api/agent/servers/${id}/transfer/import?wipe=true`,
          `http://127.0.0.1:${targetNode.port}/api/agent/servers/${id}/transfer/import?wipe=true`,
          `http://localhost:${targetNode.port}/api/agent/servers/${id}/transfer/import?wipe=true`,
        ]));

        let importRes: Response | null = null;
        let importErr = "";
        for (const url of candidateImportUrls) {
          try {
            const res = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/zip",
                "X-Server-Meta": metaBase64,
                Authorization: `Bearer ${targetNode.authToken}`,
                "X-Rubber-Panel": "admin",
              },
              body: Buffer.from(zipBuffer),
            });
            if (res.ok) {
              importRes = res;
              break;
            } else {
              const errData = await res.json().catch(() => ({}));
              importErr = errData.error || `HTTP ${res.status}`;
            }
          } catch (err: any) {
            importErr = err.message || "Connection failed";
          }
        }

        if (!importRes || !importRes.ok) {
          throw new Error(`Target node import failed: ${importErr || "Could not reach target node"}`);
        }

        // 5. Update Database Transaction (Re-bind allocation and node)
        await db.serverTransfer.update({
          where: { id: transferRecord.id },
          data: {
            status: "CONFIGURING",
            progress: 85,
            currentStep: "Updating server network allocations and database records...",
          },
        });

        await db.$transaction(async (tx) => {
          await tx.allocation.updateMany({
            where: { serverId: server.id },
            data: { assigned: false, serverId: null },
          });
          await tx.allocation.update({
            where: { id: targetAllocation.id },
            data: { assigned: true, serverId: server.id },
          });
          await tx.server.update({
            where: { id: server.id },
            data: {
              nodeId: targetNode.id,
              status: "STOPPED",
              environment: JSON.stringify(cleanEnv),
            },
          });
        });

        // 6. Cleanup source node files
        await db.serverTransfer.update({
          where: { id: transferRecord.id },
          data: {
            progress: 90,
            currentStep: "Cleaning up source node cache...",
          },
        });
        for (const url of candidateExportUrls) {
          const cleanupUrl = url.replace("/transfer/export", "/transfer/cleanup");
          try {
            await fetch(cleanupUrl, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${server.node.authToken}`,
                "X-Rubber-Panel": "admin",
              },
            });
            break;
          } catch {}
        }

        // 7. Auto-start if requested
        if (autoStartAfter) {
          await db.serverTransfer.update({
            where: { id: transferRecord.id },
            data: {
              progress: 95,
              currentStep: "Booting container on destination node...",
            },
          });
          try {
            await sendNodeCommand(targetNode.id, `/api/agent/servers/${id}/power`, "POST", { action: "start" });
            await db.server.update({
              where: { id: server.id },
              data: { status: "RUNNING" },
            });
          } catch (bootErr) {
            console.warn("[UserTransfer] Auto-start note:", bootErr);
          }
        }

        // 8. Complete!
        await db.serverTransfer.update({
          where: { id: transferRecord.id },
          data: {
            status: "COMPLETED",
            progress: 100,
            currentStep: "Node transfer completed successfully! Server is ready.",
          },
        });
      } catch (err: any) {
        console.error("[UserTransfer] Pipeline error:", err);
        // Reset server status so it is not permanently locked
        await db.server.update({
          where: { id: server.id },
          data: { status: "STOPPED" },
        }).catch(() => {});

        await db.serverTransfer.update({
          where: { id: transferRecord.id },
          data: {
            status: "FAILED",
            error: err.message || "Node transfer failed",
            currentStep: `Failed: ${err.message}`,
          },
        }).catch(() => {});
      }
    })();

    return NextResponse.json({
      success: true,
      transferId: transferRecord.id,
      message: "Transfer initiated successfully. Server access is locked until migration completes.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to start transfer" }, { status: 500 });
  }
}
