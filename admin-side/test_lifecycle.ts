import db from "./lib/db";

async function main() {
  const target = await db.server.findFirst({ where: { name: "Quota SMP Server" } });
  if (!target) {
    console.log("Server Quota SMP Server not found");
    return;
  }

  // Set expired date
  await db.server.update({
    where: { id: target.id },
    data: {
      expiresAt: new Date("2026-01-01T00:00:00Z"),
      autoSuspendOnExpiry: true,
      suspended: false,
    },
  });

  const res = await fetch("http://localhost:3000/api/admin/lifecycle/process", {
    method: "POST",
    headers: { "X-Internal-Secret": "rubber-panel-internal-secret" },
  });
  const data = await res.json();
  console.log("Lifecycle run result:", data);

  const serverAfter = await db.server.findUnique({ where: { id: target.id } });
  console.log("Server status after lifecycle check:", {
    name: serverAfter?.name,
    suspended: serverAfter?.suspended,
    suspensionReason: serverAfter?.suspensionReason,
  });

  // Restore
  const future = new Date();
  future.setDate(future.getDate() + 30);
  await db.server.update({
    where: { id: target.id },
    data: {
      suspended: false,
      suspensionReason: null,
      expiresAt: future,
    },
  });
  console.log("Restored server to active with 30-day renewal.");
}

main().catch(console.error).finally(() => process.exit(0));
