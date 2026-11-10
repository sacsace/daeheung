'use strict';

/**
 * company_policies / company_policy_revisions 테이블 생성
 * + 「내 정보·업무」에 /my/company-policies 메뉴 추가 및 직원 권한 부여
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const sequelize = queryInterface.sequelize;

    await queryInterface.createTable('company_policies', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
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
      policy_key: { type: Sequelize.STRING(64), allowNull: false },
      title_ko: { type: Sequelize.STRING(200), allowNull: false },
      title_en: { type: Sequelize.STRING(200), allowNull: false },
      content_ko: { type: Sequelize.TEXT, allowNull: false, defaultValue: '' },
      content_en: { type: Sequelize.TEXT, allowNull: false, defaultValue: '' },
      version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('company_policies', ['tenant_id', 'company_id', 'policy_key'], {
      unique: true,
      name: 'company_policies_tenant_company_key_uk',
    });

    await queryInterface.createTable('company_policy_revisions', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
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
      policy_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'company_policies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      policy_key: { type: Sequelize.STRING(64), allowNull: false },
      version: { type: Sequelize.INTEGER, allowNull: false },
      title_ko: { type: Sequelize.STRING(200), allowNull: false },
      title_en: { type: Sequelize.STRING(200), allowNull: false },
      content_ko: { type: Sequelize.TEXT, allowNull: false, defaultValue: '' },
      content_en: { type: Sequelize.TEXT, allowNull: false, defaultValue: '' },
      change_summary: { type: Sequelize.STRING(500), allowNull: true },
      changed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('company_policy_revisions', ['policy_id', 'version'], {
      name: 'company_policy_revisions_policy_version_idx',
    });
    await queryInterface.addIndex('company_policy_revisions', ['tenant_id', 'company_id', 'policy_key'], {
      name: 'company_policy_revisions_scope_key_idx',
    });

    // 메뉴: 설정(order 9) 앞에 회사 정책(order 9), 설정은 10으로
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
         SET "order" = 10, updated_at = NOW()
         WHERE tenant_id = $1 AND route = '/my/mail-settings' AND is_active = true`,
        { bind: [tenantId] }
      );

      const [existing] = await sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = '/my/company-policies' LIMIT 1`,
        { bind: [tenantId] }
      );

      let menuId;
      if (existing.length) {
        menuId = Number(existing[0].id);
        await sequelize.query(
          `UPDATE menus
           SET name_ko = '회사 정책', name_en = 'Company Policies', icon = 'policy',
               parent_id = $1, level = 1, "order" = 9, is_active = true,
               description = '회사 정책', updated_at = NOW()
           WHERE id = $2`,
          { bind: [myParentId, menuId] }
        );
      } else {
        const [ins] = await sequelize.query(
          `INSERT INTO menus
            (tenant_id, parent_id, level, name_ko, name_en, route, icon, "order", is_active, description, created_at, updated_at)
           VALUES ($1,$2,1,'회사 정책','Company Policies','/my/company-policies','policy',9,true,'회사 정책',NOW(),NOW())
           RETURNING id`,
          { bind: [tenantId, myParentId] }
        );
        menuId = Number(ins[0].id);
      }

      // /my 또는 다른 셀프서비스 메뉴 권한이 있는 사용자에게 보기 권한 부여
      await sequelize.query(
        `INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
         SELECT DISTINCT up.user_id, $1::integer, true, false, false, false, NOW(), NOW()
         FROM user_permissions up
         JOIN menus m ON m.id = up.menu_id
         JOIN users u ON u.id = up.user_id
         WHERE u.tenant_id = $2::integer
           AND m.route IN (
             '/my', '/dashboard', '/my/personal-info', '/my/attendance', '/my/leave',
             '/my/payslips', '/my/contracts', '/my/notices', '/my/work-list', '/my/mail-settings'
           )
           AND up.can_view = true
           AND NOT EXISTS (
             SELECT 1 FROM user_permissions x WHERE x.user_id = up.user_id AND x.menu_id = $1::integer
           )`,
        { bind: [menuId, tenantId] }
      );

      // admin/root 는 수정 권한
      await sequelize.query(
        `UPDATE user_permissions up
         SET can_edit = true, can_create = true, updated_at = NOW()
         FROM users u
         WHERE up.user_id = u.id
           AND up.menu_id = $1::integer
           AND u.tenant_id = $2::integer
           AND u.role IN ('admin', 'root')`,
        { bind: [menuId, tenantId] }
      );
    }
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    await sequelize.query(`
      UPDATE menus SET is_active = false, updated_at = NOW()
      WHERE route = '/my/company-policies'
    `);
    await sequelize.query(`
      UPDATE menus SET "order" = 9, updated_at = NOW()
      WHERE route = '/my/mail-settings' AND is_active = true
    `);
    await queryInterface.dropTable('company_policy_revisions');
    await queryInterface.dropTable('company_policies');
  },
};
