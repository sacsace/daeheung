'use strict';

/**
 * Dashboard 응답 속도 개선용 인덱스.
 * - 통계/추이/재고/내 할 일 API에서 자주 사용하는 필터 컬럼 중심
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_tenant_active_payment_created
      ON invoices (tenant_id, is_active, payment_status, created_at);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_tenant_active_status_created
      ON invoices (tenant_id, is_active, status, created_at);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_bookings_tenant_paid_active_checkin
      ON room_bookings (tenant_id, payment_status, is_active, check_in_date);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_tenant_stock_qty
      ON products (tenant_id, stock_quantity);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_tenant_company_status
      ON users (tenant_id, company_id, status);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_board_members_user_board
      ON work_board_members (user_id, board_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_board_cards_assignee_due_list
      ON work_board_cards (assignee_user_id, due_date, list_id);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS idx_work_board_cards_assignee_due_list;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS idx_work_board_members_user_board;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS idx_users_tenant_company_status;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS idx_products_tenant_stock_qty;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS idx_room_bookings_tenant_paid_active_checkin;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS idx_invoices_tenant_active_status_created;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX CONCURRENTLY IF EXISTS idx_invoices_tenant_active_payment_created;
    `);
  },
};

