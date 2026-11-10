'use strict';

/** notice_polls: 투표 시작 시각(opens_at) */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('notice_polls').catch(() => null);
    if (!table) return;
    if (!table.opens_at) {
      await queryInterface.addColumn('notice_polls', 'opens_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('notice_polls').catch(() => null);
    if (!table || !table.opens_at) return;
    await queryInterface.removeColumn('notice_polls', 'opens_at');
  },
};
