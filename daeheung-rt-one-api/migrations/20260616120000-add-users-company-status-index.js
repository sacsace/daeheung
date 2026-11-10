'use strict';

/** users 목록·대시보드 직원 수 조회 성능 (company_gst_numbers 없어도 적용 가능) */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_users_company_id_status
      ON users(company_id, status);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_users_company_id_status;
    `);
  },
};
