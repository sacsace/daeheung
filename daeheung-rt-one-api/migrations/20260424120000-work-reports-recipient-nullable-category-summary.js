'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('work_reports');

    if (!table.recipient_id) {
      await queryInterface.addColumn('work_reports', 'recipient_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
      await queryInterface.addIndex('work_reports', ['recipient_id'], {
        name: 'work_reports_recipient_id_idx'
      });
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE work_reports ALTER COLUMN category DROP NOT NULL;
      ALTER TABLE work_reports ALTER COLUMN category SET DEFAULT '';
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE work_reports ALTER COLUMN summary DROP NOT NULL;
      ALTER TABLE work_reports ALTER COLUMN summary SET DEFAULT '';
    `);
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('work_reports');
    if (table.recipient_id) {
      await queryInterface.removeIndex('work_reports', 'work_reports_recipient_id_idx').catch(() => {});
      await queryInterface.removeColumn('work_reports', 'recipient_id');
    }
    await queryInterface.sequelize.query(`
      UPDATE work_reports SET category = '' WHERE category IS NULL;
      UPDATE work_reports SET summary = '' WHERE summary IS NULL;
      ALTER TABLE work_reports ALTER COLUMN category SET NOT NULL;
      ALTER TABLE work_reports ALTER COLUMN summary SET NOT NULL;
    `);
  }
};
