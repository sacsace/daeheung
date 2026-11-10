'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const users = await queryInterface.describeTable('users').catch(() => null);
    if (users && !users.login_notice_version) {
      await queryInterface.addColumn('users', 'login_notice_version', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }
  },

  async down(queryInterface) {
    const users = await queryInterface.describeTable('users').catch(() => null);
    if (users && users.login_notice_version) {
      await queryInterface.removeColumn('users', 'login_notice_version');
    }
  },
};
