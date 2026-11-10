'use strict';

/**
 * 알람(/communication) 하위에 권한 관리용 메뉴 정리
 * 1. 알림 프로그램  /communication/desktop-notifier
 * 2. 알림          /notifications
 * 3. 공지사항      /my/notices  (부모를 알람으로 이동)
 */

const ALARM_PARENT = {
  route: '/communication',
  name_ko: '알람',
  name_en: 'Alarms',
  icon: 'notifications',
  order: 8,
  description: '알람 및 알림',
};

const CHILDREN = [
  {
    route: '/communication/desktop-notifier',
    name_ko: '알림 프로그램',
    name_en: 'Desktop Notifier',
    icon: 'download',
    order: 1,
    description: 'Windows 트레이 알림 프로그램 다운로드',
  },
  {
    route: '/notifications',
    name_ko: '알림',
    name_en: 'Notifications',
    icon: 'notifications',
    order: 2,
    description: '알림 확인 및 관리',
  },
  {
    route: '/my/notices',
    name_ko: '공지사항',
    name_en: 'Notices',
    icon: 'campaign',
    order: 3,
    description: '공지사항',
  },
];

async function upsertMenu(sequelize, { tenantId, parentId, level, menu }) {
  const [rows] = await sequelize.query(
    `SELECT id FROM menus WHERE tenant_id = $1 AND route = $2 LIMIT 1`,
    { bind: [tenantId, menu.route] }
  );

  if (rows.length) {
    const menuId = Number(rows[0].id);
    await sequelize.query(
      `UPDATE menus
       SET name_ko = $1, name_en = $2, icon = $3, "order" = $4,
           parent_id = $5, level = $6, is_active = true,
           description = $7, updated_at = NOW()
       WHERE id = $8`,
      {
        bind: [
          menu.name_ko,
          menu.name_en,
          menu.icon,
          menu.order,
          parentId,
          level,
          menu.description || menu.name_ko,
          menuId,
        ],
      }
    );
    return menuId;
  }

  const [ins] = await sequelize.query(
    `INSERT INTO menus
      (tenant_id, parent_id, level, name_ko, name_en, route, icon, "order", is_active, description, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,NOW(),NOW())
     RETURNING id`,
    {
      bind: [
        tenantId,
        parentId,
        level,
        menu.name_ko,
        menu.name_en,
        menu.route,
        menu.icon,
        menu.order,
        menu.description || menu.name_ko,
      ],
    }
  );
  return Number(ins[0].id);
}

async function ensureViewPermission(sequelize, menuId, tenantId) {
  await sequelize.query(
    `INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
     SELECT u.id, $1, true, false, false, false, NOW(), NOW()
     FROM users u
     WHERE u.tenant_id = $2 AND u.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM user_permissions up
         WHERE up.user_id = u.id AND up.menu_id = $1
       )`,
    { bind: [menuId, tenantId] }
  );
}

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const [tenants] = await sequelize.query(`SELECT id FROM tenants`);
    const tenantIds = (tenants || [])
      .map((t) => Number(t.id))
      .filter((id) => Number.isFinite(id));

    for (const tenantId of tenantIds) {
      const parentId = await upsertMenu(sequelize, {
        tenantId,
        parentId: null,
        level: 0,
        menu: ALARM_PARENT,
      });

      for (const child of CHILDREN) {
        const menuId = await upsertMenu(sequelize, {
          tenantId,
          parentId,
          level: 1,
          menu: child,
        });
        await ensureViewPermission(sequelize, menuId, tenantId);
      }

      // 레거시 communication 공지 경로는 중복 방지용으로 비활성
      await sequelize.query(
        `UPDATE menus
         SET is_active = false, updated_at = NOW()
         WHERE tenant_id = $1
           AND route IN ('/communication/notice', '/communication/notices')`,
        { bind: [tenantId] }
      );
    }
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const [tenants] = await sequelize.query(`SELECT id FROM tenants`);
    const tenantIds = (tenants || [])
      .map((t) => Number(t.id))
      .filter((id) => Number.isFinite(id));

    for (const tenantId of tenantIds) {
      const [myParents] = await sequelize.query(
        `SELECT id FROM menus
         WHERE tenant_id = $1 AND route = '/my' AND parent_id IS NULL
         LIMIT 1`,
        { bind: [tenantId] }
      );
      const myParentId = myParents.length ? Number(myParents[0].id) : null;

      if (myParentId) {
        await sequelize.query(
          `UPDATE menus
           SET parent_id = $1, level = 1, "order" = 7, is_active = true, updated_at = NOW()
           WHERE tenant_id = $2 AND route = '/my/notices'`,
          { bind: [myParentId, tenantId] }
        );
      }

      await sequelize.query(
        `UPDATE menus
         SET is_active = false, updated_at = NOW()
         WHERE tenant_id = $1 AND route = '/notifications'`,
        { bind: [tenantId] }
      );
    }
  },
};
