'use strict';

/**
 * Tally XML에는 SAP Company Code / Fiscal Year가 없다.
 * Sequelize changeColumn이 Postgres NOT NULL을 못 푸는 경우가 있어 raw ALTER로 강제한다.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE ac_import_source_documents
        ALTER COLUMN source_company_code DROP NOT NULL,
        ALTER COLUMN fiscal_year DROP NOT NULL
    `);
  },

  async down() {
    // Tally 원본에 빈 값이 남을 수 있어 NOT NULL 복원은 하지 않는다.
  },
};
