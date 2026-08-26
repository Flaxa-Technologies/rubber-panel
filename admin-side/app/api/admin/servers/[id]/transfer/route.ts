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
    throttleSpeedMbps = 0,
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

    if (server.nodeId === targetNodeId) {
      return NextResponse.json({ error: "Target node must be different from current source node" }, { status: 400 });
    }

    const targetNode = await db.node.findUnique({
      where: { id: targetNodeId },
    });

    if (!targetNode) {
      return NextResponse.json({ error: "Target node not found" }, { status: 404 });
    }

    // Create Transfer tracking record
    const transferRecord = await db.serverTransfer.create({
      data: {
        serverId: id,
        sourceNodeId: server.nodeId,
        targetNodeId: targetNode.id,
        targetAllocationId,
        status: "PREPARING",
        progress: 5,
        currentStep: "Initializing node transfer orchestrator",
        options: JSON.stringify({
          excludePaths,
          preTransferStop,
          autoStartAfter,
          deleteSourceFiles,
          throttleSpeedMbps,
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
              status: "PREPARING",
              progress: 15,
              currentStep: "Gracefully stopping server on source node",
            },
          });
          await sendNodeCommand(server.nodeId, `/api/agent/servers/${id}/power`, "POST", { action: "stop", waitSeconds: 5 });
        }

        // Step 2: Streaming Archive Export & Import
        await db.serverTransfer.update({
          where: { id: transferRecord.id },
          data: {
            status: "TRANSFERRING",
            progress: 35,
            currentStep: "Streaming server files and world archives between nodes",
          },
        });

        const importPayload = {
          sourceUrl: `${sourceBaseUrl}/api/agent/servers/${id}/transfer/export`,
          sourceToken: server.node.authToken,
          excludePaths,
          serverMeta: {
            id: server.id,
            name: server.name,
            ram: server.ram,
            cpu: server.cpu,
            disk: server.disk,
            startupCommand: server.startupCommand,
            environment: server.environment,
          },
        };

        const importRes = await fetch(`${targetBaseUrl}/api/agent/servers/${id}/transfer/import`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${targetNode.authToken}`,
            "X-Rubber-Panel": "admin",
          },
          body: JSON.stringify(importPayload),
        });

        if (!importRes.ok) {
          const errData = await importRes.json().catch(() => ({}));
          throw new Error(errData.error || `Target node import failed with HTTP ${importRes.status}`);
        }

        // Step 3: Update Server Node and Allocations in Database
        await db.serverTransfer.update({
          where: { id: transferRecord.id },
          data: {
            status: "CONFIGURING",
            progress: 75,
            currentStep: "Re-assigning node allocations and network routing",
          },
        });

        await db.$transaction(async (tx) => {
          // If target allocation provided, reassign
          if (targetAllocationId) {
            // Free current allocations
            await tx.allocation.updateMany({
              where: { serverId: server.id },
              data: { assigned: false, serverId: null },
            });
            // Assign target allocation
            await tx.allocation.update({
              where: { id: targetAllocationId },
              data: { assigned: true, serverId: server.id },
            });
          }

          // Update server nodeId
          await tx.server.update({
            where: { id: server.id },
            data: {
              nodeId: targetNode.id,
              status: "STOPPED",
            },
          });
        });

        // Step 4: Source files cleanup
        if (deleteSourceFiles) {
          await db.serverTransfer.update({
            where: { id: transferRecord.id },
            data: {
              progress: 85,
              currentStep: "Cleaning up source node container and archive",
            },
          });
          try {
            await fetch(`${sourceBaseUrl}/api/agent/servers/${id}/transfer/cleanup`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${server.node.authToken}`,
                "X-Rubber-Panel": "admin",
              },
            });
          } catch (cleanErr) {
            console.warn("[AdminTransfer] Source cleanup warning:", cleanErr);
          }
        }

        // Step 5: Auto-start on target node if requested
        if (autoStartAfter) {
          await db.serverTransfer.update({
            where: { id: transferRecord.id },
            data: {
              progress: 95,
              currentStep: "Booting container on destination node",
            },
          });
          try {
            await sendNodeCommand(targetNode.id, `/api/agent/servers/${id}/power`, "POST", { action: "start" });
          } catch (startErr) {
            console.warn("[AdminTransfer] Target start warning:", startErr);
          }
        }

        // Step 6: Mark Completed
        await db.serverTransfer.update({
          where: { id: transferRecord.id },
          data: {
            status: "COMPLETED",
            progress: 100,
            currentStep: "Migration completed successfully!",
          },
        });
      } catch (err: any) {
        console.error("[AdminTransfer] Pipeline failed:", err);
        await db.serverTransfer.update({
          where: { id: transferRecord.id },
          data: {
            status: "FAILED",
            error: err.message || "Transfer pipeline failed",
            currentStep: `Failed: ${err.message || "Unknown error"}`,
          },
        });
      }
    })();

    return NextResponse.json({
      success: true,
      transferId: transferRecord.id,
      message: "Node transfer pipeline initiated successfully",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to initiate transfer" }, { status: 500 });
  }
}
