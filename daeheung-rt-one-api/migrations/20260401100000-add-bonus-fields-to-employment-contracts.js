'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('employment_contracts', 'bonus_type', {
      type: Sequelize.STRING(20),
      allowNull: true
    });

    await queryInterface.addColumn('employment_contracts', 'bonus_value', {
      type: Sequelize.DECIMAL(15, 2),
      allowNull: true
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('employment_contracts', 'bonus_value');
    await queryInterface.removeColumn('employment_contracts', 'bonus_type');
  }
};

