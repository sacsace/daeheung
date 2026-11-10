'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('employment_contracts', 'working_days', {
      type: Sequelize.STRING(120),
      allowNull: true
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('employment_contracts', 'working_days');
  }
};

