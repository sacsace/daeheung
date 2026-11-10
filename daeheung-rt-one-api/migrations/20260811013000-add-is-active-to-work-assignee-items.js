'use strict';

/** work_assignee_items: 물리 삭제 대신 is_active로 소프트 삭제 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('work_assignee_items');
    if (!desc.is_active) {
      await queryInterface.addColumn('work_assignee_items', 'is_active', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }
    try {
      await queryInterface.addIndex('work_assignee_items', ['assignee_id', 'is_active'], {
        name: 'work_assignee_items_assignee_active_idx',
      });
    } catch (e) {
      // index may already exist
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex(
        'work_assignee_items',
        'work_assignee_items_assignee_active_idx'
      );
    } catch (e) {
      // ignore
    }
    const desc = await queryInterface.describeTable('work_assignee_items');
    if (desc.is_active) {
      await queryInterface.removeColumn('work_assignee_items', 'is_active');
    }
  },
};
