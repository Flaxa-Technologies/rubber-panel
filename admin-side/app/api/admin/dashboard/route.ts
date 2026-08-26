import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";
import db from "@/lib/db";
import { isAdminRole } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = session.user as { id: string; email: string; role: string };
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });


  const [
    totalUsers, activeUsers, suspendedUsers,
    totalServers, runningServers, stoppedServers, suspendedServers,
    totalNodes, onlineNodes, offlineNodes,
    recentActivity,
    nodes,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { status: "ACTIVE" } }),
    db.user.count({ where: { status: "SUSPENDED" } }),
    db.server.count(),
    db.server.count({ where: { status: "RUNNING" } }),
    db.server.count({ where: { status: "STOPPED" } }),
    db.server.count({ where: { suspended: true } }),
    db.node.count(),
    db.node.count({ where: { status: "ONLINE" } }),
    db.node.count({ where: { status: "OFFLINE" } }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true, actorEmail: true, action: true, target: true,
        result: true, createdAt: true,
      },
    }),
    db.node.findMany({
      select: {
        cpuUsage: true, ramUsage: true, diskUsage: true, networkRx: true, networkTx: true,
      },
    }),
  ]);

  // Aggregate resource usage across all nodes
  const avgCpu = nodes.length > 0
    ? nodes.reduce((s, n) => s + (n.cpuUsage ?? 0), 0) / nodes.length
    : 0;
  const avgRam = nodes.length > 0
    ? nodes.reduce((s, n) => s + (n.ramUsage ?? 0), 0) / nodes.length
    : 0;
  const avgDisk = nodes.length > 0
    ? nodes.reduce((s, n) => s + (n.diskUsage ?? 0), 0) / nodes.length
    : 0;
  const totalNetRx = nodes.reduce((s, n) => s + (n.networkRx ?? 0), 0);
  const totalNetTx = nodes.reduce((s, n) => s + (n.networkTx ?? 0), 0);

  return NextResponse.json({
    users: { total: totalUsers, active: activeUsers, suspended: suspendedUsers },
    servers: { total: totalServers, running: runningServers, stopped: stoppedServers, suspended: suspendedServers },
    nodes: { total: totalNodes, online: onlineNodes, offline: offlineNodes },
    resources: { cpu: avgCpu, ram: avgRam, disk: avgDisk, networkRx: totalNetRx, networkTx: totalNetTx },
    recentActivity,
  });
}
