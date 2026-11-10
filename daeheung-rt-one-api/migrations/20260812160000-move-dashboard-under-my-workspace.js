'use strict';

/**
 * 대시보드 메뉴를 「내 정보·업무」 하위로 이동.
 * - 경로(/dashboard)와 사이트 첫 화면은 유지
 * - 기존 최상위 대시보드는 soft-deactivate 후 /my 하위로 upsert
 */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
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

      await sequelize.query(
        `UPDATE menus
         SET "order" = 1, name_ko = '내 정보·업무', name_en = 'My Info & Work', updated_at = NOW()
         WHERE id = $1`,
        { bind: [myParentId] }
      );

      // 기존 최상위 /dashboard 비활성 (동일 테넌트에서 중복 방지)
      await sequelize.query(
        `UPDATE menus
         SET is_active = false, updated_at = NOW()
         WHERE tenant_id = $1
           AND route = '/dashboard'
           AND (parent_id IS NULL OR parent_id <> $2)`,
        { bind: [tenantId, myParentId] }
      );

      const [existing] = await sequelize.query(
        `SELECT id FROM menus
         WHERE tenant_id = $1 AND route = '/dashboard' AND parent_id = $2
         ORDER BY id ASC LIMIT 1`,
        { bind: [tenantId, myParentId] }
      );

      let dashId;
      if (existing.length) {
        dashId = Number(existing[0].id);
        await sequelize.query(
          `UPDATE menus
           SET name_ko = '대시보드', name_en = 'Dashboard', icon = 'dashboard',
               parent_id = $1, level = 1, "order" = 1, is_active = true,
               description = '메인 대시보드', updated_at = NOW()
           WHERE id = $2`,
          { bind: [myParentId, dashId] }
        );
      } else {
        // 비활성된 동일 route 행이 있으면 복구·이동
        const [inactive] = await sequelize.query(
          `SELECT id FROM menus
           WHERE tenant_id = $1 AND route = '/dashboard'
           ORDER BY id ASC LIMIT 1`,
          { bind: [tenantId] }
        );
        if (inactive.length) {
          dashId = Number(inactive[0].id);
          await sequelize.query(
            `UPDATE menus
             SET name_ko = '대시보드', name_en = 'Dashboard', icon = 'dashboard',
                 parent_id = $1, level = 1, "order" = 1, is_active = true,
                 description = '메인 대시보드', updated_at = NOW()
             WHERE id = $2`,
            { bind: [myParentId, dashId] }
          );
        } else {
          const [ins] = await sequelize.query(
            `INSERT INTO menus
              (tenant_id, parent_id, level, name_ko, name_en, route, icon, "order", is_active, description, created_at, updated_at)
             VALUES ($1,$2,1,'대시보드','Dashboard','/dashboard','dashboard',1,true,'메인 대시보드',NOW(),NOW())
             RETURNING id`,
            { bind: [tenantId, myParentId] }
          );
          dashId = Number(ins[0].id);
        }
      }

      // 나머지 /my 자식 order 재정렬
      const orderMap = [
        ['/my/personal-info', 2],
        ['/my/attendance', 3],
        ['/my/payslips', 4],
        ['/my/contracts', 5],
        ['/my/notices', 6],
        ['/my/leave', 7],
        ['/my/work-list', 8],
        ['/my/mail-settings', 9],
      ];
      for (const [route, order] of orderMap) {
        await sequelize.query(
          `UPDATE menus SET "order" = $1, updated_at = NOW()
           WHERE tenant_id = $2 AND parent_id = $3 AND route = $4 AND is_active = true`,
          { bind: [order, tenantId, myParentId, route] }
        );
      }

      // 활성 사용자에게 대시보드 보기 권한
      await sequelize.query(
        `INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
         SELECT u.id, $1, true, false, false, false, NOW(), NOW()
         FROM users u
         WHERE u.tenant_id = $2 AND u.status = 'active'
           AND NOT EXISTS (
             SELECT 1 FROM user_permissions up
             WHERE up.user_id = u.id AND up.menu_id = $1
           )`,
        { bind: [dashId, tenantId] }
      );
    }
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const [tenants] = await sequelize.query(`SELECT id FROM tenants`);
    for (const t of tenants || []) {
      const tenantId = Number(t.id);
      const [rows] = await sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = '/dashboard' AND is_active = true LIMIT 1`,
        { bind: [tenantId] }
      );
      if (!rows.length) continue;
      await sequelize.query(
        `UPDATE menus
         SET parent_id = NULL, level = 0, "order" = 1, updated_at = NOW()
         WHERE id = $1`,
        { bind: [Number(rows[0].id)] }
      );
      await sequelize.query(
        `UPDATE menus SET "order" = 2, updated_at = NOW()
         WHERE tenant_id = $1 AND route = '/my' AND parent_id IS NULL`,
        { bind: [tenantId] }
      );
    }
  },
};
