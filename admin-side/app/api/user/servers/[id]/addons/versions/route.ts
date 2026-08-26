import { NextRequest, NextResponse } from "next/server";
import { verifyServerAccess } from "@/lib/permissions";

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

    const access = await verifyServerAccess(id, userId, "file.read");
    if (!access.allowed) {
      return NextResponse.json({ error: access.error || "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") || searchParams.get("slug");
    const loader = searchParams.get("loader") || "";
    const gameVersion = searchParams.get("gameVersion") || "";

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId or slug parameter" }, { status: 400 });
    }

    // Try fetching with filters first
    let url = `https://api.modrinth.com/v2/project/${encodeURIComponent(projectId)}/version`;
    const paramsList = new URLSearchParams();
    if (loader) {
      paramsList.set("loaders", JSON.stringify([loader.toLowerCase()]));
    }
    if (gameVersion) {
      paramsList.set("game_versions", JSON.stringify([gameVersion]));
    }

    const filteredUrl = paramsList.toString() ? `${url}?${paramsList.toString()}` : url;

    let response = await fetch(filteredUrl, {
      headers: {
        "User-Agent": "RubberPanel/1.0 (admin@rubberlab.net)",
        "Accept": "application/json",
      },
    });

    let versions: any[] = [];
    if (response.ok) {
      versions = await response.json();
    }

    // Fallback: If 0 versions found with strict filters, fetch all versions
    if (!response.ok || !Array.isArray(versions) || versions.length === 0) {
      const fallbackResponse = await fetch(url, {
        headers: {
          "User-Agent": "RubberPanel/1.0 (admin@rubberlab.net)",
          "Accept": "application/json",
        },
      });

      if (fallbackResponse.ok) {
        const allVersions = await fallbackResponse.json();
        if (Array.isArray(allVersions)) {
          versions = allVersions;
        }
      }
    }

    return NextResponse.json({ versions: Array.isArray(versions) ? versions : [] });
  } catch (err: any) {
    console.error("[ModrinthVersions] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch project versions", versions: [] }, { status: 500 });
  }
}
