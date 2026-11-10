'use strict';

/**
 * 부서를 회사 단위로 분리: departments.company_id 추가
 * unique (tenant_id, name) → (tenant_id, company_id, name)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'departments';
    const desc = await queryInterface.describeTable(table).catch(() => null);
    if (!desc) return;

    if (!desc.company_id) {
      await queryInterface.addColumn(table, 'company_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      });
    }

    // 기존 행 백필: 테넌트 내 최소 company_id
    await queryInterface.sequelize.query(`
      UPDATE departments d
      SET company_id = sub.cid
      FROM (
        SELECT t.id AS tid, MIN(c.id) AS cid
        FROM tenants t
        JOIN companies c ON c.tenant_id = t.id
        GROUP BY t.id
      ) sub
      WHERE d.tenant_id = sub.tid
        AND d.company_id IS NULL
    `);

    // 백필 실패 행이 있으면 삭제(고아 데이터)
    await queryInterface.sequelize.query(`
      DELETE FROM departments WHERE company_id IS NULL
    `);

    await queryInterface.changeColumn(table, 'company_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'companies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // 구 unique 제거
    try {
      await queryInterface.removeIndex(table, 'departments_tenant_id_name_unique');
    } catch (_) {
      /* ignore */
    }

    // 새 unique / index
    const [idxRows] = await queryInterface.sequelize.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'departments' AND indexname = 'departments_tenant_company_name_uq'
    `);
    if (!idxRows.length) {
      await queryInterface.addIndex(table, ['tenant_id', 'company_id', 'name'], {
        unique: true,
        name: 'departments_tenant_company_name_uq',
      });
    }

    const [idx2] = await queryInterface.sequelize.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'departments' AND indexname = 'departments_tenant_company_idx'
    `);
    if (!idx2.length) {
      await queryInterface.addIndex(table, ['tenant_id', 'company_id'], {
        name: 'departments_tenant_company_idx',
      });
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('departments', 'departments_tenant_company_name_uq');
    } catch (_) {
      /* ignore */
    }
    try {
      await queryInterface.removeIndex('departments', 'departments_tenant_company_idx');
    } catch (_) {
      /* ignore */
    }

    const desc = await queryInterface.describeTable('departments').catch(() => null);
    if (desc?.company_id) {
      await queryInterface.removeColumn('departments', 'company_id');
    }

    try {
      await queryInterface.addIndex('departments', ['tenant_id', 'name'], {
        unique: true,
        name: 'departments_tenant_id_name_unique',
      });
    } catch (_) {
      /* ignore */
    }
  },
};
