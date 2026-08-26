import { NextRequest, NextResponse } from "next/server";
import { verifyServerAccess } from "@/lib/permissions";

function getAuthHeaders(request: NextRequest) {
  const internalSecret = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET ?? process.env.NODE_WEBHOOK_SECRET;
  const userId = request.headers.get("x-user-id");
  return { internalSecret, expectedSecret, userId };
}

// Simple in-memory cache for Modrinth searches (60s TTL)
const searchCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60 * 1000;

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

    const access = await verifyServerAccess(id, userId, "file.read");
    if (!access.allowed) {
      return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";
    const projectType = searchParams.get("type") || "plugin"; // plugin | mod
    const loader = searchParams.get("loader") || ""; // paper, spigot, purpur, fabric, forge, etc.
    const gameVersion = searchParams.get("gameVersion") || ""; // 1.21.6, etc.
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const cacheKey = `${query}:${projectType}:${loader}:${gameVersion}:${limit}:${offset}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Build Modrinth facets
    const facetList: string[][] = [];
    if (projectType) {
      facetList.push([`project_type:${projectType}`]);
    }
    if (loader) {
      facetList.push([`categories:${loader}`]);
    }
    if (gameVersion) {
      facetList.push([`versions:${gameVersion}`]);
    }

    const modrinthUrl = new URL("https://api.modrinth.com/v2/search");
    if (query) modrinthUrl.searchParams.set("query", query);
    modrinthUrl.searchParams.set("limit", limit.toString());
    modrinthUrl.searchParams.set("offset", offset.toString());
    modrinthUrl.searchParams.set("index", "downloads"); // default sort by popularity
    if (facetList.length > 0) {
      modrinthUrl.searchParams.set("facets", JSON.stringify(facetList));
    }

    const response = await fetch(modrinthUrl.toString(), {
      headers: {
        "User-Agent": "RubberPanel/1.0 (contact@rubberpanel.io)",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Modrinth API responded with status ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    searchCache.set(cacheKey, { data, timestamp: Date.now() });

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to search Modrinth" }, { status: 500 });
  }
}
