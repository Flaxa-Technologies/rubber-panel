import { NextRequest, NextResponse } from "next/server";

const ADMIN_API_URL = process.env.ADMIN_API_URL ?? "http://localhost:3000";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(`${ADMIN_API_URL}/api/user/software`, {
      headers: {
        "X-Internal-Secret": INTERNAL_SECRET,
      },
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load software" }, { status: 500 });
  }
}
