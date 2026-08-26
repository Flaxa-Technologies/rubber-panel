import db from "./lib/db";

async function main() {
  const servers = await db.server.findMany();
  for (const s of servers) {
    if (!s.isCreatedFromQuota) {
      await db.server.update({
        where: { id: s.id },
        data: {
          baseRam: s.ram,
          baseCpu: s.cpu,
          baseDisk: s.disk,
          extraRam: 0,
          extraCpu: 0,
          extraDisk: 0,
        }
      });
    }
  }

  const updated = await db.server.findMany();
  console.log("Synced server base plans:", updated.map(s => ({
    name: s.name,
    ram: s.ram,
    baseRam: s.baseRam,
    extraRam: s.extraRam,
    cpu: s.cpu,
    baseCpu: s.baseCpu,
    disk: s.disk,
    baseDisk: s.baseDisk,
  })));
}

main().catch(console.error).finally(() => process.exit(0));
