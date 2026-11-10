'use strict';

/** 로트 마스터·이동, 생산 추적 메뉴 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const sequelize = queryInterface.sequelize;

    try {
      await queryInterface.describeTable('production_lots');
    } catch {
      await queryInterface.createTable('production_lots', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        tenant_id: { type: Sequelize.INTEGER, allowNull: false },
        company_id: { type: Sequelize.INTEGER, allowNull: false },
        lot_no: { type: Sequelize.STRING(40), allowNull: false },
        product_id: { type: Sequelize.INTEGER, allowNull: false },
        lot_kind: { type: Sequelize.STRING(20), allowNull: false },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'open' },
        quantity_on_hand: { type: Sequelize.DECIMAL(14, 3), allowNull: false, defaultValue: 0 },
        location: { type: Sequelize.STRING(120), allowNull: true },
        produced_on: { type: Sequelize.DATEONLY, allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        created_by: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      });
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS production_lots_company_lot_no_active
        ON production_lots (company_id, lot_no)
        WHERE deleted_at IS NULL
      `);
      await queryInterface.addIndex('production_lots', ['company_id', 'product_id'], {
        name: 'production_lots_company_product_idx',
      });
    }

    try {
      await queryInterface.describeTable('lot_movements');
    } catch {
      await queryInterface.createTable('lot_movements', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        tenant_id: { type: Sequelize.INTEGER, allowNull: false },
        company_id: { type: Sequelize.INTEGER, allowNull: false },
        lot_id: { type: Sequelize.INTEGER, allowNull: false },
        movement_type: { type: Sequelize.STRING(20), allowNull: false },
        quantity: { type: Sequelize.DECIMAL(14, 3), allowNull: false },
        related_lot_id: { type: Sequelize.INTEGER, allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        created_by: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      });
      await queryInterface.addIndex('lot_movements', ['lot_id', 'created_at'], {
        name: 'lot_movements_lot_created_idx',
      });
    }

    const [tenants] = await sequelize.query(`SELECT id FROM tenants`);
    for (const tenant of tenants) {
      const tenantId = tenant.id;
      const [existingParent] = await sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = '/production' AND parent_id IS NULL LIMIT 1`,
        { bind: [tenantId] }
      );
      let parentId = existingParent[0]?.id;
      if (!parentId) {
        const [inserted] = await sequelize.query(
          `INSERT INTO menus (
             tenant_id, parent_id, name_ko, name_en, route, icon, "order", level,
             is_active, description, created_at, updated_at
           ) VALUES (
             $1, NULL, '생산 추적', 'Production Tracking', '/production', 'inventory', 14, 1,
             true, '로트 기준 생산 추적', NOW(), NOW()
           ) RETURNING id`,
          { bind: [tenantId] }
        );
        parentId = inserted[0].id;
      }

      const [existingChild] = await sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = '/production/lots' LIMIT 1`,
        { bind: [tenantId] }
      );
      let childId = existingChild[0]?.id;
      if (!childId) {
        const [insertedChild] = await sequelize.query(
          `INSERT INTO menus (
             tenant_id, parent_id, name_ko, name_en, route, icon, "order", level,
             is_active, description, created_at, updated_at
           ) VALUES (
             $1, $2, '로트', 'Lots', '/production/lots', 'inventory_2', 1, 2,
             true, '로트별 재고와 생산·사용·출고', NOW(), NOW()
           ) RETURNING id`,
          { bind: [tenantId, parentId] }
        );
        childId = insertedChild[0].id;
      }

      for (const menuId of [parentId, childId]) {
        await sequelize.query(
          `INSERT INTO user_permissions (
             user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at
           )
           SELECT u.id, $1, true, true, true, true, NOW(), NOW()
           FROM users u
           WHERE u.tenant_id = $2
             AND u.role IN ('admin', 'root')
             AND COALESCE(u.status, 'active') <> 'inactive'
             AND NOT EXISTS (
               SELECT 1 FROM user_permissions p WHERE p.user_id = u.id AND p.menu_id = $1
             )`,
          { bind: [menuId, tenantId] }
        );
      }
    }
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    await sequelize.query(`
      DELETE FROM user_permissions
      WHERE menu_id IN (SELECT id FROM menus WHERE route IN ('/production', '/production/lots'))
    `);
    await sequelize.query(`DELETE FROM menus WHERE route IN ('/production', '/production/lots')`);
    await queryInterface.dropTable('lot_movements');
    await queryInterface.dropTable('production_lots');
  },
};
