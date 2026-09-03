import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole } from "@/lib/rbac";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import AdmZip from "adm-zip";

const TEMPLATES_DIR = path.join(process.cwd(), ".data", "templates");

const DEFAULT_POPULAR_TEMPLATES = [
  {
    name: "Survival SMP Pack",
    description: "Standard Survival Multiplayer setup with Paper, EssentialsX, LuckPerms, and Economy pre-configured.",
    category: "MINECRAFT",
    softwareName: "Paper",
    softwareType: "PAPER",
    version: "1.21.4",
    defaultRam: 2048,
    defaultCpu: 100,
    defaultDisk: 10240,
    dockerImage: "itzg/minecraft-server",
    tags: JSON.stringify(["SMP", "Economy", "PvE"]),
    isOfficial: true,
  },
  {
    name: "Creative Plots & WorldEdit",
    description: "Flat creative world with per-player plot claim protection, WorldEdit access, and spawn hub.",
    category: "MINECRAFT",
    softwareName: "Paper",
    softwareType: "PAPER",
    version: "1.21.4",
    defaultRam: 2048,
    defaultCpu: 100,
    defaultDisk: 5120,
    dockerImage: "itzg/minecraft-server",
    tags: JSON.stringify(["Creative", "Plots", "WorldEdit"]),
    isOfficial: true,
  },
  {
    name: "Velocity Proxy Hub",
    description: "Ultra-fast Velocity proxy router connecting multiple sub-servers into a unified network.",
    category: "MINECRAFT",
    softwareName: "Velocity",
    softwareType: "VELOCITY",
    version: "3.4.0",
    defaultRam: 512,
    defaultCpu: 50,
    defaultDisk: 2048,
    dockerImage: "itzg/minecraft-server",
    tags: JSON.stringify(["Proxy", "Network", "Hub"]),
    isOfficial: true,
  },
  {
    name: "Fabric Vanilla+",
    description: "Performance-focused Fabric setup with Lithium, FerriteCore, and server-side QoL mods.",
    category: "MINECRAFT",
    softwareName: "Fabric",
    softwareType: "FABRIC",
    version: "1.21.4",
    defaultRam: 2048,
    defaultCpu: 100,
    defaultDisk: 8192,
    dockerImage: "itzg/minecraft-server",
    tags: JSON.stringify(["Fabric", "Optimized", "Vanilla+"]),
    isOfficial: true,
  },
  {
    name: "Pumpkin Rust Cross-Play",
    description: "Native multithreaded Rust Minecraft server supporting both Java Edition and Bedrock Edition NetherNet.",
    category: "MINECRAFT",
    softwareName: "Pumpkin",
    softwareType: "PUMPKIN",
    version: "1.21.4",
    defaultRam: 1024,
    defaultCpu: 100,
    defaultDisk: 5120,
    dockerImage: "ubuntu:24.04",
    tags: JSON.stringify(["Rust", "Bedrock", "Java", "Pumpkin"]),
    isOfficial: true,
  },
];

async function ensureDefaultTemplates() {
  const count = await db.template.count();
  if (count === 0) {
    for (const t of DEFAULT_POPULAR_TEMPLATES) {
      await db.template.create({ data: t });
    }
  }
}

// GET /api/admin/templates — List all server templates
export async function GET() {
  const session = await getServerSession(authOptions);
  const actor = session?.user as { id: string; email: string; role: string } | undefined;
  if (!actor || !isAdminRole(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureDefaultTemplates();
  const templates = await db.template.findMany({
    orderBy: [{ isOfficial: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { servers: true } } },
  });

  return NextResponse.json({ templates });
}

// POST /api/admin/templates — Upload and register a new Minecraft Template .zip
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as { id: string; email: string; role: string } | undefined;
  if (!actor || !isAdminRole(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const name = (formData.get("name") as string || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }

    const description = (formData.get("description") as string || "").trim();
    const softwareName = (formData.get("softwareName") as string || "Paper").trim();
    const softwareType = (formData.get("softwareType") as string || softwareName.toUpperCase()).trim();
    const version = (formData.get("version") as string || "1.21.4").trim();
    const defaultRam = parseInt(formData.get("defaultRam") as string) || 2048;
    const defaultCpu = parseInt(formData.get("defaultCpu") as string) || 100;
    const defaultDisk = parseInt(formData.get("defaultDisk") as string) || 5120;
    const category = (formData.get("category") as string || "MINECRAFT").trim();

    const rawTags = (formData.get("tags") as string || "").split(",").map(t => t.trim()).filter(Boolean);
    const tags = JSON.stringify(rawTags);

    const file = formData.get("file") as File | null;
    let zipPath: string | null = null;
    let zipSize: number | null = null;
    let deletedConfigsCount = 0;

    if (file && file.size > 0) {
      if (!file.name.toLowerCase().endsWith(".zip")) {
        return NextResponse.json({ error: "Uploaded template must be a valid .zip file" }, { status: 400 });
      }

      await fs.mkdir(TEMPLATES_DIR, { recursive: true });
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Inspect and scrub root configs (server.properties, configuration.toml, config.toml)
      const zip = new AdmZip(buffer);
      const rootConfigsToScrub = [
        "server.properties",
        "configuration.toml",
        "config.toml",
        "pumpkin.toml",
        "Pumpkin.toml",
      ];

      for (const target of rootConfigsToScrub) {
        const entry = zip.getEntry(target);
        if (entry) {
          console.log(`[Templates] Scrubbing conflicting root config from zip: ${entry.entryName}`);
          zip.deleteFile(entry);
          deletedConfigsCount++;
        }
      }

      const tempId = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const savedFileName = `${tempId}.zip`;
      const outPath = path.join(TEMPLATES_DIR, savedFileName);

      zip.writeZip(outPath);
      const stat = await fs.stat(outPath);
      zipPath = savedFileName;
      zipSize = stat.size;
    }

    const template = await db.template.create({
      data: {
        name,
        description: description || null,
        category,
        softwareName,
        softwareType,
        version,
        defaultRam,
        defaultCpu,
        defaultDisk,
        dockerImage: softwareType === "PUMPKIN" ? "ubuntu:24.04" : "itzg/minecraft-server",
        zipPath,
        zipSize,
        tags,
        isOfficial: false,
      },
    });

    return NextResponse.json({
      success: true,
      template,
      sanitizedConfigsRemoved: deletedConfigsCount,
      message: `Template "${name}" created successfully! ${deletedConfigsCount > 0 ? `(Auto-sanitized ${deletedConfigsCount} root config file(s) for dynamic panel compatibility)` : ""}`,
    });
  } catch (err: any) {
    console.error("[Templates Error]:", err);
    return NextResponse.json({ error: err?.message || "Failed to create template" }, { status: 500 });
  }
}

// DELETE /api/admin/templates?id=<id> — Delete a template
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as { id: string; email: string; role: string } | undefined;
  if (!actor || !isAdminRole(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Template ID is required" }, { status: 400 });

  const tpl = await db.template.findUnique({ where: { id } });
  if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  if (tpl.zipPath) {
    const fullPath = path.join(TEMPLATES_DIR, tpl.zipPath);
    if (fsSync.existsSync(fullPath)) {
      try { await fs.unlink(fullPath); } catch {}
    }
  }

  await db.template.delete({ where: { id } });
  return NextResponse.json({ success: true, message: `Template "${tpl.name}" deleted` });
}
