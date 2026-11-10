'use strict';

/**
 * Top-level menu English labels (UI wording cleanup)
 */
module.exports = {
  async up(queryInterface) {
    const updates = [
      { route: '/my', name_en: 'My Profile & Work' },
      { route: '/basic-info', name_en: 'Master Data Management' },
      { route: '/sales', name_en: 'Purchasing & Sales' },
      { route: '/inventory', name_en: 'Inventory Management' },
      { route: '/communication', name_en: 'Notifications' },
    ];

    for (const item of updates) {
      await queryInterface.sequelize.query(
        `
        UPDATE menus
        SET name_en = :nameEn,
            updated_at = NOW()
        WHERE route = :route
          AND parent_id IS NULL
          AND (name_en IS DISTINCT FROM :nameEn)
        `,
        {
          replacements: {
            nameEn: item.name_en,
            route: item.route,
          },
        }
      );
    }

    await queryInterface.sequelize.query(`
      UPDATE menus
      SET name_en = 'Inventory Management',
          updated_at = NOW()
      WHERE parent_id IS NULL
        AND (
          name_en ILIKE '%managemer%'
          OR name_en = 'Inventory Manager'
        )
    `);
  },

  async down(queryInterface) {
    const revert = [
      { route: '/my', name_en: 'My Info & Work' },
      { route: '/basic-info', name_en: 'Basic Information Management' },
      { route: '/sales', name_en: 'Purchase/Sales' },
      { route: '/inventory', name_en: 'Inventory Management' },
      { route: '/communication', name_en: 'Alarms' },
    ];

    for (const item of revert) {
      await queryInterface.sequelize.query(
        `
        UPDATE menus
        SET name_en = :nameEn,
            updated_at = NOW()
        WHERE route = :route
          AND parent_id IS NULL
        `,
        {
          replacements: {
            nameEn: item.name_en,
            route: item.route,
          },
        }
      );
    }
  },
};
