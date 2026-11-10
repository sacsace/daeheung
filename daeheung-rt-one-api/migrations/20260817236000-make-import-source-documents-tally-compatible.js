'use strict';

/**
 * 공통 Import 원본 문서는 SAP 외 Tally도 저장한다.
 * Tally XML에는 SAP Company Code/Fiscal Year가 없는 경우가 있어 nullable로 완화한다.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.changeColumn('ac_import_source_documents', 'source_company_code', {
      type: require('sequelize').STRING(50),
      allowNull: true,
    });
    await queryInterface.changeColumn('ac_import_source_documents', 'fiscal_year', {
      type: require('sequelize').STRING(20),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    // 기존 Tally 데이터에 빈 값이 있을 수 있어 NOT NULL 복원은 의도적으로 수행하지 않는다.
    await queryInterface.sequelize.query('SELECT 1');
  },
};
