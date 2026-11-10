'use strict';

/** @param {import('sequelize').QueryInterface} queryInterface */
module.exports = {
  async up(queryInterface, Sequelize) {
    const d = await queryInterface.describeTable('users');
    if (d.department_id) return;

    await queryInterface.addColumn('users', 'department_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'departments', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.addIndex('users', ['department_id'], {
      name: 'users_department_id_idx'
    });
  },

  async down(queryInterface) {
    const d = await queryInterface.describeTable('users');
    if (!d.department_id) return;
    await queryInterface.removeIndex('users', 'users_department_id_idx').catch(() => {});
    await queryInterface.removeColumn('users', 'department_id');
  }
};
