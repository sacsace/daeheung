'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('expense_reports', 'paid_amount', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    });

    // 이미 전액 결제 완료된 건은 paid_amount를 총액으로 맞춤
    await queryInterface.sequelize.query(`
      UPDATE expense_reports
      SET paid_amount = total_amount
      WHERE (payment_request_status = 'paid' OR status = 'paid')
        AND COALESCE(paid_amount, 0) = 0
        AND COALESCE(total_amount, 0) > 0
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('expense_reports', 'paid_amount');
  },
};
