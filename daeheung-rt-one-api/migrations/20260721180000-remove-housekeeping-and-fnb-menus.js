'use strict';

const REMOVED_ROUTES = ['/hotel/housekeeping', '/hotel/fnb'];

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const [menus] = await sequelize.query(
      `SELECT id
       FROM menus
       WHERE route IN ($1, $2)`,
      { bind: REMOVED_ROUTES }
    );

    for (const menu of menus) {
      await sequelize.query(
        `DELETE FROM user_permissions WHERE menu_id = $1`,
        { bind: [menu.id] }
      );
      await sequelize.query(
        `DELETE FROM menu_permissions WHERE menu_id = $1`,
        { bind: [menu.id] }
      ).catch(() => undefined);
    }

    await sequelize.query(
      `DELETE FROM menus WHERE route IN ($1, $2)`,
      { bind: REMOVED_ROUTES }
    );

    await sequelize.query(`
      UPDATE menus
      SET "order" = CASE route
        WHEN '/hotel/front-desk' THEN 1
        WHEN '/hotel/room-reservation' THEN 2
        WHEN '/hotel/reservations' THEN 3
        WHEN '/hotel/room-types' THEN 4
        ELSE "order"
      END,
      updated_at = NOW()
      WHERE route IN (
        '/hotel/front-desk',
        '/hotel/room-reservation',
        '/hotel/reservations',
        '/hotel/room-types'
      )
    `);
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const [parents] = await sequelize.query(`
      SELECT id, tenant_id
      FROM menus
      WHERE route = '/hotel' AND parent_id IS NULL
    `);

    for (const parent of parents) {
      await sequelize.query(
        `INSERT INTO menus (
          tenant_id, parent_id, name_ko, name_en, route, icon,
          "order", level, is_active, description, created_at, updated_at
        )
        SELECT $1, $2, '하우스키핑', 'Housekeeping', '/hotel/housekeeping',
          'cleaning_services', 5, 2, false, 'Restored stub (inactive)', NOW(), NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM menus WHERE tenant_id = $1 AND route = '/hotel/housekeeping'
        )`,
        { bind: [parent.tenant_id, parent.id] }
      );
      await sequelize.query(
        `INSERT INTO menus (
          tenant_id, parent_id, name_ko, name_en, route, icon,
          "order", level, is_active, description, created_at, updated_at
        )
        SELECT $1, $2, 'F&B', 'F&B', '/hotel/fnb',
          'restaurant', 6, 2, false, 'Restored stub (inactive)', NOW(), NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM menus WHERE tenant_id = $1 AND route = '/hotel/fnb'
        )`,
        { bind: [parent.tenant_id, parent.id] }
      );
    }
  },
};
