/**
 * status='inactive' 사용자 및 관련 참조 일괄 물리 삭제 (일회성 정리용)
 *
 * 사용:
 *   node scripts/purge-inactive-users.cjs --dry-run
 *   node scripts/purge-inactive-users.cjs --confirm
 *
 * Railway:
 *   railway run node scripts/purge-inactive-users.cjs --dry-run
 *   railway run node scripts/purge-inactive-users.cjs --confirm
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

async function listInactiveUsers(transaction) {
  const [rows] = await sequelize.query(
    `SELECT id, userid, username, email, company_id, tenant_id, created_at
     FROM users
     WHERE status = 'inactive'
     ORDER BY id`,
    { transaction }
  );
  return rows;
}

async function listUserForeignKeys(transaction) {
  const [rows] = await sequelize.query(
    `SELECT
       tc.table_schema,
       tc.table_name,
       kcu.column_name,
       rc.delete_rule,
       c.is_nullable
     FROM information_schema.table_constraints AS tc
     JOIN information_schema.key_column_usage AS kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage AS ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
     JOIN information_schema.referential_constraints AS rc
       ON rc.constraint_name = tc.constraint_name
      AND rc.constraint_schema = tc.table_schema
     JOIN information_schema.columns AS c
       ON c.table_schema = tc.table_schema
      AND c.table_name = tc.table_name
      AND c.column_name = kcu.column_name
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND ccu.table_name = 'users'
       AND ccu.column_name = 'id'
       AND tc.table_schema = 'public'
     ORDER BY tc.table_name, kcu.column_name`,
    { transaction }
  );
  return rows;
}

async function countRefs(tableName, columnName, userIds, transaction) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*)::int AS cnt
     FROM "${tableName}"
     WHERE "${columnName}" = ANY($1::int[])`,
    { bind: [userIds], transaction }
  );
  return rows[0]?.cnt ?? 0;
}

async function deleteRefs(tableName, columnName, userIds, deleteRule, isNullable, transaction) {
  const count = await countRefs(tableName, columnName, userIds, transaction);
  if (count === 0) return 0;

  const canSetNull = isNullable === 'YES';
  const useSetNull = deleteRule === 'SET NULL' || ((deleteRule === 'NO ACTION' || deleteRule === 'RESTRICT') && canSetNull);

  if (useSetNull) {
    if (dryRun) return count;
    await sequelize.query(
      `UPDATE "${tableName}" SET "${columnName}" = NULL WHERE "${columnName}" = ANY($1::int[])`,
      { bind: [userIds], transaction }
    );
    return count;
  }

  if (dryRun) return count;
  await sequelize.query(
    `DELETE FROM "${tableName}" WHERE "${columnName}" = ANY($1::int[])`,
    { bind: [userIds], transaction }
  );
  return count;
}

async function main() {
  const transaction = await sequelize.transaction();
  try {
    const inactiveUsers = await listInactiveUsers(transaction);
    const userIds = inactiveUsers.map((u) => Number(u.id));

    console.log(`mode: ${dryRun ? 'DRY RUN' : 'CONFIRM DELETE'}`);
    console.log(`inactive users: ${inactiveUsers.length}`);

    if (inactiveUsers.length === 0) {
      console.log('✅ 삭제할 inactive 사용자가 없습니다.');
      await transaction.rollback();
      await sequelize.close();
      return;
    }

    console.log('sample:', inactiveUsers.slice(0, 5));

    const fks = await listUserForeignKeys(transaction);
    const touched = [];

    for (const fk of fks) {
      const count = await deleteRefs(
        fk.table_name,
        fk.column_name,
        userIds,
        fk.delete_rule,
        fk.is_nullable,
        transaction
      );
      if (count > 0) {
        touched.push({
          table: fk.table_name,
          column: fk.column_name,
          rule: fk.delete_rule,
          count,
        });
      }
    }

    if (touched.length > 0) {
      console.log('related rows affected:');
      for (const row of touched) {
        console.log(`  - ${row.table}.${row.column} (${row.rule}): ${row.count}`);
      }
    }

    if (dryRun) {
      console.log(`DRY RUN: users ${inactiveUsers.length}건 삭제 예정`);
      await transaction.rollback();
    } else {
      await sequelize.query(`DELETE FROM users WHERE status = 'inactive'`, { transaction });
      console.log(`✅ users ${inactiveUsers.length}건 삭제 완료`);
      await transaction.commit();
    }
  } catch (error) {
    await transaction.rollback();
    console.error('❌ purge failed:', error.message || error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
