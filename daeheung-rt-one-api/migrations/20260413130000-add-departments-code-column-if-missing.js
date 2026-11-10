'use strict';

/**
 * 기존 DB에 departments 테이블만 있고 code 컬럼이 없는 경우 보정
 * (20260412100000 은 테이블이 이미 있으면 스킵되어 code가 누락될 수 있음)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = (tables || []).map((x) => (typeof x === 'string' ? x : x.tableName || x));
    if (!names.includes('departments')) return;

    const desc = await queryInterface.describeTable('departments');
    if (desc.code) return;

    await queryInterface.addColumn('departments', 'code', {
      type: Sequelize.STRING(50),
      allowNull: true
    });
  },

  async down(queryInterface) {
    const desc = await queryInterface.describeTable('departments').catch(() => ({}));
    if (desc && desc.code) {
      await queryInterface.removeColumn('departments', 'code');
    }
  }
};
