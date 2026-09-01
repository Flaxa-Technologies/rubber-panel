const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('11223344', 10);
  const user = await prisma.user.upsert({
    where: { email: 'me@hostadmin.net' },
    update: { passwordHash },
    create: {
      email: 'me@hostadmin.net',
      username: 'prasad',
      passwordHash,
      role: 'ADMIN',
    },
  });
  console.log('User created/updated:', user.email);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
