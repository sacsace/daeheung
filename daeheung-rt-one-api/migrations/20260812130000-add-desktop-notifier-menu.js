'use strict';

/** 소식(커뮤니케이션) 하위에 알림 프로그램 다운로드 메뉴 추가 */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const [parents] = await sequelize.query(`
      SELECT id, tenant_id FROM menus
      WHERE route = '/communication' AND parent_id IS NULL AND is_active = true
    `);

    for (const parent of parents || []) {
      const tenantId = Number(parent.tenant_id);
      const parentId = Number(parent.id);

      const [existing] = await sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = $2 LIMIT 1`,
        { bind: [tenantId, '/communication/desktop-notifier'] }
      );

      let menuId;
      if (existing.length) {
        menuId = Number(existing[0].id);
        await sequelize.query(
          `UPDATE menus
           SET name_ko = $1, name_en = $2, icon = $3, parent_id = $4, level = 1,
               "order" = 4, is_active = true, description = $5, updated_at = NOW()
           WHERE id = $6`,
          {
            bind: [
              '알림 프로그램',
              'Desktop Notifier',
              'download',
              parentId,
              'Windows 트레이 알림 프로그램 다운로드',
              menuId,
            ],
          }
        );
      } else {
        const [ins] = await sequelize.query(
          `INSERT INTO menus
            (tenant_id, parent_id, level, name_ko, name_en, route, icon, "order", is_active, description, created_at, updated_at)
           VALUES ($1,$2,1,$3,$4,$5,$6,4,true,$7,NOW(),NOW())
           RETURNING id`,
          {
            bind: [
              tenantId,
              parentId,
              '알림 프로그램',
              'Desktop Notifier',
              '/communication/desktop-notifier',
              'download',
              'Windows 트레이 알림 프로그램 다운로드',
            ],
          }
        );
        menuId = Number(ins[0].id);
      }

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
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE menus SET is_active = false, updated_at = NOW()
      WHERE route = '/communication/desktop-notifier'
    `);
  },
};
