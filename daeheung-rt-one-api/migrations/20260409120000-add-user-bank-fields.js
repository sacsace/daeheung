'use strict';

/** @param {import('sequelize').QueryInterface} queryInterface */
module.exports = {
  async up(queryInterface, Sequelize) {
    const d = await queryInterface.describeTable('users');
    if (!d.bank_name) {
      await queryInterface.addColumn('users', 'bank_name', {
        type: Sequelize.STRING(200),
        allowNull: true
      });
    }
    if (!d.bank_account) {
      await queryInterface.addColumn('users', 'bank_account', {
        type: Sequelize.STRING(64),
        allowNull: true
      });
    }
    if (!d.bank_ifsc) {
      await queryInterface.addColumn('users', 'bank_ifsc', {
        type: Sequelize.STRING(20),
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const d = await queryInterface.describeTable('users');
    if (d.bank_ifsc) await queryInterface.removeColumn('users', 'bank_ifsc');
    if (d.bank_account) await queryInterface.removeColumn('users', 'bank_account');
    if (d.bank_name) await queryInterface.removeColumn('users', 'bank_name');
  }
};
