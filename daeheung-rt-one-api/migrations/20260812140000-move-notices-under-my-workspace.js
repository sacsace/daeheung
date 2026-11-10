'use strict';

/**
 * 공지사항 메뉴를 「내 정보·업무」(/my/notices)로 통일.
 * - /communication 상위는 「소식」으로 복원 (알림 프로그램 등 하위용)
 * - /communication/notice(s) 는 soft-deactivate
 * - 기존 공지 권한은 /my/notices 로 이전
 */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    await sequelize.query(`
      UPDATE menus
      SET name_ko = '소식',
          name_en = 'Updates',
          description = '소식 및 알림',
          updated_at = NOW()
      WHERE route = '/communication' AND parent_id IS NULL AND is_active = true
    `);

    await sequelize.query(`
      UPDATE menus
      SET is_active = false, updated_at = NOW()
      WHERE route IN ('/communication/notice', '/communication/notices')
        AND is_active = true
    `);

    const [tenants] = await sequelize.query(`SELECT id FROM tenants`);
    for (const t of tenants || []) {
      const tenantId = Number(t.id);

      const [myParents] = await sequelize.query(
        `SELECT id FROM menus
         WHERE tenant_id = $1 AND route = '/my' AND parent_id IS NULL AND is_active = true
         ORDER BY id ASC LIMIT 1`,
        { bind: [tenantId] }
      );
      if (!myParents.length) continue;
      const myParentId = Number(myParents[0].id);

      const [existing] = await sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = '/my/notices' LIMIT 1`,
        { bind: [tenantId] }
      );

      let myNoticesId;
      if (existing.length) {
        myNoticesId = Number(existing[0].id);
        await sequelize.query(
          `UPDATE menus
           SET name_ko = '공지사항', name_en = 'Notices', icon = 'campaign',
               parent_id = $1, level = 1, "order" = 5, is_active = true,
               description = '공지사항', updated_at = NOW()
           WHERE id = $2`,
          { bind: [myParentId, myNoticesId] }
        );
      } else {
        const [ins] = await sequelize.query(
          `INSERT INTO menus
            (tenant_id, parent_id, level, name_ko, name_en, route, icon, "order", is_active, description, created_at, updated_at)
           VALUES ($1,$2,1,'공지사항','Notices','/my/notices','campaign',5,true,'공지사항',NOW(),NOW())
           RETURNING id`,
          { bind: [tenantId, myParentId] }
        );
        myNoticesId = Number(ins[0].id);
      }

      // 기존 communication 공지 권한이 있으면 /my/notices 로 이전·병합
      await sequelize.query(
        `INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
         SELECT up.user_id, $1,
                BOOL_OR(up.can_view), BOOL_OR(up.can_create), BOOL_OR(up.can_edit), BOOL_OR(up.can_delete),
                NOW(), NOW()
         FROM user_permissions up
         JOIN menus m ON m.id = up.menu_id
         JOIN users u ON u.id = up.user_id
         WHERE u.tenant_id = $2
           AND m.route IN ('/communication/notice', '/communication/notices', '/communication')
           AND (up.can_view OR up.can_create OR up.can_edit OR up.can_delete)
           AND NOT EXISTS (
             SELECT 1 FROM user_permissions x
             WHERE x.user_id = up.user_id AND x.menu_id = $1
           )
         GROUP BY up.user_id`,
        { bind: [myNoticesId, tenantId] }
      );

      await sequelize.query(
        `UPDATE user_permissions dest
         SET can_view = dest.can_view OR src.can_view,
             can_create = dest.can_create OR src.can_create,
             can_edit = dest.can_edit OR src.can_edit,
             can_delete = dest.can_delete OR src.can_delete,
             updated_at = NOW()
         FROM user_permissions src
         JOIN menus m ON m.id = src.menu_id
         JOIN users u ON u.id = src.user_id
         WHERE dest.user_id = src.user_id
           AND dest.menu_id = $1
           AND u.tenant_id = $2
           AND m.route IN ('/communication/notice', '/communication/notices', '/communication')`,
        { bind: [myNoticesId, tenantId] }
      );

      // 일반 user 기본 can_view
      await sequelize.query(
        `INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
         SELECT u.id, $1, true, false, false, false, NOW(), NOW()
         FROM users u
         WHERE u.tenant_id = $2 AND u.role = 'user' AND u.status = 'active'
           AND NOT EXISTS (
             SELECT 1 FROM user_permissions up
             WHERE up.user_id = u.id AND up.menu_id = $1
           )`,
        { bind: [myNoticesId, tenantId] }
      );
    }
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    await sequelize.query(`
      UPDATE menus
      SET name_ko = '공지사항',
          name_en = 'Notices',
          description = '공지 및 알림 관리',
          updated_at = NOW()
      WHERE route = '/communication' AND parent_id IS NULL
    `);
    await sequelize.query(`
      UPDATE menus
      SET is_active = true, updated_at = NOW()
      WHERE route IN ('/communication/notice', '/communication/notices')
    `);
  },
};
