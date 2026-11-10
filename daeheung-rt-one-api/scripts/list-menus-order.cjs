const { Sequelize } = require('sequelize');
const { config } = require('dotenv');
const { resolve } = require('path');

config({ path: resolve(__dirname, '../.env') });

const s = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false,
});

(async () => {
  const [rows] = await s.query(`
    SELECT m.id, m.parent_id, p.route AS parent_route, p."order" AS parent_order,
           m.route, m.name_ko, m."order", m.is_active
    FROM menus m
    LEFT JOIN menus p ON p.id = m.parent_id
    WHERE m.tenant_id = 1
    ORDER BY COALESCE(p."order", m."order"), m.parent_id NULLS FIRST, m."order", m.id
  `);
  for (const r of rows) {
    if (!r.is_active) continue;
    const indent = r.parent_id ? '  ' : '';
    console.log(`${indent}${String(r.order).padStart(2)} | ${r.parent_route || '(root)'} | ${r.route} | ${r.name_ko}`);
  }
  await s.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
