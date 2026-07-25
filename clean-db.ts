import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const res = await prisma.fingerprint.deleteMany({ where: { size: 0 } });
  console.log('Deleted empty fingerprints:', res.count);
}
main().finally(() => prisma.$disconnect());
