import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import { isAdminRole } from "@/lib/rbac";
import { getPumpkinCatalog, syncPumpkinReleases } from "@/lib/pumpkin-service";

// GET /api/admin/software/pumpkin — Get Pumpkin build catalog and fleet sync matrix
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const actor = session?.user as { id: string; email: string; role: string } | undefined;
  if (!actor || !isAdminRole(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const autoCheck = searchParams.get("check") === "true";

  try {
    if (autoCheck) {
      await syncPumpkinReleases();
    }
    const catalog = await getPumpkinCatalog();
    return NextResponse.json(catalog);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load Pumpkin catalog" }, { status: 500 });
  }
}
