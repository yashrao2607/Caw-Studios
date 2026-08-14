const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv/config');

const OWNERS = ['user_42', 'user_7'];

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const rows = [];
  for (let i = 0; i < 2000; i++) {
    let code = '';
    for (let j = 0; j < 6; j++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    rows.push({
      code,
      longUrl: `https://example.com/page/${i}`,
      createdBy: OWNERS[i % 2],
      tags: ['seed'],
    });
  }

  const res = await prisma.link.createMany({ data: rows, skipDuplicates: true });
  const total = await prisma.link.count();
  const user42 = await prisma.link.count({ where: { createdBy: 'user_42' } });

  console.log(JSON.stringify({ inserted: res.count, total, user_42_links: user42 }, null, 2));

  await prisma.$disconnect();
  await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
