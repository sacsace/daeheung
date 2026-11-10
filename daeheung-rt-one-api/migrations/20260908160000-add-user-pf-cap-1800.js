'use strict';

/** 직원별 PF 상한 1,800 적용 여부 (기본 true = MIN(기본급×12%, 1800)) */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pf_cap_1800" BOOLEAN NOT NULL DEFAULT true;'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "pf_cap_1800";'
    );
  }
};
