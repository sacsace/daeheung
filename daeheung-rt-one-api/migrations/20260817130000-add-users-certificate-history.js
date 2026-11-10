'use strict';

/** 사용자 자격증 이력 — JSON 배열 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');
    if (!table.certificate_history) {
      await queryInterface.addColumn('users', 'certificate_history', {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('users');
    if (table.certificate_history) {
      await queryInterface.removeColumn('users', 'certificate_history');
    }
  },
};
