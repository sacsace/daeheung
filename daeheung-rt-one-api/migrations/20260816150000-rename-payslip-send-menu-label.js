'use strict';

/**
 * 메뉴 표시명: 급여발송 → 급여 명세서 발송
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET name_ko = '급여 명세서 발송',
          name_en = 'Payslip Delivery',
          updated_at = NOW()
      WHERE route = '/hr/payslip-send'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET name_ko = '급여발송',
          name_en = 'Payslip Send',
          updated_at = NOW()
      WHERE route = '/hr/payslip-send'
    `);
  }
};
