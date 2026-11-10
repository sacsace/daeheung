'use strict';

/**
 * 레거시 payrolls 컬럼(pay_period_start/end, net_pay) 이 NOT NULL 로 남아
 * 신규 INSERT(payroll_period 만 사용) 가 실패한다.
 * - 기존 값이 있으면 payroll_period / net_salary 로 백필
 * - 레거시 컬럼은 nullable 로 완화 후 제거
 */

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));
    if (!names.includes('payrolls')) return;

    const desc = await queryInterface.describeTable('payrolls');

    if (desc.pay_period_start && desc.payroll_period) {
      await sequelize.query(`
        UPDATE payrolls
        SET payroll_period = to_char(pay_period_start::date, 'YYYY-MM')
        WHERE (payroll_period IS NULL OR trim(payroll_period) = '')
          AND pay_period_start IS NOT NULL
      `);
    }
    if (desc.net_pay && desc.net_salary) {
      await sequelize.query(`
        UPDATE payrolls
        SET net_salary = COALESCE(net_pay, net_salary, 0)
        WHERE net_pay IS NOT NULL
      `);
    }

    // NOT NULL 완화 (삭제 전 안전장치)
    for (const col of ['pay_period_start', 'pay_period_end', 'net_pay']) {
      if (!desc[col]) continue;
      await sequelize.query(`ALTER TABLE payrolls ALTER COLUMN "${col}" DROP NOT NULL`).catch(() => {});
    }

    // 코드/모델에서 쓰지 않는 레거시 컬럼 제거
    for (const col of ['pay_period_start', 'pay_period_end', 'net_pay']) {
      if (!desc[col]) continue;
      await queryInterface.removeColumn('payrolls', col).catch(async () => {
        await sequelize.query(`ALTER TABLE payrolls DROP COLUMN IF EXISTS "${col}"`);
      });
    }
  },

  async down() {
    // no-op
  },
};
