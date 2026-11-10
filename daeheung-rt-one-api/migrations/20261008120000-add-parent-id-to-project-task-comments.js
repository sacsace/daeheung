'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('project_task_comments');
    if (table.parent_id) return;

    await queryInterface.addColumn('project_task_comments', 'parent_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'project_task_comments', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    await queryInterface.addIndex('project_task_comments', ['parent_id'], {
      name: 'project_task_comments_parent_id_idx',
    });
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('project_task_comments');
    if (!table.parent_id) return;
    await queryInterface
      .removeIndex('project_task_comments', 'project_task_comments_parent_id_idx')
      .catch(() => {});
    await queryInterface.removeColumn('project_task_comments', 'parent_id');
  },
};
