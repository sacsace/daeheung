'use strict';

/** 회계관리(Tally)에 법인세·Advance Tax 메뉴를 추가한다. */
const MENUS = [
  {
    route: '/accounting/corporate-tax',
    nameKo: '법인세 계산',
    nameEn: 'Corporate Tax',
    icon: 'payments',
    order: 7,
    description: '법인세 추정 및 계산',
  },
  {
    route: '/accounting/advance-tax',
    nameKo: 'Advance Tax',
    nameEn: 'Advance Tax',
    icon: 'payments',
    order: 8,
    description: 'Advance Tax 납부 및 예상액 관리',
  },
];

module.exports = {
  async up(queryInterface) {
    const [parents] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id
      FROM menus
      WHERE route = '/accounting' AND parent_id IS NULL AND is_active = true
    `);

    for (const parent of parents) {
      const [parentPermissions] = await queryInterface.sequelize.query(
        `SELECT user_id, can_view, can_create, can_edit, can_delete
         FROM user_permissions
         WHERE menu_id = $1`,
        { bind: [parent.id] }
      );

      for (const menu of MENUS) {
        const [existing] = await queryInterface.sequelize.query(
          `SELECT id FROM menus WHERE tenant_id = $1 AND route = $2 LIMIT 1`,
          { bind: [parent.tenant_id, menu.route] }
        );

        let menuId = existing[0]?.id;
        if (!menuId) {
          const [inserted] = await queryInterface.sequelize.query(
            `INSERT INTO menus
              (tenant_id, parent_id, name_ko, name_en, route, icon, "order", level, is_active, description, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 2, true, $8, NOW(), NOW())
             RETURNING id`,
            {
              bind: [
                parent.tenant_id,
                parent.id,
                menu.nameKo,
                menu.nameEn,
                menu.route,
                menu.icon,
                menu.order,
                menu.description,
              ],
            }
          );
          menuId = inserted[0].id;
        } else {
          await queryInterface.sequelize.query(
            `UPDATE menus
             SET parent_id = $1, name_ko = $2, name_en = $3, icon = $4,
                 "order" = $5, is_active = true, description = $6, updated_at = NOW()
             WHERE id = $7`,
            {
              bind: [
                parent.id,
                menu.nameKo,
                menu.nameEn,
                menu.icon,
                menu.order,
                menu.description,
                menuId,
              ],
            }
          );
        }

        for (const permission of parentPermissions) {
          await queryInterface.sequelize.query(
            `INSERT INTO user_permissions
              (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
             SELECT $1, $2, $3, $4, $5, $6, NOW(), NOW()
             WHERE NOT EXISTS (
               SELECT 1 FROM user_permissions WHERE user_id = $1 AND menu_id = $2
             )`,
            {
              bind: [
                permission.user_id,
                menuId,
                permission.can_view,
                permission.can_create,
                permission.can_edit,
                permission.can_delete,
              ],
            }
          );
        }
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM user_permissions
      WHERE menu_id IN (
        SELECT id FROM menus
        WHERE route IN ('/accounting/corporate-tax', '/accounting/advance-tax')
      )
    `);
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET is_active = false, updated_at = NOW()
      WHERE route IN ('/accounting/corporate-tax', '/accounting/advance-tax')
    `);
  },
};
