'use strict';

/** 결재 유형 마스터 + approvals.type ENUM → STRING */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));
    if (!names.includes('approval_types')) {
      await queryInterface.createTable('approval_types', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        tenant_id: { type: Sequelize.INTEGER, allowNull: false },
        company_id: { type: Sequelize.INTEGER, allowNull: false },
        code: { type: Sequelize.STRING(50), allowNull: false },
        name: { type: Sequelize.STRING(100), allowNull: false },
        sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        is_system: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('approval_types', ['tenant_id', 'company_id', 'is_active'], {
        name: 'approval_types_scope_active_idx',
      });
      await queryInterface.addIndex('approval_types', ['tenant_id', 'company_id', 'code'], {
        name: 'approval_types_scope_code_uq',
        unique: true,
      });
    }

    // ENUM → VARCHAR so custom types (e.g. business_trip) are allowed
    await queryInterface.sequelize.query(`
      ALTER TABLE approvals
      ALTER COLUMN type TYPE VARCHAR(50)
      USING type::text
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE approvals
      ALTER COLUMN category DROP NOT NULL
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE approvals
      ALTER COLUMN category SET DEFAULT ''
    `);
  },

  async down(queryInterface, Sequelize) {
    // keep type as VARCHAR on down (safer); drop approval_types
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));
    if (names.includes('approval_types')) {
      await queryInterface.dropTable('approval_types');
    }
  },
};
