'use strict';

/**
 * 업무관리 하위 "프로젝트 관리" 메뉴
 * 기간 단위 프로젝트 (/work/project-management) — 칸반 업무보드(/work/projects)와 별개
 */
const MENU = {
  route: '/work/project-management',
  nameKo: '프로젝트 관리',
  nameEn: 'Project Management',
  icon: 'folder_special',
  order: 2,
  description: '기간 단위로 진행하는 프로젝트 등록·조회·관리',
};

module.exports = {
  async up(queryInterface) {
    const [parents] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id
      FROM menus
      WHERE route = '/work' AND parent_id IS NULL AND is_active = true
    `);

    for (const parent of parents) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = $2 LIMIT 1`,
        { bind: [parent.tenant_id, MENU.route] }
      );

      let menuId = existing[0]?.id;
      if (!menuId) {
        await queryInterface.sequelize.query(
          `
          UPDATE menus
          SET "order" = "order" + 1, updated_at = NOW()
          WHERE tenant_id = $1 AND parent_id = $2 AND "order" >= $3
          `,
          { bind: [parent.tenant_id, parent.id, MENU.order] }
        );

        const [inserted] = await queryInterface.sequelize.query(
          `INSERT INTO menus
            (tenant_id, parent_id, name_ko, name_en, route, icon, "order", level, is_active, description, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 2, true, $8, NOW(), NOW())
           RETURNING id`,
          {
            bind: [
              parent.tenant_id,
              parent.id,
              MENU.nameKo,
              MENU.nameEn,
              MENU.route,
              MENU.icon,
              MENU.order,
              MENU.description,
            ],
          }
        );
        menuId = inserted[0].id;
      } else {
        await queryInterface.sequelize.query(
          `UPDATE menus
           SET parent_id = $1, name_ko = $2, name_en = $3, icon = $4, "order" = $5,
               level = 2, is_active = true, description = $6, updated_at = NOW()
           WHERE id = $7`,
          {
            bind: [
              parent.id,
              MENU.nameKo,
              MENU.nameEn,
              MENU.icon,
              MENU.order,
              MENU.description,
              menuId,
            ],
          }
        );
      }

      const [parentPermissions] = await queryInterface.sequelize.query(
        `SELECT user_id, can_view, can_create, can_edit, can_delete
         FROM user_permissions WHERE menu_id = $1`,
        { bind: [parent.id] }
      );
      for (const permission of parentPermissions) {
        await queryInterface.sequelize.query(
          `INSERT INTO user_permissions
            (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
           SELECT $1, $2, $3, $4, $5, $6, NOW(), NOW()
           WHERE NOT EXISTS (
             SELECT 1 FROM user_permissions WHERE user_id = $1 AND menu_id = $2
           )`,
          {
            bind: [
              permission.user_id,
              menuId,
              permission.can_view,
              permission.can_create,
              permission.can_edit,
              permission.can_delete,
            ],
          }
        );
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM user_permissions WHERE menu_id IN (
        SELECT id FROM menus WHERE route = '/work/project-management'
      )
    `);
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET is_active = false, updated_at = NOW()
      WHERE route = '/work/project-management'
    `);
  },
};
