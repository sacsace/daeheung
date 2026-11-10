'use strict';

/** @param {import('sequelize').QueryInterface} queryInterface */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      const d = await queryInterface.describeTable('payrolls');
      if (!d.extra_fields) {
        await queryInterface.addColumn('payrolls', 'extra_fields', {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: {}
        });
      }
      if (!d.is_active) {
        await queryInterface.addColumn('payrolls', 'is_active', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        });
      }
    } catch (e) {
      console.warn('20260410150000-add-payrolls-extra-fields:', e.message);
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      const d = await queryInterface.describeTable('payrolls');
      if (d.extra_fields) {
        await queryInterface.removeColumn('payrolls', 'extra_fields');
      }
      if (d.is_active) {
        await queryInterface.removeColumn('payrolls', 'is_active');
      }
    } catch (e) {
      console.warn('undo 20260410150000-add-payrolls-extra-fields:', e.message);
    }
  }
};
