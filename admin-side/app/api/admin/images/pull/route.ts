import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole } from "@/lib/rbac";
import db from "@/lib/db";
import { sendNodeCommand } from "@/lib/node-client";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { z } from "zod";

const pullSchema = z.object({
  imageId: z.string().optional(),
  dockerImage: z.string().optional(),
  nodeId: z.string().min(1, "Target Node ID is required"),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as { id: string; email: string; role: string } | undefined;
  if (!actor || !isAdminRole(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const json = await request.json();
    const body = pullSchema.parse(json);

    let targetImageTag = body.dockerImage;
    let imageName = "Custom Image";

    if (body.imageId) {
      const img = await db.containerImage.findUnique({ where: { id: body.imageId } });
      if (!img) {
        return NextResponse.json({ error: "Image definition not found" }, { status: 404 });
      }
      targetImageTag = img.dockerImage;
      imageName = img.name;
    }

    if (!targetImageTag) {
      return NextResponse.json({ error: "Docker image tag is required" }, { status: 400 });
    }

    const node = await db.node.findUnique({ where: { id: body.nodeId } });
    if (!node) {
      return NextResponse.json({ error: "Target Node not found" }, { status: 404 });
    }

    console.log(`[AdminImagePull] Dispatching pull command for "${targetImageTag}" to Node "${node.name}"...`);

    const result = await sendNodeCommand(node.id, "/api/agent/images/pull", "POST", {
      image: targetImageTag,
      name: imageName,
    });

    if (body.imageId) {
      await db.containerImage.update({
        where: { id: body.imageId },
        data: {
          isPulled: true,
          lastPulledAt: new Date(),
        },
      });
    }

    await createAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "SETTINGS_CHANGED",
      target: imageName,
      ipAddress: getIpFromRequest(request),
      metadata: { dockerImage: targetImageTag, nodeId: node.id, nodeName: node.name, result },
    });

    return NextResponse.json({
      success: true,
      message: `Image "${targetImageTag}" download/pull dispatched to Node "${node.name}"!`,
      node: { id: node.id, name: node.name },
      agentResponse: result,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues?.[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ error: err?.message || "Failed to trigger image pull" }, { status: 500 });
  }
}
