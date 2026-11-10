'use strict';

/**
 * 「내 정보·업무」하위 메뉴 순서 정리
 * 1 대시보드 → 2 개인정보 → 3 출퇴근 → 4 휴가 → 5 급여 → 6 계약 → 7 공지 → 8 업무리스트 → 9 설정
 * 공지사항 보기 권한 누락 보완
 */
const ORDER = [
  ['/dashboard', 1, '대시보드', 'Dashboard', 'dashboard'],
  ['/my/personal-info', 2, '개인 정보', 'Personal Information', 'person'],
  ['/my/attendance', 3, '출퇴근 기록', 'My Attendance', 'schedule'],
  ['/my/leave', 4, '휴가 관리', 'Leave Management', 'event'],
  ['/my/payslips', 5, '급여 명세서', 'My Payslips', 'payments'],
  ['/my/contracts', 6, '내 계약서', 'My Contracts', 'description'],
  ['/my/notices', 7, '공지사항', 'Notices', 'campaign'],
  ['/my/work-list', 8, '내 업무 리스트', 'My Work List', 'assignment'],
  ['/my/mail-settings', 9, '설정', 'Settings', 'settings'],
];

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const [tenants] = await sequelize.query(`SELECT id FROM tenants`);

    for (const t of tenants || []) {
      const tenantId = Number(t.id);
      const [parents] = await sequelize.query(
        `SELECT id FROM menus
         WHERE tenant_id = $1 AND route = '/my' AND parent_id IS NULL AND is_active = true
         ORDER BY id ASC LIMIT 1`,
        { bind: [tenantId] }
      );
      if (!parents.length) continue;
      const parentId = Number(parents[0].id);

      let noticesId = null;
      for (const [route, order, nameKo, nameEn, icon] of ORDER) {
        const [rows] = await sequelize.query(
          `SELECT id FROM menus WHERE tenant_id = $1 AND route = $2 ORDER BY id ASC LIMIT 1`,
          { bind: [tenantId, route] }
        );
        if (!rows.length) continue;
        const menuId = Number(rows[0].id);
        await sequelize.query(
          `UPDATE menus
           SET parent_id = $1::int, level = 1, "order" = $2::int,
               name_ko = $3::varchar, name_en = $4::varchar,
               icon = $5::varchar, is_active = true, description = $3::varchar, updated_at = NOW()
           WHERE id = $6::int`,
          { bind: [parentId, order, nameKo, nameEn, icon, menuId] }
        );
        if (route === '/my/notices') noticesId = menuId;
      }

      if (noticesId) {
        // 「내 정보·업무」하위 중 하나라도 보는 사용자에게 공지 보기 부여
        await sequelize.query(
          `INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
           SELECT DISTINCT u.id, $1::int, true, false, false, false, NOW(), NOW()
           FROM users u
           JOIN user_permissions up ON up.user_id = u.id AND up.can_view = true
           JOIN menus m ON m.id = up.menu_id
           WHERE u.tenant_id = $2::int
             AND u.status = 'active'
             AND (m.route = '/my' OR m.route LIKE '/my/%' OR m.route = '/dashboard')
             AND NOT EXISTS (
               SELECT 1 FROM user_permissions x
               WHERE x.user_id = u.id AND x.menu_id = $1::int
             )`,
          { bind: [noticesId, tenantId] }
        );
        await sequelize.query(
          `UPDATE user_permissions SET can_view = true, updated_at = NOW()
           WHERE menu_id = $1::int AND can_view = false`,
          { bind: [noticesId] }
        );
      }
    }
  },

  async down() {
    // no-op: order preference only
  },
};
