'use strict';

/** @param {import('sequelize').QueryInterface} queryInterface */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const t = (tables || []).map((x) => (typeof x === 'string' ? x : x.tableName || x));
    if (!t.includes('positions')) {
      await queryInterface.createTable('positions', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
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
        name: {
          type: Sequelize.STRING(200),
          allowNull: false,
        },
        code: {
          type: Sequelize.STRING(50),
          allowNull: true,
        },
        sort_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
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

      await queryInterface.addIndex('positions', ['tenant_id', 'company_id', 'name'], {
        unique: true,
        name: 'positions_tenant_company_name_unique',
      });
      await queryInterface.addIndex('positions', ['tenant_id'], {
        name: 'positions_tenant_id_idx',
      });
      await queryInterface.addIndex('positions', ['tenant_id', 'company_id'], {
        name: 'positions_tenant_company_idx',
      });
    } else {
      // 테이블은 있으나 컬럼이 빠진 경우 보정
      const cols = await queryInterface.describeTable('positions');
      if (!cols.code) {
        await queryInterface.addColumn('positions', 'code', {
          type: Sequelize.STRING(50),
          allowNull: true,
        });
      }
      if (!cols.sort_order) {
        await queryInterface.addColumn('positions', 'sort_order', {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        });
      }
      if (!cols.is_active) {
        await queryInterface.addColumn('positions', 'is_active', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        });
      }
    }

    const users = await queryInterface.describeTable('users');
    if (!users.position_id) {
      await queryInterface.addColumn('users', 'position_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'positions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
      await queryInterface.addIndex('users', ['position_id'], {
        name: 'users_position_id_idx',
      });
    }
  },

  async down(queryInterface) {
    const users = await queryInterface.describeTable('users').catch(() => ({}));
    if (users.position_id) {
      await queryInterface.removeIndex('users', 'users_position_id_idx').catch(() => {});
      await queryInterface.removeColumn('users', 'position_id');
    }
    const tables = await queryInterface.showAllTables();
    const t = (tables || []).map((x) => (typeof x === 'string' ? x : x.tableName || x));
    if (t.includes('positions')) {
      await queryInterface.dropTable('positions');
    }
  },
};
