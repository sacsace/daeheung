'use strict';

/**
 * 직원 PF 계산 방식
 * - cap_1800: MIN(기본급×12%, 1800) (기본)
 * - basic_12pct: 기본급×12%
 * - total_12pct: 총급여(급여합계)×12%
 * 기존 pf_cap_1800 boolean 값을 이관 후 컬럼 제거
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "pf_calc_mode" VARCHAR(32) NOT NULL DEFAULT 'cap_1800';
    `);
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'pf_cap_1800'
        ) THEN
          UPDATE "users"
          SET "pf_calc_mode" = CASE
            WHEN "pf_cap_1800" IS FALSE THEN 'basic_12pct'
            ELSE 'cap_1800'
          END;
          ALTER TABLE "users" DROP COLUMN "pf_cap_1800";
        END IF;
      END $$;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "pf_cap_1800" BOOLEAN NOT NULL DEFAULT true;
    `);
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'pf_calc_mode'
        ) THEN
          UPDATE "users"
          SET "pf_cap_1800" = CASE
            WHEN "pf_calc_mode" = 'basic_12pct' THEN false
            WHEN "pf_calc_mode" = 'total_12pct' THEN false
            ELSE true
          END;
          ALTER TABLE "users" DROP COLUMN "pf_calc_mode";
        END IF;
      END $$;
    `);
  }
};
