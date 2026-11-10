'use strict';

/** TDS 코드 영문 설명 컬럼 추가 및 기본값 보정 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('ac_tds_codes');
    if (!table.description_en) {
      await queryInterface.addColumn('ac_tds_codes', 'description_en', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE ac_tds_codes
      SET description_en = 'Rent TDS', updated_at = NOW()
      WHERE section = '194-I'
        AND (description_en IS NULL OR TRIM(description_en) = '')
    `);
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('ac_tds_codes');
    if (table.description_en) {
      await queryInterface.removeColumn('ac_tds_codes', 'description_en');
    }
  },
};
