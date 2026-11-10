/**
 * users.department / users.position 문자열만 있고 *_id 가 NULL 인 행을
 * departments / positions 마스터와 이름(대소문자·공백 무시) 매칭으로 보정.
 *
 * 사용:
 *   node scripts/backfill-user-master-ids.cjs --dry-run
 *   node scripts/backfill-user-master-ids.cjs --confirm
 *
 * Railway:
 *   railway run node scripts/backfill-user-master-ids.cjs --dry-run
 *   railway run node scripts/backfill-user-master-ids.cjs --confirm
 */
const { Sequelize } = require('sequelize');
const { config } = require('dotenv');
const { getPostgresDialectOptions } = require('./postgres-dialect-options.cjs');

config();

const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--confirm');
const databaseUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ TARGET_DATABASE_URL 또는 DATABASE_URL 필요');
  process.exit(1);
}

const sequelize = new Sequelize(databaseUrl, {
  logging: false,
  dialect: 'postgres',
  dialectOptions: getPostgresDialectOptions(databaseUrl),
});

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

async function previewDepartmentBackfill(transaction) {
  const [rows] = await sequelize.query(
    `SELECT u.id, u.userid, u.username, u.company_id, u.department, d.id AS match_department_id, d.name AS match_department_name
     FROM users u
     JOIN departments d
       ON d.tenant_id = u.tenant_id
      AND d.company_id = u.company_id
      AND d.is_active = true
      AND lower(trim(regexp_replace(u.department, '\\s+', ' ', 'g'))) =
          lower(trim(regexp_replace(d.name, '\\s+', ' ', 'g')))
     WHERE u.department_id IS NULL
       AND u.department IS NOT NULL
       AND trim(u.department) <> ''
     ORDER BY u.id`,
    { transaction }
  );
  return rows;
}

async function previewPositionBackfill(transaction) {
  const [rows] = await sequelize.query(
    `SELECT u.id, u.userid, u.username, u.company_id, u.position, p.id AS match_position_id, p.name AS match_position_name
     FROM users u
     JOIN positions p
       ON p.tenant_id = u.tenant_id
      AND p.company_id = u.company_id
      AND p.is_active = true
      AND lower(trim(regexp_replace(u.position, '\\s+', ' ', 'g'))) =
          lower(trim(regexp_replace(p.name, '\\s+', ' ', 'g')))
     WHERE u.position_id IS NULL
       AND u.position IS NOT NULL
       AND trim(u.position) <> ''
     ORDER BY u.id`,
    { transaction }
  );
  return rows;
}

async function unmatchedDepartments(transaction) {
  const [rows] = await sequelize.query(
    `SELECT DISTINCT u.company_id, u.department, count(*)::int AS user_count
     FROM users u
     WHERE u.department_id IS NULL
       AND u.department IS NOT NULL
       AND trim(u.department) <> ''
       AND NOT EXISTS (
         SELECT 1
         FROM departments d
         WHERE d.tenant_id = u.tenant_id
           AND d.company_id = u.company_id
           AND d.is_active = true
           AND lower(trim(regexp_replace(u.department, '\\s+', ' ', 'g'))) =
               lower(trim(regexp_replace(d.name, '\\s+', ' ', 'g')))
       )
     GROUP BY u.company_id, u.department
     ORDER BY u.company_id, u.department`,
    { transaction }
  );
  return rows;
}

async function unmatchedPositions(transaction) {
  const [rows] = await sequelize.query(
    `SELECT DISTINCT u.company_id, u.position, count(*)::int AS user_count
     FROM users u
     WHERE u.position_id IS NULL
       AND u.position IS NOT NULL
       AND trim(u.position) <> ''
       AND NOT EXISTS (
         SELECT 1
         FROM positions p
         WHERE p.tenant_id = u.tenant_id
           AND p.company_id = u.company_id
           AND p.is_active = true
           AND lower(trim(regexp_replace(u.position, '\\s+', ' ', 'g'))) =
               lower(trim(regexp_replace(p.name, '\\s+', ' ', 'g')))
       )
     GROUP BY u.company_id, u.position
     ORDER BY u.company_id, u.position`,
    { transaction }
  );
  return rows;
}

async function applyDepartmentBackfill(transaction) {
  const [result] = await sequelize.query(
    `UPDATE users u
     SET department_id = d.id,
         department = d.name,
         updated_at = NOW()
     FROM departments d
     WHERE u.department_id IS NULL
       AND u.department IS NOT NULL
       AND trim(u.department) <> ''
       AND d.tenant_id = u.tenant_id
       AND d.company_id = u.company_id
       AND d.is_active = true
       AND lower(trim(regexp_replace(u.department, '\\s+', ' ', 'g'))) =
           lower(trim(regexp_replace(d.name, '\\s+', ' ', 'g')))`,
    { transaction }
  );
  return result;
}

async function applyPositionBackfill(transaction) {
  const [result] = await sequelize.query(
    `UPDATE users u
     SET position_id = p.id,
         position = p.name,
         updated_at = NOW()
     FROM positions p
     WHERE u.position_id IS NULL
       AND u.position IS NOT NULL
       AND trim(u.position) <> ''
       AND p.tenant_id = u.tenant_id
       AND p.company_id = u.company_id
       AND p.is_active = true
       AND lower(trim(regexp_replace(u.position, '\\s+', ' ', 'g'))) =
           lower(trim(regexp_replace(p.name, '\\s+', ' ', 'g')))`,
    { transaction }
  );
  return result;
}

async function main() {
  console.log(dryRun ? '🔍 dry-run (변경 없음)' : '✅ confirm 모드 (DB 업데이트 실행)');

  await sequelize.transaction(async (transaction) => {
    const deptPreview = await previewDepartmentBackfill(transaction);
    const posPreview = await previewPositionBackfill(transaction);
    const deptUnmatched = await unmatchedDepartments(transaction);
    const posUnmatched = await unmatchedPositions(transaction);

    console.log(`\n부서 매칭 가능: ${deptPreview.length}명`);
    if (deptPreview.length > 0) {
      console.table(
        deptPreview.slice(0, 20).map((r) => ({
          id: r.id,
          userid: r.userid,
          department: r.department,
          match: r.match_department_name,
        }))
      );
      if (deptPreview.length > 20) {
        console.log(`... 외 ${deptPreview.length - 20}명`);
      }
    }

    console.log(`\n직책 매칭 가능: ${posPreview.length}명`);
    if (posPreview.length > 0) {
      console.table(
        posPreview.slice(0, 20).map((r) => ({
          id: r.id,
          userid: r.userid,
          position: r.position,
          match: r.match_position_name,
        }))
      );
      if (posPreview.length > 20) {
        console.log(`... 외 ${posPreview.length - 20}명`);
      }
    }

    if (deptUnmatched.length > 0) {
      console.log('\n⚠️ 부서 마스터와 매칭되지 않는 값:');
      console.table(deptUnmatched);
    }
    if (posUnmatched.length > 0) {
      console.log('\n⚠️ 직책 마스터와 매칭되지 않는 값:');
      console.table(posUnmatched);
    }

    if (dryRun) {
      console.log('\n실행하려면: node scripts/backfill-user-master-ids.cjs --confirm');
      return;
    }

    const deptResult = await applyDepartmentBackfill(transaction);
    const posResult = await applyPositionBackfill(transaction);
    console.log(`\n✅ 부서 보정 완료: ${deptResult.rowCount ?? deptResult}행`);
    console.log(`✅ 직책 보정 완료: ${posResult.rowCount ?? posResult}행`);
  });

  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
