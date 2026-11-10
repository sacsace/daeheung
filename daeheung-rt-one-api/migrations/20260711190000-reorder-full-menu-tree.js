'use strict';

/**
 * 전체 메뉴 트리 순서 재정렬
 *
 * 대분류: 대시보드 → 기본정보 → 인사 → 업무 → 매출 → 재고 → 회계 → 소통 → AI → 보고 → 호텔 → 시스템
 * 하위: 각 영역별 업무 흐름(설정 → 일상업무 → 조회·통계) 순
 */
const ROOT_MENU_ORDER = [
  ['/dashboard', 1],
  ['/basic-info', 2],
  ['/hr', 3],
  ['/work', 4],
  ['/sales', 5],
  ['/inventory', 6],
  ['/accounting', 7],
  ['/communication', 8],
  ['/ai', 9],
  ['/reports', 10],
  ['/hotel', 11],
  ['/system', 12],
  ['/customers', 98],
];

const CHILD_MENU_ORDERS = {
  '/basic-info': [
    ['/basic-info/company', 1],
    ['/basic-info/partners', 2],
    ['/basic-info/organization', 3],
    ['/basic-info/menu-permissions', 4],
    ['/basic-info/login-info', 5],
    ['/basic-info/system-settings', 6],
    ['/basic-info/mail-send-test', 7],
  ],
  '/hr': [
    ['/hr/users', 1],
    ['/hr/employment-contracts', 2],
    ['/hr/attendance', 3],
    ['/hr/attendance/statistics', 4],
    ['/hr/leave', 5],
    ['/hr/payroll', 6],
  ],
  '/work': [
    ['/work/projects', 1],
    ['/work/approval', 2],
    ['/work/reports', 3],
    ['/work/statistics', 4],
  ],
  '/sales': [
    ['/customers/info', 1],
    ['/accounting/quotation', 2],
    ['/customers/contracts', 3],
    ['/accounting/e-invoice', 4],
    ['/accounting/invoice', 5],
    ['/accounting/eway-bill', 6],
  ],
  '/inventory': [
    ['/inventory/basic', 1],
    ['/inventory/status', 2],
    ['/inventory/stock-in', 3],
    ['/inventory/stock-out', 4],
    ['/inventory/report', 5],
  ],
  '/accounting': [
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
    ['/accounting/auto-voucher', 90],
    ['/accounting/vouchers', 91],
    ['/accounting/ledger', 92],
    ['/accounting/trial-balance', 93],
  ],
  '/communication': [
    ['/communication/notice', 1],
    ['/communication/notices', 2],
    ['/communication/email', 3],
    ['/communication/sms', 4],
  ],
  '/ai': [
    ['/ai/cost-analysis', 1],
    ['/ai/efficiency-metrics', 2],
    ['/ai/forecasting-data', 3],
    ['/ai/recommendation-engine', 4],
  ],
  '/reports': [
    ['/reports/sales', 1],
    ['/reports/inventory', 2],
    ['/reports/customers', 3],
    ['/reports/financial', 4],
    ['/reports/ai', 5],
  ],
  '/hotel': [
    ['/hotel/front-desk', 1],
    ['/hotel/room-reservation', 2],
    ['/hotel/reservations', 3],
    ['/hotel/room-types', 4],
    ['/hotel/housekeeping', 5],
    ['/hotel/fnb', 6],
  ],
};

const DEACTIVATE_ROUTES = [
  '/work/quotation',
  '/accounting/basic-info',
  '/customers',
];

async function applyRootOrders(queryInterface) {
  for (const [route, order] of ROOT_MENU_ORDER) {
    await queryInterface.sequelize.query(
      `
      UPDATE menus
      SET "order" = $1, updated_at = NOW()
      WHERE parent_id IS NULL AND route = $2
      `,
      { bind: [order, route] }
    );
  }
}

async function applyChildOrders(queryInterface, parentRoute, childOrders) {
  const [parents] = await queryInterface.sequelize.query(
    `
    SELECT id, tenant_id FROM menus
    WHERE route = $1 AND parent_id IS NULL
    `,
    { bind: [parentRoute] }
  );

  for (const parent of parents) {
    for (const [route, order] of childOrders) {
      await queryInterface.sequelize.query(
        `
        UPDATE menus
        SET parent_id = $1, "order" = $2, level = 2, updated_at = NOW()
        WHERE tenant_id = $3 AND route = $4 AND is_active = true
        `,
        { bind: [parent.id, order, parent.tenant_id, route] }
      );
    }
  }
}

module.exports = {
  async up(queryInterface) {
    for (const route of DEACTIVATE_ROUTES) {
      await queryInterface.sequelize.query(
        `
        UPDATE menus
        SET is_active = false, updated_at = NOW()
        WHERE route = $1
        `,
        { bind: [route] }
      );
    }

    await applyRootOrders(queryInterface);

    for (const [parentRoute, childOrders] of Object.entries(CHILD_MENU_ORDERS)) {
      await applyChildOrders(queryInterface, parentRoute, childOrders);
    }
  },

  async down() {},
};
