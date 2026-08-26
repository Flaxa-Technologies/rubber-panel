const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.server.findUnique({where: {id: 'f6160daf-24bb-4d19-9894-e3997228247c'}}).then(console.log).finally(() => prisma.$disconnect());
