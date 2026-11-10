'use strict';

/**
 * departments 테이블이 예전에 부분 스키마로만 있을 때 누락된 컬럼 보정
 * (create-departments 마이그레이션이 테이블 존재 시 스킵되는 경우)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = (tables || []).map((x) => (typeof x === 'string' ? x : x.tableName || x));
    if (!names.includes('departments')) return;

    const desc = await queryInterface.describeTable('departments');

    if (!desc.sort_order) {
      await queryInterface.addColumn('departments', 'sort_order', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      });
    }
    if (!desc.is_active) {
      await queryInterface.addColumn('departments', 'is_active', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
    }
    if (!desc.created_at) {
      await queryInterface.addColumn('departments', 'created_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      });
    }
    if (!desc.updated_at) {
      await queryInterface.addColumn('departments', 'updated_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      });
    }
  },

  async down() {
    // 복구 시 데이터 손실 위험 — no-op
  }
};
