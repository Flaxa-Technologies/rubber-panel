import db from "./lib/db";

async function main() {
  const software = await db.software.findMany({
    include: { versions: true }
  });
  console.log("Available Minecraft Softwares & Versions:", software.map(s => ({
    id: s.id,
    name: s.name,
    type: s.type,
    versions: s.versions.map(v => ({ id: v.id, version: v.version }))
  })));
}

main().catch(console.error).finally(() => process.exit(0));
