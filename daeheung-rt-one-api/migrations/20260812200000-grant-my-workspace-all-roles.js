'use strict';

/**
 * 모든 활성 사용자(role 무관)에게 「내 정보·업무」부모·하위 메뉴 can_view 기본 부여.
 * (과거 root/admin/audit 제외·신규 user 미부여 보정)
 */
const ROUTES = [
  '/my',
  '/dashboard',
  '/my/personal-info',
  '/my/attendance',
  '/my/leave',
  '/my/payslips',
  '/my/contracts',
  '/my/notices',
  '/my/work-list',
  '/my/mail-settings',
];

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const tenants = await sequelize.query(`SELECT DISTINCT tenant_id FROM menus WHERE is_active = true`, {
      type: sequelize.QueryTypes.SELECT,
    });

    for (const row of tenants) {
      const tenantId = Number(row.tenant_id);
      if (!Number.isFinite(tenantId)) continue;

      for (const route of ROUTES) {
        const isLeave = route === '/my/leave';
        await sequelize.query(
          `INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
           SELECT u.id, m.id, true, $1::boolean, false, false, NOW(), NOW()
           FROM users u
           INNER JOIN menus m
             ON m.tenant_id = u.tenant_id
            AND m.route = $2
            AND m.is_active = true
           WHERE u.tenant_id = $3::int
             AND u.status = 'active'
             AND NOT EXISTS (
               SELECT 1 FROM user_permissions up
               WHERE up.user_id = u.id AND up.menu_id = m.id
             )`,
          { bind: [isLeave, route, tenantId] }
        );

        // 이미 행이 있으나 can_view=false 인 경우 복구
        await sequelize.query(
          `UPDATE user_permissions up
           SET can_view = true,
               can_create = CASE WHEN $1::boolean THEN true ELSE up.can_create END,
               updated_at = NOW()
           FROM users u
           INNER JOIN menus m
             ON m.tenant_id = u.tenant_id
            AND m.route = $2
            AND m.is_active = true
           WHERE up.user_id = u.id
             AND up.menu_id = m.id
             AND u.tenant_id = $3::int
             AND u.status = 'active'
             AND up.can_view = false`,
          { bind: [isLeave, route, tenantId] }
        );
      }
    }
  },

  async down() {
    // 기본 부여 롤백은 역할별 정책을 되돌리기 어려워 no-op
  },
};
