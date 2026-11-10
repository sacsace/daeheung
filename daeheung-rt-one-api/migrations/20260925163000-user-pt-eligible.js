'use strict';

/** users.pt_eligible — PT(Professional Tax) 적용 여부. 기본 true(회사 GST 주 기준으로 급여 자동 계산) */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "pt_eligible" BOOLEAN NOT NULL DEFAULT true;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "pt_eligible";
    `);
  },
};
