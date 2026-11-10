'use strict';

/**
 * 일반 사용자용 「내 업무」메뉴 트리 + 기본 보기 권한
 * - /my (부모)
 * - /my/attendance, /my/payslips, /my/contracts, /my/notices, /my/leave
 */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    const [tenants] = await sequelize.query(`
      SELECT DISTINCT tenant_id FROM menus WHERE parent_id IS NULL
    `);

    const children = [
      {
        route: '/my/attendance',
        name_ko: '출퇴근 기록',
        name_en: 'My Attendance',
        icon: 'schedule',
        order: 1,
        description: '본인 출퇴근 기록 확인',
      },
      {
        route: '/my/payslips',
        name_ko: '급여 명세서',
        name_en: 'My Payslips',
        icon: 'payments',
        order: 2,
        description: '본인 급여 명세서 확인',
      },
      {
        route: '/my/contracts',
        name_ko: '내 계약서',
        name_en: 'My Contracts',
        icon: 'description',
        order: 3,
        description: '본인 근로계약서 확인',
      },
      {
        route: '/my/notices',
        name_ko: '공지사항',
        name_en: 'Notices',
        icon: 'campaign',
        order: 4,
        description: '회사 공지 확인',
      },
      {
        route: '/my/leave',
        name_ko: '휴가 신청',
        name_en: 'Leave Request',
        icon: 'event',
        order: 5,
        description: '휴가 신청 및 조회',
      },
    ];

    for (const t of tenants) {
      const tenantId = t.tenant_id;

      // 상위 메뉴 order: 대시보드(1) 다음으로 밀기
      await sequelize.query(
        `
        UPDATE menus
        SET "order" = "order" + 1, updated_at = NOW()
        WHERE tenant_id = $1 AND parent_id IS NULL AND "order" >= 2
        `,
        { bind: [tenantId] }
      );

      let parentId;
      const [existingParent] = await sequelize.query(
        `
        SELECT id FROM menus
        WHERE tenant_id = $1 AND route = '/my' AND parent_id IS NULL
        LIMIT 1
        `,
        { bind: [tenantId] }
      );

      if (existingParent.length > 0) {
        parentId = existingParent[0].id;
        await sequelize.query(
          `
          UPDATE menus
          SET name_ko = $2, name_en = $3, icon = $4, "order" = 2, level = 0,
              is_active = true, description = $5, updated_at = NOW()
          WHERE id = $1
          `,
          {
            bind: [
              parentId,
              '내 업무',
              'My Workspace',
              'person',
              '출퇴근·급여·계약·공지 등 개인 업무',
            ],
          }
        );
      } else {
        const [inserted] = await sequelize.query(
          `
          INSERT INTO menus (
            tenant_id, parent_id, name_ko, name_en, route, icon, "order", level,
            is_active, description, created_at, updated_at
          ) VALUES (
            $1, NULL, $2, $3, '/my', $4, 2, 0, true, $5, NOW(), NOW()
          )
          RETURNING id
          `,
          {
            bind: [
              tenantId,
              '내 업무',
              'My Workspace',
              'person',
              '출퇴근·급여·계약·공지 등 개인 업무',
            ],
          }
        );
        parentId = inserted[0].id;
      }

      for (const child of children) {
        const [existingChild] = await sequelize.query(
          `
          SELECT id FROM menus
          WHERE tenant_id = $1 AND route = $2
          LIMIT 1
          `,
          { bind: [tenantId, child.route] }
        );

        let childId;
        if (existingChild.length > 0) {
          childId = existingChild[0].id;
          await sequelize.query(
            `
            UPDATE menus
            SET parent_id = $2, name_ko = $3, name_en = $4, icon = $5, "order" = $6,
                level = 1, is_active = true, description = $7, updated_at = NOW()
            WHERE id = $1
            `,
            {
              bind: [
                childId,
                parentId,
                child.name_ko,
                child.name_en,
                child.icon,
                child.order,
                child.description,
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
              $1, $2, $3, $4, $5, $6, $7, 1, true, $8, NOW(), NOW()
            )
            RETURNING id
            `,
            {
              bind: [
                tenantId,
                parentId,
                child.name_ko,
                child.name_en,
                child.route,
                child.icon,
                child.order,
                child.description,
              ],
            }
          );
          childId = ins[0].id;
        }
      }
    }

    // 메뉴 id 수집 (모든 테넌트)
    const [myMenus] = await sequelize.query(`
      SELECT id, tenant_id, route
      FROM menus
      WHERE route = '/my' OR route LIKE '/my/%'
    `);

    for (const m of myMenus) {
      const menuId = m.id;
      const tenantId = m.tenant_id;
      const isLeave = m.route === '/my/leave';

      // role=user: 보기 기본 (+ 휴가만 create)
      await sequelize.query(
        `
        INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
        SELECT u.id, $1, true, $3, false, false, NOW(), NOW()
        FROM users u
        WHERE u.tenant_id = $2
          AND u.role = 'user'
          AND COALESCE(u.status, 'active') <> 'inactive'
          AND NOT EXISTS (
            SELECT 1 FROM user_permissions p WHERE p.user_id = u.id AND p.menu_id = $1
          )
        `,
        { bind: [menuId, tenantId, isLeave] }
      );

      // admin: 전체 CRUD (기존 신규 메뉴 패턴과 동일)
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
        SELECT id FROM menus WHERE route = '/my' OR route LIKE '/my/%'
      )
    `);
    await sequelize.query(`
      DELETE FROM menus WHERE route LIKE '/my/%'
    `);
    await sequelize.query(`
      DELETE FROM menus WHERE route = '/my'
    `);
    // order bump 원복은 생략 (다른 메뉴와 충돌 가능)
  },
};
