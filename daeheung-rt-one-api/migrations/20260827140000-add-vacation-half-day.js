'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('vacations', 'days', {
      type: Sequelize.DECIMAL(4, 1),
      allowNull: false,
    });
    await queryInterface.addColumn('vacations', 'is_half_day', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('vacations', 'is_half_day');
    await queryInterface.changeColumn('vacations', 'days', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },
};
