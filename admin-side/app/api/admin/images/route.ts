import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole } from "@/lib/rbac";
import db from "@/lib/db";
import { sendNodeCommand } from "@/lib/node-client";
import { createAuditLog, getIpFromRequest } from "@/lib/audit";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(2).max(100),
  category: z.enum(["RUNTIME", "DATABASE", "WEB", "GAME", "TOOL", "CUSTOM"]).or(z.string()).default("RUNTIME"),
  dockerImage: z.string().min(2).max(255),
  defaultPort: z.number().int().min(1).max(65535).default(8080),
  internalPort: z.number().int().min(1).max(65535).default(8080),
  defaultStartup: z.string().optional().nullable(),
  environment: z.string().default("{}"),
  description: z.string().optional().nullable(),
  icon: z.string().default("box"),
  nodeId: z.string().optional().nullable(),
  pullNow: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as { id: string; email: string; role: string } | undefined;
  if (!actor || !isAdminRole(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const nodeId = searchParams.get("nodeId");

  const where: any = {};
  if (category && category !== "ALL") where.category = category;
  if (nodeId && nodeId !== "ALL") {
    where.OR = [{ nodeId }, { nodeId: null }];
  }

  const images = await db.containerImage.findMany({
    where,
    orderBy: [{ isOfficial: "desc" }, { createdAt: "desc" }],
    include: {
      node: { select: { id: true, name: true, status: true } },
      _count: { select: { servers: true } },
    },
  });

  return NextResponse.json({ images });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as { id: string; email: string; role: string } | undefined;
  if (!actor || !isAdminRole(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const json = await request.json();
    const body = createSchema.parse(json);

    // Check if image exists on the same node scope to update or create
    let image = await db.containerImage.findFirst({
      where: {
        dockerImage: body.dockerImage,
        ...(body.nodeId ? { nodeId: body.nodeId } : {}),
      },
    });

    if (image) {
      image = await db.containerImage.update({
        where: { id: image.id },
        data: {
          name: body.name,
          category: body.category,
          defaultPort: body.defaultPort,
          internalPort: body.internalPort,
          defaultStartup: body.defaultStartup,
          environment: body.environment,
          description: body.description,
          icon: body.icon,
          nodeId: body.nodeId || null,
          isPulled: true,
          lastPulledAt: new Date(),
        },
        include: {
          node: { select: { id: true, name: true, status: true } },
        },
      });
    } else {
      image = await db.containerImage.create({
        data: {
          name: body.name,
          category: body.category,
          dockerImage: body.dockerImage,
          defaultPort: body.defaultPort,
          internalPort: body.internalPort,
          defaultStartup: body.defaultStartup,
          environment: body.environment,
          description: body.description,
          icon: body.icon,
          nodeId: body.nodeId || null,
          isOfficial: false,
          isPulled: true,
          lastPulledAt: new Date(),
        },
        include: {
          node: { select: { id: true, name: true, status: true } },
        },
      });
    }

    // If target node specified and pullNow requested, dispatch pull command
    if (body.pullNow && body.nodeId) {
      try {
        await sendNodeCommand(body.nodeId, "/api/agent/images/pull", "POST", {
          image: body.dockerImage,
          name: body.name,
        });
      } catch (err: any) {
        console.warn(`[ImagePull] Node pull notice for ${body.nodeId}:`, err?.message);
      }
    }

    await createAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "SETTINGS_CHANGED",
      target: image.name,
      targetId: image.id,
      ipAddress: getIpFromRequest(request),
      metadata: { dockerImage: image.dockerImage, category: image.category, nodeId: image.nodeId },
    });

    return NextResponse.json({ image }, { status: 201 });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues?.[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ error: err?.message || "Failed to create container image" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as { id: string; email: string; role: string } | undefined;
  if (!actor || !isAdminRole(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const dockerImage = searchParams.get("dockerImage");

  if (!id && !dockerImage) {
    return NextResponse.json({ error: "Image ID or dockerImage required" }, { status: 400 });
  }

  const image = id
    ? await db.containerImage.findUnique({ where: { id }, include: { _count: { select: { servers: true } } } })
    : await db.containerImage.findFirst({ where: { dockerImage: dockerImage! }, include: { _count: { select: { servers: true } } } });

  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  if (image._count.servers > 0) {
    return NextResponse.json({ error: `Cannot remove image: ${image._count.servers} active server(s) are using this image.` }, { status: 400 });
  }

  await db.containerImage.delete({ where: { id: image.id } });

  return NextResponse.json({ success: true, message: `Image "${image.name}" removed.` });
}
