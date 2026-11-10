'use strict';

/**
 * 급여 명세서: 메일+급여월 기준 최신 1건만 유지
 * - user_id+period 유니크 → email+period 유니크(활성)
 * - user_id nullable (메일로 식별, FK 필수 아님)
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE payslip_deliveries
        ALTER COLUMN user_id DROP NOT NULL;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE payslip_deliveries
        DROP CONSTRAINT IF EXISTS payslip_deliveries_user_id_fkey;
    `);

    // 기존 FK를 ON DELETE SET NULL 로 재생성 (nullable)
    await queryInterface.sequelize.query(`
      ALTER TABLE payslip_deliveries
        ADD CONSTRAINT payslip_deliveries_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS payslip_deliveries_user_period_unique;
    `);

    // 같은 회사·메일·급여월의 활성 행은 1건만
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS payslip_deliveries_email_period_unique
      ON payslip_deliveries (tenant_id, company_id, payroll_period, (LOWER(recipient_email)))
      WHERE is_active = true;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS payslip_deliveries_email_period_unique;
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS payslip_deliveries_user_period_unique
      ON payslip_deliveries (tenant_id, company_id, user_id, payroll_period)
      WHERE is_active = true;
    `);

    // nullable 유지한 채 down (데이터에 null 있을 수 있음)
  },
};
