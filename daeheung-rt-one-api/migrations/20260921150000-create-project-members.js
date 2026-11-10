'use strict';

/**
 * 프로젝트 멤버십 + 기존 프로젝트 Owner/Manager 백필
 * Soft-delete: is_active + deleted_at (paranoid 패턴)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('project_members', {
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
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'projects', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      role: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'member',
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'active',
      },
      invited_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      invited_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      joined_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('project_members', ['tenant_id', 'company_id', 'project_id']);
    await queryInterface.addIndex('project_members', ['project_id', 'user_id']);
    await queryInterface.addIndex('project_members', ['user_id', 'is_active']);

    // 기존 프로젝트: project_manager + created_by 를 owner/manager 멤버로 백필
    await queryInterface.sequelize.query(`
      INSERT INTO project_members (
        tenant_id, company_id, project_id, user_id, role, status,
        invited_by, invited_at, joined_at, is_active, created_at, updated_at
      )
      SELECT
        p.tenant_id,
        p.company_id,
        p.id,
        p.project_manager,
        'owner',
        'active',
        p.created_by,
        COALESCE(p.created_at, NOW()),
        COALESCE(p.created_at, NOW()),
        true,
        NOW(),
        NOW()
      FROM projects p
      WHERE p.is_active = true
        AND p.project_manager IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM project_members m
          WHERE m.project_id = p.id AND m.user_id = p.project_manager AND m.deleted_at IS NULL
        )
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO project_members (
        tenant_id, company_id, project_id, user_id, role, status,
        invited_by, invited_at, joined_at, is_active, created_at, updated_at
      )
      SELECT
        p.tenant_id,
        p.company_id,
        p.id,
        p.created_by,
        CASE WHEN p.created_by = p.project_manager THEN 'owner' ELSE 'manager' END,
        'active',
        p.created_by,
        COALESCE(p.created_at, NOW()),
        COALESCE(p.created_at, NOW()),
        true,
        NOW(),
        NOW()
      FROM projects p
      WHERE p.is_active = true
        AND p.created_by IS NOT NULL
        AND p.created_by <> p.project_manager
        AND NOT EXISTS (
          SELECT 1 FROM project_members m
          WHERE m.project_id = p.id AND m.user_id = p.created_by AND m.deleted_at IS NULL
        )
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('project_members');
  },
};
