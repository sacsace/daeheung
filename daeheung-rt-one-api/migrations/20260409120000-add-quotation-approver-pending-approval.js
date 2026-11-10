'use strict';

/** 견적서: 승인자, 승인일, 상태값 pending_approval 추가 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'enum_quotations_status' AND e.enumlabel = 'pending_approval'
        ) THEN
          ALTER TYPE "enum_quotations_status" ADD VALUE 'pending_approval';
        END IF;
      END $$;
    `);

    const table = 'quotations';
    const desc = await queryInterface.describeTable(table);

    if (!desc.approver_user_id) {
      await queryInterface.addColumn(table, 'approver_user_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }

    if (!desc.approved_at) {
      await queryInterface.addColumn(table, 'approved_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    const indexes = await queryInterface.showIndex(table);
    const hasIdx = indexes.some((i) => i.name === 'quotations_approver_user_id_idx');
    if (!hasIdx) {
      await queryInterface.addIndex(table, ['approver_user_id'], {
        name: 'quotations_approver_user_id_idx'
      });
    }
  },

  down: async (queryInterface) => {
    const table = 'quotations';
    try {
      await queryInterface.removeIndex(table, 'quotations_approver_user_id_idx');
    } catch (_) {}
    const desc = await queryInterface.describeTable(table);
    if (desc.approved_at) await queryInterface.removeColumn(table, 'approved_at');
    if (desc.approver_user_id) await queryInterface.removeColumn(table, 'approver_user_id');
    // PostgreSQL: enum 값 제거는 생략
  }
};
