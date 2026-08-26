import db from "./lib/db";

async function main() {
  const users = await db.user.findMany({
    include: { resourceQuota: true, servers: true }
  });
  console.log("All DB users and quotas:", users.map(u => ({
    id: u.id,
    email: u.email,
    username: u.username,
    role: u.role,
    hasQuota: !!u.resourceQuota,
    quota: u.resourceQuota,
    servers: u.servers.map(s => ({ id: s.id, name: s.name, ram: s.ram, cpu: s.cpu, disk: s.disk }))
  })));
}

main().catch(console.error).finally(() => process.exit(0));
