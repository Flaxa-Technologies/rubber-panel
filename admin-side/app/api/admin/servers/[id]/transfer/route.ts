import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { getNodeBaseUrl, sendNodeCommand } from "@/lib/node-client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [server, activeTransfer, allNodes] = await Promise.all([
      db.server.findUnique({
        where: { id },
        include: {
          node: true,
          allocations: true,
        },
      }),
      db.serverTransfer.findFirst({
        where: { serverId: id },
        orderBy: { createdAt: "desc" },
        include: {
          sourceNode: { select: { id: true, name: true, fqdn: true, location: true } },
          targetNode: { select: { id: true, name: true, fqdn: true, location: true } },
        },
      }),
      db.node.findMany({
        where: { maintenanceMode: false },
        select: {
          id: true,
          name: true,
          fqdn: true,
          port: true,
          location: true,
          status: true,
          maxRam: true,
          maxDisk: true,
          ramUsage: true,
          diskUsage: true,
          cpuUsage: true,
          allocations: {
            where: { assigned: false, disabled: false },
            select: { id: true, ip: true, port: true, alias: true },
          },
        },
      }),
    ]);

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    return NextResponse.json({
      server: {
        id: server.id,
        name: server.name,
        nodeId: server.nodeId,
        nodeName: server.node.name,
        status: server.status,
        ram: server.ram,
        disk: server.disk,
        allowNodeTransfer: server.allowNodeTransfer,
        allocations: server.allocations,
      },
      activeTransfer,
      availableNodes: allNodes,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load transfer details" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const {
    targetNodeId,
    targetAllocationId,
    excludePaths = ["logs", "backups", ".cache"],
    preTransferStop = true,
    autoStartAfter = true,
    deleteSourceFiles = true,
  } = body;

  if (!targetNodeId) {
    return NextResponse.json({ error: "Target node ID is required" }, { status: 400 });
  }

  try {
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

    if (server.nodeId === targetNodeId) {
      return NextResponse.json({ error: "Target node must be different from current source node" }, { status: 400 });
    }

    const targetNode = await db.node.findUnique({
      where: { id: targetNodeId },
      include: {
        allocations: {
          where: { assigned: false, disabled: false },
          orderBy: { port: "asc" },
        },
      },
    });

    if (!targetNode) {
      return NextResponse.json({ error: "Target node not found" }, { status: 404 });
    }

    let finalAllocation = targetNode.allocations.find((a) => a.id === targetAllocationId);
    if (!finalAllocation && targetNode.allocations.length > 0) {
      finalAllocation = targetNode.allocations[0];
    }

    if (!finalAllocation) {
      return NextResponse.json({
        error: `Target node "${targetNode.name}" has no available port allocations. Please create allocations on the node first.`,
      }, { status: 400 });
    }

    // Immediately LOCK the server in the database
    await db.server.update({
      where: { id },
      data: { status: "TRANSFERRING" },
    });

    // Create Transfer tracking record
    const transferRecord = await db.serverTransfer.create({
      data: {
        serverId: id,
        sourceNodeId: server.nodeId,
        targetNodeId: targetNode.id,
        targetAllocationId: finalAllocation.id,
        status: "PREPARING",
        progress: 10,
        currentStep: "Server locked. Preparing transfer pipeline...",
        options: JSON.stringify({
          excludePaths,
          preTransferStop,
          autoStartAfter,
          deleteSourceFiles,
        }),
        initiatedBy: user.id || "ADMIN",
      },
    });

    // Run Migration Pipeline Asynchronously
    (async () => {
      try {
        const sourceBaseUrl = getNodeBaseUrl(server.node);
        const targetBaseUrl = getNodeBaseUrl(targetNode);

        // Step 1: Pre-transfer server stop
        if (preTransferStop && server.status === "RUNNING") {
          await db.serverTransfer.update({
            where: { id: transferRecord.id },
            data: {
              progress: 15,
              currentStep: "Gracefully stopping server on source node...",
            },
          });
          await sendNodeCommand(server.nodeId, `/api/agent/servers/${id}/power`, "POST", { action: "stop", waitSeconds: 5 }).catch(() => {});
        }

        // Step 2: Packaging Archive on Source Node
        await db.serverTransfer.update({
          where: { id: transferRecord.id },
          data: {
            status: "TRANSFERRING",
            progress: 30,
            currentStep: "Packaging files, world, and configuration on source node...",
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
            console.warn(`[AdminTransfer] Export attempt via ${url} failed:`, err);
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

        // Step 3: Prepare exact clone metadata with target allocation port
        let cleanEnv: Record<string, string> = {};
        if (typeof server.environment === "string") {
          try { cleanEnv = JSON.parse(server.environment); } catch {}
        } else if (server.environment && typeof server.environment === "object") {
          cleanEnv = { ...(server.environment as any) };
        }
        for (const k of Object.keys(cleanEnv)) {
          if (/^\d+$/.test(k)) delete cleanEnv[k];
        }
        cleanEnv.SERVER_PORT = String(finalAllocation.port);
        cleanEnv.PORT = String(finalAllocation.port);

        const serverMeta = {
          id: server.id,
          name: server.name,
          ram: server.ram,
          cpu: server.cpu,
          disk: server.disk,
          port: finalAllocation.port,
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
            currentStep: `Unpacking ${fileCount} files onto destination node (${targetNode.name})...`,
          },
        });

        // Step 4: Upload & Unpack onto target node
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
              const errJson = await res.json().catch(() => ({}));
              importErr = errJson.error || `HTTP ${res.status}`;
            }
          } catch (err: any) {
            importErr = err.message || "Connection failed";
          }
        }

        if (!importRes || !importRes.ok) {
          throw new Error(`Target node import failed: ${importErr || "Could not reach target node"}`);
        }

        // Step 5: Update Server Node and Allocations in Database
        await db.serverTransfer.update({
          where: { id: transferRecord.id },
          data: {
            status: "CONFIGURING",
            progress: 85,
            currentStep: "Updating server allocations and network database records...",
          },
        });

        await db.$transaction(async (tx) => {
          // Free current allocations
          await tx.allocation.updateMany({
            where: { serverId: server.id },
            data: { assigned: false, serverId: null },
          });
          // Assign target allocation
          await tx.allocation.update({
            where: { id: finalAllocation.id },
            data: { assigned: true, serverId: server.id },
          });
          // Update server nodeId
          await tx.server.update({
            where: { id: server.id },
            data: {
              nodeId: targetNode.id,
              status: "STOPPED",
              environment: JSON.stringify(cleanEnv),
            },
          });
        });

        // Step 6: Source files cleanup
        if (deleteSourceFiles) {
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
            } catch (cleanErr) {
              console.warn("[AdminTransfer] Source cleanup note:", cleanErr);
            }
          }
        }

        // Step 7: Auto-start on target node if requested
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
          } catch (startErr) {
            console.warn("[AdminTransfer] Target start note:", startErr);
          }
        }

        // Step 8: Mark Completed
        await db.serverTransfer.update({
          where: { id: transferRecord.id },
          data: {
            status: "COMPLETED",
            progress: 100,
            currentStep: "Migration completed successfully! Server is ready on new node.",
          },
        });
      } catch (err: any) {
        console.error("[AdminTransfer] Pipeline failed:", err);
        // Reset server status so it is not permanently locked
        await db.server.update({
          where: { id: server.id },
          data: { status: "STOPPED" },
        }).catch(() => {});

        await db.serverTransfer.update({
          where: { id: transferRecord.id },
          data: {
            status: "FAILED",
            error: err.message || "Transfer pipeline failed",
            currentStep: `Failed: ${err.message || "Unknown error"}`,
          },
        }).catch(() => {});
      }
    })();

    return NextResponse.json({
      success: true,
      transferId: transferRecord.id,
      message: "Node transfer pipeline initiated successfully. Server is locked until completion.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to initiate transfer" }, { status: 500 });
  }
}
