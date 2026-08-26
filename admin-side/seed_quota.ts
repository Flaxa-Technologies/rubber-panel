import db from "./lib/db";

async function main() {
  const user = await db.user.findFirst({
    where: { email: "me@prasadnaik.in" }
  });

  if (!user) {
    console.error("User me@prasadnaik.in not found!");
    return;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const quota = await db.userResourceQuota.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      name: "Enterprise Pro Pool",
      maxRam: 8192,       // 8GB RAM
      maxDisk: 51200,     // 50GB Disk
      maxCpu: 400,        // 400% CPU (4 Cores)
      maxServers: 3,      // 3 Server Slots
      maxAllocations: 5,  // 5 Port Allocations
      maxBackups: 5,      // 5 Backups
      allowServerCreation: true,
      expiresAt,
      gracePeriodDays: 3,
      onExpireAction: "SUSPEND_SERVERS",
      notes: "Configured with 8GB RAM, 50GB Disk, 400% CPU, 3 Server Slots, 5 Ports, 30d expiry, 3d grace",
    },
    update: {
      name: "Enterprise Pro Pool",
      maxRam: 8192,       // 8GB RAM
      maxDisk: 51200,     // 50GB Disk
      maxCpu: 400,        // 400% CPU (4 Cores)
      maxServers: 3,      // 3 Server Slots
      maxAllocations: 5,  // 5 Port Allocations
      maxBackups: 5,      // 5 Backups
      allowServerCreation: true,
      expiresAt,
      gracePeriodDays: 3,
      onExpireAction: "SUSPEND_SERVERS",
      notes: "Configured with 8GB RAM, 50GB Disk, 400% CPU, 3 Server Slots, 5 Ports, 30d expiry, 3d grace",
    },
  });

  console.log("Successfully granted quota to me@prasadnaik.in:", {
    email: user.email,
    ramGb: quota.maxRam / 1024,
    diskGb: quota.maxDisk / 1024,
    cpuPct: quota.maxCpu,
    servers: quota.maxServers,
    ports: quota.maxAllocations,
    expiresAt: quota.expiresAt,
    gracePeriodDays: quota.gracePeriodDays,
    allowServerCreation: quota.allowServerCreation
  });
}

main().catch(console.error).finally(() => process.exit(0));
