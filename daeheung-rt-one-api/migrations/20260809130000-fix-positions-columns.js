'use strict';

/**
 * positions 테이블이 이미 있으나 code 등 컬럼이 빠진 경우 보정
 * (CREATE TABLE IF NOT EXISTS / 부분 생성으로 스키마가 불완전할 때)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const t = (tables || []).map((x) => (typeof x === 'string' ? x : x.tableName || x));
    if (!t.includes('positions')) {
      return;
    }

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
    if (!cols.created_at) {
      await queryInterface.addColumn('positions', 'created_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
    }
    if (!cols.updated_at) {
      await queryInterface.addColumn('positions', 'updated_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
    }

    // users.position_id 보정
    const users = await queryInterface.describeTable('users');
    if (!users.position_id) {
      await queryInterface.addColumn('users', 'position_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'positions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
      try {
        await queryInterface.addIndex('users', ['position_id'], {
          name: 'users_position_id_idx',
        });
      } catch (_) {
        /* already exists */
      }
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const t = (tables || []).map((x) => (typeof x === 'string' ? x : x.tableName || x));
    if (!t.includes('positions')) return;

    const cols = await queryInterface.describeTable('positions');
    if (cols.code) {
      await queryInterface.removeColumn('positions', 'code');
    }
  },
};
