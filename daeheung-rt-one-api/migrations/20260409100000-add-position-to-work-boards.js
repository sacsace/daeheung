'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('work_boards');
    if (!table.position) {
      await queryInterface.addColumn('work_boards', 'position', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      });
    }

    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT id,
          ROW_NUMBER() OVER (
            PARTITION BY tenant_id, company_id
            ORDER BY created_at DESC, id DESC
          ) - 1 AS pos
        FROM work_boards
      )
      UPDATE work_boards wb
      SET position = ranked.pos
      FROM ranked
      WHERE wb.id = ranked.id
    `);
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('work_boards');
    if (table.position) {
      await queryInterface.removeColumn('work_boards', 'position');
    }
  }
};
