import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { sendNodeCommand } from "@/lib/node-client";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

const scaleSchema = z.object({
  ram: z.number().int().min(512).max(524288), // MB
  cpu: z.number().int().min(25).max(6400),    // %
  disk: z.number().int().min(1024).max(10485760), // MB
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let userId: string | null = null;

  const internalSecret = req.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;

  if (internalSecret && internalSecret === expectedSecret) {
    const { searchParams } = new URL(req.url);
    userId = searchParams.get("userId");
  } else {
    const session = await getServerSession(authOptions);
    userId = (session?.user as any)?.id;
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = scaleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid scaling parameters", details: parsed.error.flatten() }, { status: 400 });
  }

  const { ram, cpu, disk } = parsed.data;

  try {
    const [server, user, quota] = await Promise.all([
      db.server.findUnique({
        where: { id },
        include: { node: true },
      }),
      db.user.findUnique({
        where: { id: userId },
        include: { servers: true },
      }),
      db.userResourceQuota.findUnique({
        where: { userId },
      }),
    ]);

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    if (server.ownerId !== userId && user?.role !== "SUPER_ADMIN" && user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: You do not own this server" }, { status: 403 });
    }

    if (!quota) {
      return NextResponse.json({ error: "No extra resource quota assigned to your account." }, { status: 403 });
    }

    if (quota.isSuspended) {
      return NextResponse.json({ error: "Your resource quota pool is suspended." }, { status: 403 });
    }

    if (quota.expiresAt && new Date(quota.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Your resource quota subscription has expired." }, { status: 403 });
    }

    // Calculate current extra quota in use by all other servers
    let otherUsedRam = 0;
    let otherUsedCpu = 0;
    let otherUsedDisk = 0;

    for (const s of (user?.servers || [])) {
      if (s.id === server.id) continue;
      if (s.isCreatedFromQuota) {
        otherUsedRam += s.ram;
        otherUsedCpu += s.cpu;
        otherUsedDisk += s.disk;
      } else {
        otherUsedRam += (s.extraRam || 0);
        otherUsedCpu += (s.extraCpu || 0);
        otherUsedDisk += (s.extraDisk || 0);
      }
    }

    let extraRam = 0;
    let extraCpu = 0;
    let extraDisk = 0;

    if (server.isCreatedFromQuota) {
      // Entire server is powered by quota
      extraRam = ram;
      extraCpu = cpu;
      extraDisk = disk;
    } else {
      // Server has base subscription resources + extra boost
      const baseRam = server.baseRam || 1024;
      const baseCpu = server.baseCpu || 100;
      const baseDisk = server.baseDisk || 5120;

      extraRam = Math.max(0, ram - baseRam);
      extraCpu = Math.max(0, cpu - baseCpu);
      extraDisk = Math.max(0, disk - baseDisk);
    }

    if (otherUsedRam + extraRam > quota.maxRam) {
      return NextResponse.json({
        error: `Insufficient Memory quota. Requested extra ${(extraRam / 1024).toFixed(1)} GB exceeds available ${((quota.maxRam - otherUsedRam) / 1024).toFixed(1)} GB.`,
      }, { status: 400 });
    }

    if (otherUsedCpu + extraCpu > quota.maxCpu) {
      return NextResponse.json({
        error: `Insufficient CPU quota. Requested extra ${extraCpu}% exceeds available ${(quota.maxCpu - otherUsedCpu)}%.`,
      }, { status: 400 });
    }

    if (otherUsedDisk + extraDisk > quota.maxDisk) {
      return NextResponse.json({
        error: `Insufficient Disk quota. Requested extra ${(extraDisk / 1024).toFixed(1)} GB exceeds available ${((quota.maxDisk - otherUsedDisk) / 1024).toFixed(1)} GB.`,
      }, { status: 400 });
    }

    // Update server in database
    const updatedServer = await db.server.update({
      where: { id },
      data: {
        ram,
        cpu,
        disk,
        extraRam,
        extraCpu,
        extraDisk,
      },
    });

    // Notify node daemon
    try {
      await sendNodeCommand(server.nodeId, `/api/agent/servers/${server.id}/power`, "POST", {
        action: "update_resources",
        ram,
        cpu,
        disk,
      });
    } catch {}

    await createAuditLog({
      actorId: userId,
      actorEmail: user?.email || "user",
      action: "SERVER_UPDATED" as any,
      target: server.name,
      targetId: server.id,
      metadata: {
        action: "RESOURCE_SCALED",
        oldResources: { ram: server.ram, cpu: server.cpu, disk: server.disk },
        newResources: { ram, cpu, disk, extraRam, extraCpu, extraDisk },
      },
    });

    return NextResponse.json({
      success: true,
      server: updatedServer,
      message: `Instance "${server.name}" scaled successfully to ${(ram / 1024).toFixed(1)} GB RAM, ${cpu}% CPU, and ${(disk / 1024).toFixed(1)} GB Disk.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to scale server resources" }, { status: 500 });
  }
}
