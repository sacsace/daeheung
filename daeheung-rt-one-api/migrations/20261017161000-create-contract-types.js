'use strict';

/** 계약 구분 마스터 + contracts.contract_type 길이 확장 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));

    if (!names.includes('contract_types')) {
      await queryInterface.createTable('contract_types', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        tenant_id: { type: Sequelize.INTEGER, allowNull: false },
        company_id: { type: Sequelize.INTEGER, allowNull: false },
        code: { type: Sequelize.STRING(50), allowNull: false },
        name: { type: Sequelize.STRING(100), allowNull: false },
        sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        is_system: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
      await queryInterface.addIndex('contract_types', ['tenant_id', 'company_id', 'is_active'], {
        name: 'contract_types_scope_active_idx',
      });
      await queryInterface.addIndex('contract_types', ['tenant_id', 'company_id', 'code'], {
        name: 'contract_types_scope_code_uq',
        unique: true,
      });
    }

    if (names.includes('contracts')) {
      const table = await queryInterface.describeTable('contracts');
      if (table.contract_type) {
        await queryInterface.changeColumn('contracts', 'contract_type', {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'sales',
        });
      }
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));
    if (names.includes('contract_types')) {
      await queryInterface.dropTable('contract_types');
    }
  },
};
