'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('partner_gst_numbers');
    if (!table.is_active) {
      await queryInterface.addColumn('partner_gst_numbers', 'is_active', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }
    const indexes = await queryInterface.showIndex('partner_gst_numbers');
    if (!indexes.some((index) => index.name === 'partner_gst_numbers_partner_active_idx')) {
      await queryInterface.addIndex('partner_gst_numbers', ['partner_id', 'is_active'], {
        name: 'partner_gst_numbers_partner_active_idx',
      });
    }
  },

  async down() {
    // 감사 이력 보존을 위해 soft-delete 컬럼을 rollback으로 제거하지 않는다.
  },
};
