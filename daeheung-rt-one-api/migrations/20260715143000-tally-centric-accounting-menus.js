'use strict';

/**
 * 회계 메뉴를 Tally 임포트·조회 중심으로 재구성.
 * - Tally 임포트 / 회계장부 를 상단으로
 * - 수동 입력 메뉴(전표 입력·증빙·전표 조회·계정과목 CRUD) 비활성화
 * - 계정·전표 조회는 회계장부 탭에서 처리
 */

const ENSURE_MENUS = [
  {
    route: '/accounting/tally-import',
    name_ko: 'Tally 임포트',
    name_en: 'Tally Import',
    icon: 'upload_file',
    order: 1,
    description: 'Tally Export XML/JSON 임포트 (중복 검증)',
  },
];

const UPDATE_MENUS = [
  {
    route: '/accounting/books',
    name_ko: '회계장부',
    name_en: 'General Ledger',
    icon: 'menu_book',
    order: 2,
    description: 'Tally 전표·장부·시산표·계정 조회 및 장부 반영',
  },
];

const ACTIVE_ORDER = [
  ['/accounting/tally-import', 1],
  ['/accounting/books', 2],
  ['/accounting/expense', 3],
  ['/accounting/budget', 4],
  ['/accounting/assets', 5],
  ['/accounting/profit-and-loss', 6],
  ['/accounting/balance-sheet', 7],
  ['/accounting/statistics', 8],
  ['/accounting/settings/masters', 9],
];

const DEACTIVATE_ROUTES = [
  '/accounting/voucher-entry',
  '/accounting/voucher-list',
  '/accounting/document-voucher',
  '/accounting/chart-of-accounts',
  '/accounting/auto-voucher',
  '/accounting/vouchers',
  '/accounting/ledger',
  '/accounting/trial-balance',
];

module.exports = {
  async up(queryInterface) {
    const [parents] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id FROM menus WHERE route = '/accounting' AND parent_id IS NULL AND is_active = true
    `);

    for (const parent of parents) {
      for (const menu of ENSURE_MENUS) {
        const [existing] = await queryInterface.sequelize.query(
          `SELECT id FROM menus WHERE tenant_id = $1 AND route = $2 LIMIT 1`,
          { bind: [parent.tenant_id, menu.route] }
        );

        let menuId = existing[0]?.id;
        if (!menuId) {
          const [inserted] = await queryInterface.sequelize.query(
            `INSERT INTO menus (tenant_id, parent_id, name_ko, name_en, route, icon, "order", level, is_active, description, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 2, true, $8, NOW(), NOW())
             RETURNING id`,
            {
              bind: [
                parent.tenant_id,
                parent.id,
                menu.name_ko,
                menu.name_en,
                menu.route,
                menu.icon,
                menu.order,
                menu.description,
              ],
            }
          );
          menuId = inserted[0].id;
        } else {
          await queryInterface.sequelize.query(
            `UPDATE menus
             SET parent_id = $1, name_ko = $2, name_en = $3, icon = $4, "order" = $5,
                 description = $6, is_active = true, updated_at = NOW()
             WHERE id = $7`,
            {
              bind: [
                parent.id,
                menu.name_ko,
                menu.name_en,
                menu.icon,
                menu.order,
                menu.description,
                menuId,
              ],
            }
          );
        }

        const [accountingParentPerm] = await queryInterface.sequelize.query(
          `SELECT user_id, can_view, can_create, can_edit, can_delete FROM user_permissions WHERE menu_id = $1`,
          { bind: [parent.id] }
        );

        for (const perm of accountingParentPerm) {
          await queryInterface.sequelize.query(
            `INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
             SELECT $1, $2, $3, $4, $5, $6, NOW(), NOW()
             WHERE NOT EXISTS (SELECT 1 FROM user_permissions p WHERE p.user_id = $1 AND p.menu_id = $2)`,
            {
              bind: [
                perm.user_id,
                menuId,
                perm.can_view,
                perm.can_create,
                perm.can_edit,
                perm.can_delete,
              ],
            }
          );
        }
      }

      for (const menu of UPDATE_MENUS) {
        await queryInterface.sequelize.query(
          `UPDATE menus
           SET name_ko = $1, name_en = $2, icon = $3, "order" = $4, description = $5,
               is_active = true, parent_id = $6, updated_at = NOW()
           WHERE tenant_id = $7 AND route = $8`,
          {
            bind: [
              menu.name_ko,
              menu.name_en,
              menu.icon,
              menu.order,
              menu.description,
              parent.id,
              parent.tenant_id,
              menu.route,
            ],
          }
        );
      }

      for (const [route, order] of ACTIVE_ORDER) {
        await queryInterface.sequelize.query(
          `UPDATE menus SET "order" = $1, is_active = true, updated_at = NOW()
           WHERE tenant_id = $2 AND route = $3 AND parent_id = $4`,
          { bind: [order, parent.tenant_id, route, parent.id] }
        );
      }

      for (const route of DEACTIVATE_ROUTES) {
        await queryInterface.sequelize.query(
          `UPDATE menus SET is_active = false, "order" = 90, updated_at = NOW()
           WHERE tenant_id = $1 AND route = $2`,
          { bind: [parent.tenant_id, route] }
        );
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus SET is_active = false, updated_at = NOW() WHERE route = '/accounting/tally-import'
    `);

    const restore = [
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
      ['/accounting/balance-sheet', 11],
      ['/accounting/statistics', 12],
    ];

    for (const [route, order] of restore) {
      await queryInterface.sequelize.query(
        `UPDATE menus SET is_active = true, "order" = $1, updated_at = NOW() WHERE route = $2`,
        { bind: [order, route] }
      );
    }
  },
};
