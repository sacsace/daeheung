'use strict';

/**
 * expense_id 전역 UNIQUE → (tenant_id, company_id, expense_id) UNIQUE
 * - 회사별 PV 채번과 맞추고, 타사/비활성 행과의 불필요한 충돌을 줄인다.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const qi = queryInterface.sequelize;

    // Sequelize unique:true / addConstraint 이름 후보
    await qi.query(`
      ALTER TABLE expense_reports DROP CONSTRAINT IF EXISTS expense_reports_expense_id_key;
    `);
    await qi.query(`
      DROP INDEX IF EXISTS expense_reports_expense_id_key;
    `);
    await qi.query(`
      DROP INDEX IF EXISTS expense_reports_expense_id;
    `);

    // 동일 tenant+company 내 중복 expense_id가 있으면 복합 UNIQUE 생성 실패 → 사전 점검
    const [dupes] = await qi.query(`
      SELECT tenant_id, company_id, expense_id, COUNT(*)::int AS cnt
      FROM expense_reports
      GROUP BY tenant_id, company_id, expense_id
      HAVING COUNT(*) > 1
      LIMIT 5
    `);
    if (Array.isArray(dupes) && dupes.length > 0) {
      throw new Error(
        `expense_reports has duplicate (tenant_id, company_id, expense_id): ${JSON.stringify(dupes)}`
      );
    }

    await queryInterface.addIndex('expense_reports', ['tenant_id', 'company_id', 'expense_id'], {
      unique: true,
      name: 'expense_reports_tenant_company_expense_id_uk',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('expense_reports', 'expense_reports_tenant_company_expense_id_uk');
    await queryInterface.addConstraint('expense_reports', {
      fields: ['expense_id'],
      type: 'unique',
      name: 'expense_reports_expense_id_key',
    });
  },
};
