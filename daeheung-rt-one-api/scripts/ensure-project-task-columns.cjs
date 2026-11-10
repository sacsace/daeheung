const { Client } = require('pg');

(async () => {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  if (!process.env.DB_NAME || process.env.DB_NAME === 'mvs' || process.env.DB_USER === 'mvs_user') {
    console.error('Daeheung R&T One 데이터베이스로만 실행할 수 있습니다.');
    process.exit(1);
  }
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await client.connect();
  await client.query(`ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS progress_note TEXT`);
  await client.query(
    `ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb`
  );
  await client.query(`
    CREATE TABLE IF NOT EXISTS project_task_comments (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES project_tasks(id) ON UPDATE CASCADE ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await client.query(
    `CREATE INDEX IF NOT EXISTS project_task_comments_task_id_created_at ON project_task_comments (task_id, created_at)`
  );
  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name='project_tasks' AND column_name IN ('progress_note','attachments')
     ORDER BY column_name`
  );
  console.log('OK columns:', cols.rows.map((r) => r.column_name).join(', '));
  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
