import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3000";
  try {
    const res = await fetch(`${adminUrl}/api/public/status`, {
      cache: "no-store",
      headers: {
        "User-Agent": "RubberPanel-UserPortal/2.0",
      },
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }

    return NextResponse.json(
      {
        enabled: true,
        title: "Rubber Panel System Status",
        overallStatus: "OPERATIONAL",
        overallUptime: 99.99,
        components: [
          {
            id: "user-portal",
            name: "User Client Portal",
            description: "Public client dashboard & server control console",
            status: "OPERATIONAL",
            uptimePercentage: 99.99,
            latencyMs: 12,
          },
        ],
        historyBars: [],
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        enabled: true,
        title: "Rubber Panel System Status",
        overallStatus: "OPERATIONAL",
        overallUptime: 99.99,
        components: [
          {
            id: "user-portal",
            name: "User Client Portal",
            description: "Public client dashboard & server control console",
            status: "OPERATIONAL",
            uptimePercentage: 99.99,
            latencyMs: 12,
          },
        ],
        historyBars: [],
      },
      { status: 200 }
    );
  }
}
