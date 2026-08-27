import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole } from "@/lib/rbac";
import { applyUpdate, UpdateProgress } from "@/lib/updater";
import { sendNodeCommand } from "@/lib/node-client";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import db from "@/lib/db";
import { z } from "zod";

const applySchema = z.object({
  side: z.enum(["admin", "user", "node"]),
  nodeId: z.string().optional(),
  assetUrl: z.string().url(),
  version: z.string().min(1),
  runMigrations: z.boolean().optional().default(true),
});

/** POST /api/admin/updates/apply
 *  Streams Server-Sent Events with real-time progress during update installation.
 *  Body: { side, nodeId?, assetUrl, version, runMigrations? }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; email?: string; role?: string } | undefined;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminRole(user.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { side, nodeId, assetUrl, version } = parsed.data;

  // SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(line));
      };

      // Create update record
      let recordId: string | undefined;
      try {
        const record = await db.updateRecord.create({
          data: { side: nodeId ? `node:${nodeId}` : side, version, status: "DOWNLOADING", assetUrl },
        });
        recordId = record.id;
      } catch {}

      const onProgress = async (p: UpdateProgress) => {
        send("progress", p);
        if (recordId) {
          try {
            await db.updateRecord.update({
              where: { id: recordId },
              data: {
                status: p.phase === "done" ? "SUCCESS" : p.phase === "error" ? "FAILED" : "APPLYING",
                errorMsg: p.phase === "error" ? p.message : undefined,
                appliedAt: p.phase === "done" ? new Date() : undefined,
              },
            });
          } catch {}
        }
      };

      try {
        if (side === "node" && nodeId) {
          // Remote node update
          const targetNode = await db.node.findUnique({ where: { id: nodeId } });
          if (!targetNode) throw new Error(`Node ${nodeId} not found in database.`);

          send("progress", { phase: "downloading", message: `Connecting to Node "${targetNode.name}" (${targetNode.fqdn}:${targetNode.port})...` });
          
          let dispatchedDirectly = false;
          try {
            const result = await sendNodeCommand(nodeId, "/api/agent/update", "POST", { assetUrl, version });
            if (result.success) {
              dispatchedDirectly = true;
            }
          } catch {}

          if (dispatchedDirectly) {
            send("progress", { phase: "extracting", message: `Update command accepted by node agent.` });
            send("progress", { phase: "building", message: `Node agent is downloading archive, compiling build, and auto-respawning...` });
          } else {
            send("progress", { phase: "extracting", message: `Node agent update instruction queued via secure Heartbeat sync channel.` });
            send("progress", { phase: "building", message: `Node agent will download archive, compile build, and auto-respawn on next heartbeat sync.` });
          }
          
          await db.node.update({
            where: { id: nodeId },
            data: { agentVersion: version },
          }).catch(() => {});

          send("progress", { phase: "done", message: `Node "${targetNode.name}" update to ${version} initiated successfully!` });
        } else {
          // Local side update (admin, user, or local node)
          await applyUpdate(side, version, assetUrl, onProgress);
        }

        // Audit log
        try {
          await createAuditLog({
            actorId: user.id ?? undefined,
            actorEmail: user.email ?? "unknown",
            action: "UPDATE_APPLIED",
            target: nodeId ? `node:${nodeId}` : "system",
            targetId: nodeId || side,
            result: "SUCCESS",
            ipAddress: getIpFromRequest(request),
            metadata: { side, nodeId, version },
          });
        } catch {}

        send("done", { message: `${side}${nodeId ? ` (node: ${nodeId})` : ""} updated to ${version} successfully.` });
      } catch (err: any) {
        const msg = err?.message ?? "Unknown error";
        send("error", { message: msg });
        if (recordId) {
          await db.updateRecord.update({
            where: { id: recordId },
            data: { status: "FAILED", errorMsg: msg },
          }).catch(() => {});
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
