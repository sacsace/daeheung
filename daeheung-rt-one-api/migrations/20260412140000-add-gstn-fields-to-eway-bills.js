'use strict';

/** GSTN(인도) E-Way Bill 공식 발급 번호·유효기간·오류 메시지 저장 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = 'eway_bills';
    const cols = await queryInterface.describeTable(table);
    if (!cols.gstn_eway_bill_no) {
      await queryInterface.addColumn(table, 'gstn_eway_bill_no', {
        type: Sequelize.STRING(32),
        allowNull: true
      });
    }
    if (!cols.gstn_valid_upto) {
      await queryInterface.addColumn(table, 'gstn_valid_upto', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!cols.gstn_last_error) {
      await queryInterface.addColumn(table, 'gstn_last_error', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
    const idx = await queryInterface.showIndex(table);
    if (!idx.some((i) => i.name === 'eway_bills_gstn_eway_bill_no_idx')) {
      await queryInterface.addIndex(table, ['gstn_eway_bill_no'], {
        name: 'eway_bills_gstn_eway_bill_no_idx'
      });
    }
  },

  down: async (queryInterface) => {
    const table = 'eway_bills';
    const idx = await queryInterface.showIndex(table);
    if (idx.some((i) => i.name === 'eway_bills_gstn_eway_bill_no_idx')) {
      await queryInterface.removeIndex(table, 'eway_bills_gstn_eway_bill_no_idx');
    }
    const cols = await queryInterface.describeTable(table);
    if (cols.gstn_last_error) await queryInterface.removeColumn(table, 'gstn_last_error');
    if (cols.gstn_valid_upto) await queryInterface.removeColumn(table, 'gstn_valid_upto');
    if (cols.gstn_eway_bill_no) await queryInterface.removeColumn(table, 'gstn_eway_bill_no');
  }
};
