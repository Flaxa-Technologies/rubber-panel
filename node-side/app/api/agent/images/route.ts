import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken, unauthorizedResponse } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

const IMAGES_FILE = path.join(process.cwd(), ".data", "images.json");

async function getStoredImages() {
  try {
    const raw = await fs.readFile(IMAGES_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  if (!verifyAgentToken(request)) {
    return unauthorizedResponse();
  }

  const stored = await getStoredImages();
  let dockerImages: string[] = [];

  try {
    const { stdout } = await execAsync("docker images --format \"{{.Repository}}:{{.Tag}}\"");
    dockerImages = stdout
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);
  } catch {
    // Docker is offline or unavailable
  }

  return NextResponse.json({
    images: stored,
    dockerImages,
    nodeTime: new Date().toISOString(),
  });
}
