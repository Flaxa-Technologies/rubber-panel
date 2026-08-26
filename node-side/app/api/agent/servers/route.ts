import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken } from "@/lib/auth";
import { getAllServers, createServer } from "@/lib/server-manager";
import { z } from "zod";

const createSchema = z.object({
  id: z.string(),
  name: z.string(),
  ram: z.number().int().min(128),
  cpu: z.number().int().min(1).max(400),
  disk: z.number().int().min(512),
  port: z.number().int().optional(),
  softwareVersion: z.string().optional(),
  startupCommand: z.string().optional(),
  environment: z.record(z.string(), z.string()).optional(),
});

// GET /api/agent/servers — List all servers on this node
export async function GET(request: NextRequest) {
  if (!verifyAgentToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const servers = await getAllServers();
  return NextResponse.json({ servers });
}

// POST /api/agent/servers — Create a server on this node
export async function POST(request: NextRequest) {
  if (!verifyAgentToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await createServer(parsed.data);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
