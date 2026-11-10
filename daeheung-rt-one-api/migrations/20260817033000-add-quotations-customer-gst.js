'use strict';

/** 견적서 Customer info에 고객 GSTIN 스냅샷 저장 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('quotations');
    if (!table.customer_gst) {
      await queryInterface.addColumn('quotations', 'customer_gst', {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: '고객 GSTIN (작성 시점 스냅샷)',
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('quotations');
    if (table.customer_gst) {
      await queryInterface.removeColumn('quotations', 'customer_gst');
    }
  },
};
