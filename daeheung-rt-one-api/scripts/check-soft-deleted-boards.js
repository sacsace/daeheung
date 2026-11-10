const { Client } = require('pg');

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const col = await c.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'work_boards'
      AND column_name = 'deleted_at'
  `);
  console.log('has_deleted_at:', col.rows.length > 0);

  if (col.rows.length === 0) {
    const remaining = await c.query(`
      SELECT id, name, company_id, created_by, updated_at
      FROM work_boards
      ORDER BY id DESC
      LIMIT 30
    `);
    console.log('boards_without_soft_delete_col:', JSON.stringify(remaining.rows, null, 2));
    await c.end();
    return;
  }

  const soft = await c.query(`
    SELECT id, name, company_id, created_by, deleted_at, updated_at
    FROM work_boards
    WHERE deleted_at IS NOT NULL
    ORDER BY deleted_at DESC
  `);
  console.log('soft_deleted_boards:', JSON.stringify(soft.rows, null, 2));

  const active = await c.query(`
    SELECT id, name, company_id, created_by, deleted_at
    FROM work_boards
    WHERE deleted_at IS NULL
    ORDER BY id DESC
    LIMIT 20
  `);
  console.log('active_boards:', JSON.stringify(active.rows, null, 2));

  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
