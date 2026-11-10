'use strict';

/**
 * 작업 보드 유형: GENERAL(기존 칸반) | RECURRING(정기 업무)
 * 기존 행은 GENERAL로 백필한다.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('work_boards');
    if (!table.board_type) {
      await queryInterface.addColumn('work_boards', 'board_type', {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'GENERAL',
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE work_boards
      SET board_type = 'GENERAL'
      WHERE board_type IS NULL
         OR board_type NOT IN ('GENERAL', 'RECURRING')
    `);

    try {
      await queryInterface.addIndex('work_boards', ['tenant_id', 'company_id', 'board_type'], {
        name: 'work_boards_tenant_company_board_type_idx',
      });
    } catch (e) {
      if (!String(e?.message || '').includes('already exists')) throw e;
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('work_boards');
    try {
      await queryInterface.removeIndex('work_boards', 'work_boards_tenant_company_board_type_idx');
    } catch {
      /* ignore */
    }
    if (table.board_type) {
      await queryInterface.removeColumn('work_boards', 'board_type');
    }
  },
};
