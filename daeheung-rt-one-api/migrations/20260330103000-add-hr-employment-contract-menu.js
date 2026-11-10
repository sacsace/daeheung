'use strict';

module.exports = {
  up: async (queryInterface) => {
    const [hrMenus] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id
      FROM menus
      WHERE route = '/hr' AND level = 1
    `);

    for (const menu of hrMenus) {
      const [existing] = await queryInterface.sequelize.query(
        `
        SELECT id FROM menus
        WHERE tenant_id = $1 AND parent_id = $2 AND route = '/hr/employment-contracts'
        `,
        { bind: [menu.tenant_id, menu.id] }
      );

      if (existing.length > 0) {
        continue;
      }

      const [orderRows] = await queryInterface.sequelize.query(
        `
        SELECT COALESCE(MAX("order"), 0) AS max_order
        FROM menus
        WHERE tenant_id = $1 AND parent_id = $2
        `,
        { bind: [menu.tenant_id, menu.id] }
      );

      const nextOrder = Number(orderRows?.[0]?.max_order || 0) + 1;

      await queryInterface.sequelize.query(
        `
        INSERT INTO menus (
          tenant_id, parent_id, name_ko, name_en, route, icon, "order", level, is_active, description, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 2, true, $8, NOW(), NOW()
        )
        `,
        {
          bind: [
            menu.tenant_id,
            menu.id,
            '전자근로계약',
            'Employment Contracts',
            '/hr/employment-contracts',
            'description',
            nextOrder,
            'Employment contract templates, signatures and lifecycle'
          ]
        }
      );
    }
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DELETE FROM menus
      WHERE route = '/hr/employment-contracts'
    `);
  }
};

