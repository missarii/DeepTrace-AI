import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@deeptrace.ai';
  const passwordHash = await argon2.hash('deeptrace123', { type: argon2.argon2id });
  const user = await prisma.user.upsert({
    where: { email }, update: {},
    create: { email, passwordHash, name: 'Demo', settings: { create: {} } },
  });
  const project = await prisma.project.create({ data: { ownerId: user.id, title: 'Sample: aerial threat detection (demo)', description: 'Seeded demo project — clearly labeled sample data.' } });
  console.log(JSON.stringify({ seeded: true, user: email, project: project.id }));
}

main().finally(() => prisma.$disconnect());
