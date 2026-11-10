'use strict';

/** company_gst_numbers·users 조회 성능 인덱스 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    const [gstTable] = await sequelize.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'company_gst_numbers'
      LIMIT 1;
    `);
    if (gstTable.length > 0) {
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_company_gst_numbers_company_id
        ON company_gst_numbers(company_id);
      `);
    }
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_users_company_id_status
      ON users(company_id, status);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_company_gst_numbers_company_id;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_users_company_id_status;
    `);
  }
};
