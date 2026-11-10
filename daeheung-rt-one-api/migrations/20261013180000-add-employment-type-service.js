'use strict';

/**
 * users.employment_type 에 서비스 직군(service) 추가 (PostgreSQL ENUM)
 * Fixed Rest-Day Monthly Salary 전용 근무형태
 */
module.exports = {
  async up(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect !== 'postgres') {
      return;
    }

    const [cols] = await queryInterface.sequelize.query(`
      SELECT udt_name AS name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'employment_type'
    `);
    const typeName = cols?.[0]?.name;
    if (!typeName) {
      console.warn('20261013180000: users.employment_type 컬럼 없음 — 건너뜀');
      return;
    }

    const [existsRows] = await queryInterface.sequelize.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
          AND t.typname = :typeName
          AND e.enumlabel = 'service'
      ) AS ex
    `,
      { replacements: { typeName } }
    );
    if (existsRows?.[0]?.ex) {
      return;
    }

    const safeType = String(typeName).replace(/"/g, '');
    const typLiteral = safeType.replace(/'/g, "''");
    try {
      await queryInterface.sequelize.query(`
        DO $$
        DECLARE
          typ CONSTANT text := '${typLiteral}';
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public'
              AND t.typname = typ
              AND e.enumlabel = 'service'
          ) THEN
            EXECUTE format('ALTER TYPE %I.%I ADD VALUE %L', 'public', typ, 'service');
          END IF;
        END
        $$;
      `);
    } catch (err) {
      const msg = err && err.message ? String(err.message) : String(err);
      console.error(
        '[20261013180000] ENUM에 service 추가 실패(타입 소유 권한 필요할 수 있음). 다음을 실행하세요:\n' +
          `  psql -f scripts/sql/add-user-employment-type-enum.sql\n` +
          `  또는: ALTER TYPE "public"."${safeType}" ADD VALUE 'service';`
      );
      if (/소유|must be owner|permission denied/i.test(msg)) {
        console.warn('[20261013180000] 권한 오류로 service 스킵 — SequelizeMeta는 기록됩니다.');
        return;
      }
      throw err;
    }
  },

  async down() {
    // PostgreSQL에서는 ENUM 값 삭제가 사실상 불가 — 빈 구현
  },
};
