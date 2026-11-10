'use strict';

/**
 * 구 스키마(pay_period_start/end, net_pay) → 현재 모델(payroll_period, net_salary, company_id …)
 * 운영 DB에 레거시 payrolls 테이블이 남아 급여 생성 시
 * "column Payroll.payroll_period does not exist" 가 나는 경우를 보정합니다.
 */

/** @type {import('sequelize').QueryInterface} */
async function ensureColumn(queryInterface, table, name, definition) {
  const desc = await queryInterface.describeTable(table);
  if (!desc[name]) {
    await queryInterface.addColumn(table, name, definition);
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const sequelize = queryInterface.sequelize;
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));
    if (!names.includes('payrolls')) {
      await queryInterface.createTable('payrolls', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        tenant_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'tenants', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        company_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'companies', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        employee_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        payroll_period: { type: Sequelize.STRING(20), allowNull: false },
        basic_salary: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        overtime_pay: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        bonus: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        allowances: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        deductions: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        gross_salary: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        net_salary: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        tax_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'draft' },
        payment_date: { type: Sequelize.DATEONLY, allowNull: true },
        created_by: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        extra_fields: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      return;
    }

    const desc = await queryInterface.describeTable('payrolls');

    await ensureColumn(queryInterface, 'payrolls', 'company_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await ensureColumn(queryInterface, 'payrolls', 'payroll_period', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
    await ensureColumn(queryInterface, 'payrolls', 'allowances', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await ensureColumn(queryInterface, 'payrolls', 'gross_salary', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await ensureColumn(queryInterface, 'payrolls', 'net_salary', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await ensureColumn(queryInterface, 'payrolls', 'tax_amount', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await ensureColumn(queryInterface, 'payrolls', 'payment_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await ensureColumn(queryInterface, 'payrolls', 'created_by', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await ensureColumn(queryInterface, 'payrolls', 'is_active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await ensureColumn(queryInterface, 'payrolls', 'extra_fields', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {},
    });

    // 레거시 컬럼에서 백필
    if (desc.pay_period_start) {
      await sequelize.query(`
        UPDATE payrolls
        SET payroll_period = to_char(pay_period_start::date, 'YYYY-MM')
        WHERE (payroll_period IS NULL OR payroll_period = '')
          AND pay_period_start IS NOT NULL
      `);
    }
    if (desc.net_pay) {
      await sequelize.query(`
        UPDATE payrolls
        SET net_salary = COALESCE(net_pay, 0)
        WHERE net_salary = 0 AND net_pay IS NOT NULL
      `);
      await sequelize.query(`
        UPDATE payrolls
        SET gross_salary = COALESCE(basic_salary, 0) + COALESCE(overtime_pay, 0) + COALESCE(bonus, 0) + COALESCE(allowances, 0)
        WHERE gross_salary = 0
      `);
    }

    await sequelize.query(`
      UPDATE payrolls p
      SET company_id = u.company_id
      FROM users u
      WHERE p.employee_id = u.id
        AND (p.company_id IS NULL OR p.company_id = 0)
        AND u.company_id IS NOT NULL
    `);
    await sequelize.query(`
      UPDATE payrolls
      SET company_id = COALESCE(
        (SELECT id FROM companies ORDER BY id ASC LIMIT 1),
        1
      )
      WHERE company_id IS NULL OR company_id = 0
    `);

    await sequelize.query(`
      UPDATE payrolls
      SET created_by = employee_id
      WHERE created_by IS NULL
    `);
    await sequelize.query(`
      UPDATE payrolls
      SET created_by = COALESCE(
        (SELECT id FROM users ORDER BY id ASC LIMIT 1),
        1
      )
      WHERE created_by IS NULL
    `);

    await sequelize.query(`
      UPDATE payrolls
      SET payroll_period = '1970-01'
      WHERE payroll_period IS NULL OR trim(payroll_period) = ''
    `);

    // NOT NULL 강제
    await sequelize.query(`ALTER TABLE payrolls ALTER COLUMN company_id SET NOT NULL`);
    await sequelize.query(`ALTER TABLE payrolls ALTER COLUMN payroll_period SET NOT NULL`);
    await sequelize.query(`ALTER TABLE payrolls ALTER COLUMN created_by SET NOT NULL`);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS payrolls_tenant_company_idx ON payrolls(tenant_id, company_id);
      CREATE INDEX IF NOT EXISTS payrolls_employee_id_idx ON payrolls(employee_id);
      CREATE INDEX IF NOT EXISTS payrolls_payroll_period_idx ON payrolls(payroll_period);
      CREATE INDEX IF NOT EXISTS payrolls_status_idx ON payrolls(status);
    `);
  },

  async down() {
    // 레거시 호환 보정 — 되돌리지 않음
  },
};
