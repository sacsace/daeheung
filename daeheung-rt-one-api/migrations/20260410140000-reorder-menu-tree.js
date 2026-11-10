'use strict';

/**
 * 메뉴 트리 정렬 재조정
 * - 대분류: 업무 흐름(대시보드 → 기본정보 → 인사·업무 → 영업·재고·회계 → 부가)
 * - 하위: 기능 단위로 인접 배치(예: HR은 사용자·계약 → 근태·통계 → 휴가·급여)
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET
        "order" = CASE route
          WHEN '/dashboard' THEN 1
          WHEN '/basic-info' THEN 2
          WHEN '/hr' THEN 3
          WHEN '/work' THEN 4
          WHEN '/customers' THEN 5
          WHEN '/inventory' THEN 6
          WHEN '/accounting' THEN 7
          WHEN '/communication' THEN 8
          WHEN '/ai' THEN 9
          WHEN '/reports' THEN 10
          WHEN '/hotel' THEN 11
        END,
        updated_at = NOW()
      WHERE parent_id IS NULL
        AND route IN (
          '/dashboard', '/basic-info', '/hr', '/work', '/customers', '/inventory',
          '/accounting', '/communication', '/ai', '/reports', '/hotel'
        )
    `);

    await queryInterface.sequelize.query(`
      UPDATE menus
      SET
        "order" = CASE route
          WHEN '/basic-info/company' THEN 1
          WHEN '/basic-info/partners' THEN 2
          WHEN '/basic-info/organization' THEN 3
          WHEN '/basic-info/menu-permissions' THEN 4
          WHEN '/basic-info/login-info' THEN 5
          WHEN '/basic-info/system-settings' THEN 6

          WHEN '/hr/users' THEN 1
          WHEN '/hr/employment-contracts' THEN 2
          WHEN '/hr/attendance' THEN 3
          WHEN '/hr/attendance/statistics' THEN 4
          WHEN '/hr/leave' THEN 5
          WHEN '/hr/payroll' THEN 6

          WHEN '/work/projects' THEN 1
          WHEN '/work/approval' THEN 2
          WHEN '/work/statistics' THEN 3
          WHEN '/work/reports' THEN 4
          WHEN '/work/room-reservation' THEN 5
          WHEN '/work/quotation' THEN 6

          WHEN '/hotel/front-desk' THEN 1
          WHEN '/hotel/housekeeping' THEN 2
          WHEN '/hotel/fnb' THEN 3
          WHEN '/hotel/reservations' THEN 4
          WHEN '/hotel/room-types' THEN 5
          WHEN '/hotel/room-reservation' THEN 6

          WHEN '/inventory/basic' THEN 1
          WHEN '/inventory/status' THEN 2
          WHEN '/inventory/stock-in' THEN 3
          WHEN '/inventory/stock-out' THEN 4
          WHEN '/inventory/report' THEN 5

          WHEN '/customers/info' THEN 1
          WHEN '/customers/contracts' THEN 2
          WHEN '/customers/support' THEN 3

          WHEN '/accounting/basic-info' THEN 1
          WHEN '/accounting/quotation' THEN 2
          WHEN '/accounting/e-invoice' THEN 3
          WHEN '/accounting/invoice' THEN 4
          WHEN '/accounting/eway-bill' THEN 5
          WHEN '/accounting/expense' THEN 6
          WHEN '/accounting/budget' THEN 7
          WHEN '/accounting/assets' THEN 8
          WHEN '/accounting/statistics' THEN 9

          WHEN '/communication/notice' THEN 1
          WHEN '/communication/notices' THEN 1
          WHEN '/communication/email' THEN 2
          WHEN '/communication/sms' THEN 3

          WHEN '/ai/cost-analysis' THEN 1
          WHEN '/ai/efficiency-metrics' THEN 2
          WHEN '/ai/forecasting-data' THEN 3
          WHEN '/ai/recommendation-engine' THEN 4

          WHEN '/reports/sales' THEN 1
          WHEN '/reports/inventory' THEN 2
          WHEN '/reports/customers' THEN 3
          WHEN '/reports/financial' THEN 4
          WHEN '/reports/ai' THEN 5
        END,
        updated_at = NOW()
      WHERE route IN (
        '/basic-info/company', '/basic-info/partners', '/basic-info/organization',
        '/basic-info/menu-permissions', '/basic-info/login-info', '/basic-info/system-settings',
        '/hr/users', '/hr/employment-contracts', '/hr/attendance', '/hr/attendance/statistics',
        '/hr/leave', '/hr/payroll',
        '/work/projects', '/work/approval', '/work/statistics', '/work/reports',
        '/work/room-reservation', '/work/quotation',
        '/hotel/front-desk', '/hotel/housekeeping', '/hotel/fnb', '/hotel/reservations',
        '/hotel/room-types', '/hotel/room-reservation',
        '/inventory/basic', '/inventory/status', '/inventory/stock-in', '/inventory/stock-out', '/inventory/report',
        '/customers/info', '/customers/contracts', '/customers/support',
        '/accounting/basic-info', '/accounting/quotation', '/accounting/e-invoice', '/accounting/invoice',
        '/accounting/eway-bill', '/accounting/expense', '/accounting/budget', '/accounting/assets', '/accounting/statistics',
        '/communication/notice', '/communication/notices', '/communication/email', '/communication/sms',
        '/ai/cost-analysis', '/ai/efficiency-metrics', '/ai/forecasting-data', '/ai/recommendation-engine',
        '/reports/sales', '/reports/inventory', '/reports/customers', '/reports/financial', '/reports/ai'
      )
    `);
  },

  async down() {}
};
