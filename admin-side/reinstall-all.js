const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.server.findMany().then(async servers => {
  for (const s of servers) {
    console.log('Reinstalling', s.id);
    await fetch('http://localhost:3000/api/user/servers/' + s.id + '/reinstall', {
      method: 'POST',
      headers: { 'x-internal-secret': 'rubber-panel-internal-secret', 'x-user-id': s.ownerId }
    }).then(r => r.text()).then(t => console.log(s.id, t));
  }
}).finally(() => prisma.$disconnect());
