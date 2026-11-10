'use strict';

/**
 * 업무 담당 리스트: 담당자 컬럼 + 담당 회사(항목) 테이블
 * 메뉴: /work/assignee-list
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('work_assignees', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('work_assignees', ['tenant_id', 'company_id']);
    await queryInterface.addIndex('work_assignees', ['tenant_id', 'company_id', 'sort_order']);

    await queryInterface.createTable('work_assignee_items', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      assignee_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'work_assignees', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
      note: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      is_highlighted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('work_assignee_items', ['assignee_id']);
    await queryInterface.addIndex('work_assignee_items', ['assignee_id', 'sort_order']);

    // 메뉴 추가: 업무관리 하위
    const [workMenus] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id
      FROM menus
      WHERE route = '/work' AND level = 1
    `);

    for (const menu of workMenus) {
      const [existing] = await queryInterface.sequelize.query(
        `
        SELECT id FROM menus
        WHERE tenant_id = $1 AND parent_id = $2 AND route = '/work/assignee-list'
        `,
        { bind: [menu.tenant_id, menu.id] }
      );
      if (existing.length > 0) continue;

      // 업무 관리(1) 다음 자리로 삽입, 이후 형제 메뉴 order +1
      await queryInterface.sequelize.query(
        `
        UPDATE menus
        SET "order" = "order" + 1, updated_at = NOW()
        WHERE tenant_id = $1 AND parent_id = $2 AND "order" >= 2
        `,
        { bind: [menu.tenant_id, menu.id] }
      );

      await queryInterface.sequelize.query(
        `
        INSERT INTO menus (
          tenant_id, parent_id, name_ko, name_en, route, icon, "order", level, is_active, description, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 2, 2, true, $7, NOW(), NOW()
        )
        `,
        {
          bind: [
            menu.tenant_id,
            menu.id,
            '업무 담당 리스트',
            'Work Assignment List',
            '/work/assignee-list',
            'assignment_ind',
            '담당자별 담당 회사 목록',
          ],
        }
      );
    }

    const [newMenuRows] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id FROM menus WHERE route = '/work/assignee-list'
    `);

    for (const m of newMenuRows) {
      await queryInterface.sequelize.query(
        `
        INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
        SELECT u.id, $1, true, true, true, true, NOW(), NOW()
        FROM users u
        WHERE u.tenant_id = $2 AND u.role IN ('admin', 'root')
        AND NOT EXISTS (
          SELECT 1 FROM user_permissions p WHERE p.user_id = u.id AND p.menu_id = $1
        )
        `,
        { bind: [m.id, m.tenant_id] }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM user_permissions WHERE menu_id IN (
        SELECT id FROM menus WHERE route = '/work/assignee-list'
      )
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM menus WHERE route = '/work/assignee-list'
    `);
    await queryInterface.dropTable('work_assignee_items');
    await queryInterface.dropTable('work_assignees');
  },
};
