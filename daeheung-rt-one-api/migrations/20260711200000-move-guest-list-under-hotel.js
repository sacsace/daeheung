'use strict';

/**
 * 투숙객 명단을 호텔 관리 하위로 통합
 * - 레거시 /work/room-reservation 비활성화
 * - /hotel/room-reservation 을 호텔 하위 단일 메뉴로 유지
 */
module.exports = {
  async up(queryInterface) {
    const [tenants] = await queryInterface.sequelize.query(`
      SELECT DISTINCT tenant_id FROM menus WHERE route IN ('/hotel', '/work/room-reservation', '/hotel/room-reservation')
    `);

    for (const { tenant_id: tenantId } of tenants) {
      const [[hotelParent]] = await queryInterface.sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = '/hotel' AND parent_id IS NULL LIMIT 1`,
        { bind: [tenantId] }
      );
      if (!hotelParent?.id) continue;

      const [roomMenus] = await queryInterface.sequelize.query(
        `
        SELECT id, route, parent_id FROM menus
        WHERE tenant_id = $1 AND route IN ('/work/room-reservation', '/hotel/room-reservation')
        ORDER BY CASE route WHEN '/hotel/room-reservation' THEN 0 ELSE 1 END, id
        `,
        { bind: [tenantId] }
      );

      let hotelMenuId = roomMenus.find((m) => m.route === '/hotel/room-reservation')?.id;

      if (!hotelMenuId) {
        const workMenu = roomMenus.find((m) => m.route === '/work/room-reservation');
        if (workMenu) {
          await queryInterface.sequelize.query(
            `
            UPDATE menus
            SET route = '/hotel/room-reservation',
                parent_id = $1,
                name_ko = '투숙객 명단',
                name_en = 'Guest List',
                icon = 'hotel',
                "order" = 2,
                level = 2,
                is_active = true,
                description = '객실 예약·투숙객 관리',
                updated_at = NOW()
            WHERE id = $2
            `,
            { bind: [hotelParent.id, workMenu.id] }
          );
          hotelMenuId = workMenu.id;
        } else {
          const [inserted] = await queryInterface.sequelize.query(
            `
            INSERT INTO menus (
              tenant_id, parent_id, name_ko, name_en, route, icon, "order", level, is_active, description, created_at, updated_at
            ) VALUES (
              $1, $2, '투숙객 명단', 'Guest List', '/hotel/room-reservation', 'hotel', 2, 2, true, '객실 예약·투숙객 관리', NOW(), NOW()
            )
            RETURNING id
            `,
            { bind: [tenantId, hotelParent.id] }
          );
          hotelMenuId = inserted[0]?.id;
        }
      } else {
        await queryInterface.sequelize.query(
          `
          UPDATE menus
          SET parent_id = $1,
              name_ko = '투숙객 명단',
              name_en = 'Guest List',
              icon = 'hotel',
              "order" = 2,
              level = 2,
              is_active = true,
              description = '객실 예약·투숙객 관리',
              updated_at = NOW()
          WHERE id = $2
          `,
          { bind: [hotelParent.id, hotelMenuId] }
        );
      }

      const workMenuIds = roomMenus
        .filter((m) => m.route === '/work/room-reservation' && m.id !== hotelMenuId)
        .map((m) => m.id);

      if (workMenuIds.length > 0) {
        await queryInterface.sequelize.query(
          `UPDATE menus SET is_active = false, updated_at = NOW() WHERE id = ANY($1::int[])`,
          { bind: [workMenuIds] }
        );
      }

      const remainingWorkMenus = roomMenus.filter(
        (m) => m.route === '/work/room-reservation' && m.id !== hotelMenuId
      );
      for (const workMenu of remainingWorkMenus) {
        await queryInterface.sequelize.query(
          `UPDATE menus SET is_active = false, updated_at = NOW() WHERE id = $1`,
          { bind: [workMenu.id] }
        );
      }

      if (hotelMenuId && roomMenus.length > 0) {
        const legacyIds = roomMenus
          .filter((m) => m.id !== hotelMenuId)
          .map((m) => m.id);
        if (legacyIds.length > 0) {
          await queryInterface.sequelize.query(
            `
            INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
            SELECT DISTINCT u.user_id, $1::int, u.can_view, u.can_create, u.can_edit, u.can_delete, NOW(), NOW()
            FROM user_permissions u
            WHERE u.menu_id = ANY($2::int[])
              AND u.can_view = true
              AND NOT EXISTS (
                SELECT 1 FROM user_permissions p WHERE p.user_id = u.user_id AND p.menu_id = $1::int
              )
            `,
            { bind: [hotelMenuId, legacyIds] }
          );
        }
      }

      const HOTEL_CHILD_ORDER = [
        ['/hotel/front-desk', 1],
        ['/hotel/room-reservation', 2],
        ['/hotel/reservations', 3],
        ['/hotel/room-types', 4],
        ['/hotel/housekeeping', 5],
        ['/hotel/fnb', 6],
      ];

      for (const [route, order] of HOTEL_CHILD_ORDER) {
        await queryInterface.sequelize.query(
          `
          UPDATE menus
          SET parent_id = $1, "order" = $2, level = 2, updated_at = NOW()
          WHERE tenant_id = $3 AND route = $4 AND is_active = true
          `,
          { bind: [hotelParent.id, order, tenantId, route] }
        );
      }

      await queryInterface.sequelize.query(
        `UPDATE menus SET is_active = false, updated_at = NOW() WHERE tenant_id = $1 AND route = '/work/room-reservation'`,
        { bind: [tenantId] }
      );
    }
  },

  async down() {},
};
