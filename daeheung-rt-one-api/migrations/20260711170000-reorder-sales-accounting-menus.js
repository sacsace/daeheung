'use strict';

/**
 * 매출 관리·회계 관리 하위 메뉴를 업무 흐름별로 재정렬
 *
 * 매출: 고객 → 견적 → 계약 → 세금계산서 → 운송장
 * 회계: 기본설정 → 전표업무 → 장부 → 예산·자산 → 보고·통계
 */
module.exports = {
  async up(queryInterface) {
    const SALES_CHILD_ORDER = [
      ['/customers/info', 1],
      ['/accounting/quotation', 2],
      ['/customers/contracts', 3],
      ['/accounting/e-invoice', 4],
      ['/accounting/invoice', 5],
      ['/accounting/eway-bill', 6],
    ];

    const ACCOUNTING_CHILD_ORDER = [
      ['/accounting/chart-of-accounts', 1],
      ['/accounting/settings/masters', 2],
      ['/accounting/voucher-entry', 3],
      ['/accounting/voucher-list', 4],
      ['/accounting/document-voucher', 5],
      ['/accounting/expense', 6],
      ['/accounting/books', 7],
      ['/accounting/budget', 8],
      ['/accounting/assets', 9],
      ['/accounting/profit-and-loss', 10],
      ['/accounting/statistics', 11],
    ];

    const LEGACY_ACCOUNTING_ORDER = [
      ['/accounting/auto-voucher', 94],
      ['/accounting/vouchers', 95],
      ['/accounting/ledger', 96],
      ['/accounting/trial-balance', 97],
    ];

    const [tenants] = await queryInterface.sequelize.query(`
      SELECT DISTINCT tenant_id FROM menus WHERE route IN ('/sales', '/accounting')
    `);

    for (const { tenant_id: tenantId } of tenants) {
      const [[salesParent]] = await queryInterface.sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = '/sales' AND parent_id IS NULL AND is_active = true LIMIT 1`,
        { bind: [tenantId] }
      );
      const [[accountingParent]] = await queryInterface.sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = '/accounting' AND parent_id IS NULL AND is_active = true LIMIT 1`,
        { bind: [tenantId] }
      );

      if (salesParent?.id) {
        for (const [route, order] of SALES_CHILD_ORDER) {
          await queryInterface.sequelize.query(
            `
            UPDATE menus
            SET parent_id = $1, "order" = $2, level = 2, updated_at = NOW()
            WHERE tenant_id = $3 AND route = $4 AND is_active = true
            `,
            { bind: [salesParent.id, order, tenantId, route] }
          );
        }
      }

      if (accountingParent?.id) {
        for (const [route, order] of [...ACCOUNTING_CHILD_ORDER, ...LEGACY_ACCOUNTING_ORDER]) {
          await queryInterface.sequelize.query(
            `
            UPDATE menus
            SET parent_id = $1, "order" = $2, level = 2, updated_at = NOW()
            WHERE tenant_id = $3 AND route = $4 AND is_active = true
            `,
            { bind: [accountingParent.id, order, tenantId, route] }
          );
        }
      }
    }
  },

  async down(queryInterface) {
    const SALES_CHILD_ORDER = [
      ['/customers/info', 1],
      ['/customers/contracts', 2],
      ['/accounting/quotation', 3],
      ['/accounting/e-invoice', 4],
      ['/accounting/invoice', 5],
      ['/accounting/eway-bill', 6],
    ];

    const ACCOUNTING_CHILD_ORDER = [
      ['/accounting/basic-info', 1],
      ['/accounting/books', 2],
      ['/accounting/chart-of-accounts', 3],
      ['/accounting/voucher-entry', 4],
      ['/accounting/expense', 5],
      ['/accounting/voucher-list', 6],
      ['/accounting/budget', 7],
      ['/accounting/profit-and-loss', 8],
      ['/accounting/assets', 9],
      ['/accounting/statistics', 10],
      ['/accounting/settings/masters', 11],
      ['/accounting/document-voucher', 12],
    ];

    const [tenants] = await queryInterface.sequelize.query(`
      SELECT DISTINCT tenant_id FROM menus WHERE route IN ('/sales', '/accounting')
    `);

    for (const { tenant_id: tenantId } of tenants) {
      const [[salesParent]] = await queryInterface.sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = '/sales' AND parent_id IS NULL LIMIT 1`,
        { bind: [tenantId] }
      );
      const [[accountingParent]] = await queryInterface.sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = '/accounting' AND parent_id IS NULL LIMIT 1`,
        { bind: [tenantId] }
      );

      if (salesParent?.id) {
        for (const [route, order] of SALES_CHILD_ORDER) {
          await queryInterface.sequelize.query(
            `UPDATE menus SET "order" = $1, updated_at = NOW() WHERE tenant_id = $2 AND route = $3`,
            { bind: [order, tenantId, route] }
          );
        }
      }

      if (accountingParent?.id) {
        for (const [route, order] of ACCOUNTING_CHILD_ORDER) {
          await queryInterface.sequelize.query(
            `UPDATE menus SET "order" = $1, updated_at = NOW() WHERE tenant_id = $2 AND route = $3`,
            { bind: [order, tenantId, route] }
          );
        }
      }
    }
  },
};
