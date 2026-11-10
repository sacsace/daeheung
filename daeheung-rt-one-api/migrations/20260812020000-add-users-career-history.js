'use strict';

/** 사용자 경력(이전 직장) 이력 — JSON 배열 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');
    if (!table.career_history) {
      await queryInterface.addColumn('users', 'career_history', {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('users');
    if (table.career_history) {
      await queryInterface.removeColumn('users', 'career_history');
    }
  },
};
