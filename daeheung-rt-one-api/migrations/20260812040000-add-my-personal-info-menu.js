'use strict';

/** 내 업무 > 개인 정보 메뉴 + user 기본 보기 권한 */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    const [parents] = await sequelize.query(`
      SELECT id, tenant_id FROM menus
      WHERE route = '/my' AND parent_id IS NULL
    `);

    for (const parent of parents) {
      const tenantId = parent.tenant_id;
      const parentId = parent.id;

      await sequelize.query(
        `
        UPDATE menus
        SET "order" = "order" + 1, updated_at = NOW()
        WHERE tenant_id = $1 AND parent_id = $2 AND "order" >= 1
        `,
        { bind: [tenantId, parentId] }
      );

      const [existing] = await sequelize.query(
        `
        SELECT id FROM menus
        WHERE tenant_id = $1 AND route = '/my/personal-info'
        LIMIT 1
        `,
        { bind: [tenantId] }
      );

      let menuId;
      if (existing.length > 0) {
        menuId = existing[0].id;
        await sequelize.query(
          `
          UPDATE menus
          SET parent_id = $2, name_ko = $3, name_en = $4, icon = $5, "order" = 1,
              level = 1, is_active = true, description = $6, updated_at = NOW()
          WHERE id = $1
          `,
          {
            bind: [
              menuId,
              parentId,
              '개인 정보',
              'Personal Information',
              'person',
              '본인 개인정보 확인·수정',
            ],
          }
        );
      } else {
        const [ins] = await sequelize.query(
          `
          INSERT INTO menus (
            tenant_id, parent_id, name_ko, name_en, route, icon, "order", level,
            is_active, description, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, '/my/personal-info', $5, 1, 1, true, $6, NOW(), NOW()
          )
          RETURNING id
          `,
          {
            bind: [
              tenantId,
              parentId,
              '개인 정보',
              'Personal Information',
              'person',
              '본인 개인정보 확인·수정',
            ],
          }
        );
        menuId = ins[0].id;
      }

      await sequelize.query(
        `
        INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
        SELECT u.id, $1, true, false, false, false, NOW(), NOW()
        FROM users u
        WHERE u.tenant_id = $2
          AND u.role = 'user'
          AND COALESCE(u.status, 'active') <> 'inactive'
          AND NOT EXISTS (
            SELECT 1 FROM user_permissions p WHERE p.user_id = u.id AND p.menu_id = $1
          )
        `,
        { bind: [menuId, tenantId] }
      );

      await sequelize.query(
        `
        INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
        SELECT u.id, $1, true, true, true, true, NOW(), NOW()
        FROM users u
        WHERE u.tenant_id = $2
          AND u.role = 'admin'
          AND NOT EXISTS (
            SELECT 1 FROM user_permissions p WHERE p.user_id = u.id AND p.menu_id = $1
          )
        `,
        { bind: [menuId, tenantId] }
      );
    }
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    await sequelize.query(`
      DELETE FROM user_permissions WHERE menu_id IN (
        SELECT id FROM menus WHERE route = '/my/personal-info'
      )
    `);
    await sequelize.query(`
      DELETE FROM menus WHERE route = '/my/personal-info'
    `);
  },
};
