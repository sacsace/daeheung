'use strict';

/** 사용자 학력 이력 — JSON 배열 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');
    if (!table.education_history) {
      await queryInterface.addColumn('users', 'education_history', {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('users');
    if (table.education_history) {
      await queryInterface.removeColumn('users', 'education_history');
    }
  },
};
