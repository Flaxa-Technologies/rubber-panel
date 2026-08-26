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
      },
      activeTransfer,
      availableNodes: allNodes.filter((n) => n.id !== server.nodeId),
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
          take: 1,
        },
      },
    });

    if (!targetNode || targetNode.maintenanceMode) {
      return NextResponse.json({ error: "Selected node is unavailable or under maintenance" }, { status: 400 });
    }

    const targetAllocation = targetNode.allocations[0];

    // Create Transfer Record
    const transferRecord = await db.serverTransfer.create({
      data: {
        serverId: id,
        sourceNodeId: server.nodeId,
        targetNodeId: targetNode.id,
        targetAllocationId: targetAllocation?.id || null,
        status: "PREPARING",
        progress: 5,
        currentStep: "Preparing node transfer pipeline",
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

        // 1. Stop server if running
        if (server.status === "RUNNING") {
          await db.serverTransfer.update({
            where: { id: transferRecord.id },
            data: {
              progress: 15,
              currentStep: "Stopping server safely on source node",
            },
          });
          await sendNodeCommand(server.nodeId, `/api/agent/servers/${id}/power`, "POST", { action: "stop", waitSeconds: 5 });
        }

        // 2. Export & Import
        await db.serverTransfer.update({
          where: { id: transferRecord.id },
          data: {
            status: "TRANSFERRING",
            progress: 40,
            currentStep: "Transferring world and server files to destination node",
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
          throw new Error(errData.error || `Target node import failed: status ${importRes.status}`);
        }

        // 3. Update Database
        await db.serverTransfer.update({
          where: { id: transferRecord.id },
          data: {
            status: "CONFIGURING",
            progress: 75,
            currentStep: "Updating server node routing and network allocation",
          },
        });

        await db.$transaction(async (tx) => {
          if (targetAllocation) {
            await tx.allocation.updateMany({
              where: { serverId: server.id },
              data: { assigned: false, serverId: null },
            });
            await tx.allocation.update({
              where: { id: targetAllocation.id },
              data: { assigned: true, serverId: server.id },
            });
          }

          await tx.server.update({
            where: { id: server.id },
            data: {
              nodeId: targetNode.id,
              status: "STOPPED",
            },
          });
        });

        // 4. Cleanup source files
        await db.serverTransfer.update({
          where: { id: transferRecord.id },
          data: {
            progress: 85,
            currentStep: "Cleaning up source node cache",
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
        } catch {}

        // 5. Auto-start if requested
        if (autoStartAfter) {
          await db.serverTransfer.update({
            where: { id: transferRecord.id },
            data: {
              progress: 95,
              currentStep: "Booting server on new node",
            },
          });
          try {
            await sendNodeCommand(targetNode.id, `/api/agent/servers/${id}/power`, "POST", { action: "start" });
          } catch {}
        }

        // 6. Complete
        await db.serverTransfer.update({
          where: { id: transferRecord.id },
          data: {
            status: "COMPLETED",
            progress: 100,
            currentStep: "Node transfer completed successfully!",
          },
        });
      } catch (err: any) {
        console.error("[UserTransfer] Pipeline error:", err);
        await db.serverTransfer.update({
          where: { id: transferRecord.id },
          data: {
            status: "FAILED",
            error: err.message || "Node transfer failed",
            currentStep: `Failed: ${err.message}`,
          },
        });
      }
    })();

    return NextResponse.json({
      success: true,
      transferId: transferRecord.id,
      message: "Transfer initiated successfully",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to start transfer" }, { status: 500 });
  }
}
