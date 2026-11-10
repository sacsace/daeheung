'use strict';

/** 미사용 회계 기본정보 관리 메뉴·API 제거 후 회계 하위 메뉴 순번 재정렬 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET is_active = false, updated_at = NOW()
      WHERE route = '/accounting/basic-info'
    `);

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

    const [parents] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id FROM menus WHERE route = '/accounting' AND parent_id IS NULL AND is_active = true
    `);

    for (const parent of parents) {
      for (const [route, order] of ACCOUNTING_CHILD_ORDER) {
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
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET is_active = true, updated_at = NOW()
      WHERE route = '/accounting/basic-info'
    `);

    const ACCOUNTING_CHILD_ORDER = [
      ['/accounting/basic-info', 1],
      ['/accounting/chart-of-accounts', 2],
      ['/accounting/settings/masters', 3],
      ['/accounting/voucher-entry', 4],
      ['/accounting/voucher-list', 5],
      ['/accounting/document-voucher', 6],
      ['/accounting/expense', 7],
      ['/accounting/books', 8],
      ['/accounting/budget', 9],
      ['/accounting/assets', 10],
      ['/accounting/profit-and-loss', 11],
      ['/accounting/statistics', 12],
    ];

    const [parents] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id FROM menus WHERE route = '/accounting' AND parent_id IS NULL
    `);

    for (const parent of parents) {
      for (const [route, order] of ACCOUNTING_CHILD_ORDER) {
        await queryInterface.sequelize.query(
          `UPDATE menus SET "order" = $1, updated_at = NOW() WHERE tenant_id = $2 AND route = $3`,
          { bind: [order, parent.tenant_id, route] }
        );
      }
    }
  },
};
