'use strict';

/**
 * 「내 정보·업무」메뉴 트리 최종 상태로 수리 (과거 조각 마이그레이션 통합 결과물).
 * - 이미 적용된 120300~121000 환경에서도 안전하게 재실행 가능 (idempotent)
 */
const PARENT = {
  route: '/my',
  name_ko: '내 정보·업무',
  name_en: 'My Info & Work',
  icon: 'Person',
  order: 2,
  description: '내 정보·업무',
};

const CHILDREN = [
  { route: '/my/personal-info', name_ko: '개인 정보', name_en: 'Personal Information', icon: 'person', order: 1 },
  { route: '/my/attendance', name_ko: '출퇴근 기록', name_en: 'My Attendance', icon: 'schedule', order: 2 },
  { route: '/my/payslips', name_ko: '급여 명세서', name_en: 'My Payslips', icon: 'payments', order: 3 },
  { route: '/my/contracts', name_ko: '내 계약서', name_en: 'My Contracts', icon: 'description', order: 4 },
  { route: '/my/notices', name_ko: '공지사항', name_en: 'Notices', icon: 'campaign', order: 5 },
  { route: '/my/leave', name_ko: '휴가 관리', name_en: 'Leave Management', icon: 'event', order: 6 },
  { route: '/my/work-list', name_ko: '내 업무 리스트', name_en: 'My Work List', icon: 'assignment', order: 7 },
  { route: '/my/mail-settings', name_ko: '메일 설정', name_en: 'Mail Settings', icon: 'email', order: 8 },
];

async function upsertMenu(sequelize, { tenantId, parentId, level, menu }) {
  const [rows] = await sequelize.query(
    `SELECT id FROM menus WHERE tenant_id = $1 AND route = $2 LIMIT 1`,
    { bind: [tenantId, menu.route] }
  );
  if (rows.length) {
    await sequelize.query(
      `UPDATE menus
       SET name_ko = $1, name_en = $2, icon = $3, "order" = $4,
           parent_id = $5, level = $6, is_active = true, description = $7, updated_at = NOW()
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
          rows[0].id,
        ],
      }
    );
    return Number(rows[0].id);
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

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const [tenants] = await sequelize.query(`SELECT id FROM tenants`);
    const tenantIds = (tenants || []).map((t) => Number(t.id)).filter((id) => Number.isFinite(id));

    for (const tenantId of tenantIds) {
      const parentId = await upsertMenu(sequelize, {
        tenantId,
        parentId: null,
        level: 0,
        menu: PARENT,
      });

      for (const child of CHILDREN) {
        const menuId = await upsertMenu(sequelize, {
          tenantId,
          parentId,
          level: 1,
          menu: child,
        });

        const canCreate = child.route === '/my/leave';
        await sequelize.query(
          `INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
           SELECT u.id, $1, true, $2, false, false, NOW(), NOW()
           FROM users u
           WHERE u.tenant_id = $3 AND u.role = 'user' AND u.status = 'active'
             AND NOT EXISTS (
               SELECT 1 FROM user_permissions up
               WHERE up.user_id = u.id AND up.menu_id = $1
             )`,
          { bind: [menuId, canCreate, tenantId] }
        );

        if (canCreate) {
          await sequelize.query(
            `UPDATE user_permissions up
             SET can_create = true, updated_at = NOW()
             FROM users u
             WHERE up.user_id = u.id AND up.menu_id = $1
               AND u.tenant_id = $2 AND u.role = 'user'`,
            { bind: [menuId, tenantId] }
          );
        }
      }

      // parent view for users
      await sequelize.query(
        `INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
         SELECT u.id, $1, true, false, false, false, NOW(), NOW()
         FROM users u
         WHERE u.tenant_id = $2 AND u.role = 'user' AND u.status = 'active'
           AND NOT EXISTS (
             SELECT 1 FROM user_permissions up
             WHERE up.user_id = u.id AND up.menu_id = $1
           )`,
        { bind: [parentId, tenantId] }
      );
    }
  },

  async down() {
    // 메뉴 제거는 하지 않음 (권한/메뉴 데이터 보존)
  },
};
