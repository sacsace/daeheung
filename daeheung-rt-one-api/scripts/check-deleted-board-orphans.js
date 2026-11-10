const { Client } = require('pg');

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const boards = await c.query(`SELECT id, name, company_id, created_by, created_at, updated_at FROM work_boards ORDER BY id`);
  console.log('all_boards:', JSON.stringify(boards.rows, null, 2));

  const maxId = await c.query(`SELECT COALESCE(MAX(id),0) AS max_id FROM work_boards`);
  console.log('max_board_id:', maxId.rows[0].max_id);

  const lists = await c.query(`
    SELECT l.id, l.board_id, l.title
    FROM work_board_lists l
    LEFT JOIN work_boards b ON b.id = l.board_id
    WHERE b.id IS NULL
    ORDER BY l.id
    LIMIT 50
  `);
  console.log('orphan_lists:', JSON.stringify(lists.rows, null, 2));

  const cards = await c.query(`
    SELECT c.id, c.list_id, c.title
    FROM work_board_cards c
    LEFT JOIN work_board_lists l ON l.id = c.list_id
    WHERE l.id IS NULL
    ORDER BY c.id
    LIMIT 50
  `);
  console.log('orphan_cards:', JSON.stringify(cards.rows, null, 2));

  const members = await c.query(`
    SELECT m.id, m.board_id, m.user_id, m.role
    FROM work_board_members m
    LEFT JOIN work_boards b ON b.id = m.board_id
    WHERE b.id IS NULL
    ORDER BY m.id
    LIMIT 50
  `);
  console.log('orphan_members:', JSON.stringify(members.rows, null, 2));

  const seq = await c.query(`SELECT last_value FROM work_boards_id_seq`);
  console.log('work_boards_id_seq:', seq.rows[0]);

  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
