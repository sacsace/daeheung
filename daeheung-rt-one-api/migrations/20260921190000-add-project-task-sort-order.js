'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('project_tasks');
    if (!table.sort_order) {
      await queryInterface.addColumn('project_tasks', 'sort_order', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
      await queryInterface.sequelize.query(`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY id ASC) - 1 AS rn
          FROM project_tasks
          WHERE deleted_at IS NULL
        )
        UPDATE project_tasks AS t
        SET sort_order = ranked.rn
        FROM ranked
        WHERE t.id = ranked.id
      `);
      await queryInterface.addIndex('project_tasks', ['project_id', 'sort_order']);
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('project_tasks');
    if (table.sort_order) {
      await queryInterface.removeColumn('project_tasks', 'sort_order');
    }
  },
};
