'use strict';

/**
 * Task 진행 설명 / 첨부 / 댓글
 * Soft-delete: comments paranoid + deleted_at
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const taskTable = await queryInterface.describeTable('project_tasks');
    if (!taskTable.progress_note) {
      await queryInterface.addColumn('project_tasks', 'progress_note', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!taskTable.attachments) {
      await queryInterface.addColumn('project_tasks', 'attachments', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      });
    }

    await queryInterface.createTable('project_task_comments', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      task_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'project_tasks', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      content: { type: Sequelize.TEXT, allowNull: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('project_task_comments', ['task_id', 'created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('project_task_comments');
    const taskTable = await queryInterface.describeTable('project_tasks');
    if (taskTable.attachments) {
      await queryInterface.removeColumn('project_tasks', 'attachments');
    }
    if (taskTable.progress_note) {
      await queryInterface.removeColumn('project_tasks', 'progress_note');
    }
  },
};
