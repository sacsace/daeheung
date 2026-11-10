'use strict';

/**
 * 일반 user에게 업무 관리(/work/projects) 보기 권한 부여.
 * 화면에서는 본인 담당·작성 카드만 보이도록 FE에서 필터한다.
 */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    const [menus] = await sequelize.query(`
      SELECT id, tenant_id FROM menus
      WHERE route = '/work/projects' AND is_active = true
    `);

    for (const menu of menus) {
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
        { bind: [menu.id, menu.tenant_id] }
      );
    }
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    await sequelize.query(`
      DELETE FROM user_permissions
      WHERE can_view = true
        AND can_create = false
        AND can_edit = false
        AND can_delete = false
        AND menu_id IN (SELECT id FROM menus WHERE route = '/work/projects')
        AND user_id IN (SELECT id FROM users WHERE role = 'user')
    `);
  },
};
