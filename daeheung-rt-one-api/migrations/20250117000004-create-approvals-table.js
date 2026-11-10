'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 전자 결제 타입 ENUM 생성
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_approvals_type" AS ENUM('expense', 'vacation', 'purchase', 'contract', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 전자 결제 상태 ENUM 생성
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_approvals_status" AS ENUM('draft', 'submitted', 'in_review', 'approved', 'rejected', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 전자 결제 우선순위 ENUM 생성
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_approvals_priority" AS ENUM('low', 'medium', 'high', 'urgent');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.createTable('approvals', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'tenants',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'companies',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      document_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      type: {
        type: Sequelize.ENUM('expense', 'vacation', 'purchase', 'contract', 'other'),
        allowNull: false
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      requester_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      attachments: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('draft', 'submitted', 'in_review', 'approved', 'rejected', 'cancelled'),
        allowNull: false,
        defaultValue: 'draft'
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'medium'
      },
      current_approver_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      approval_flow: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: '[]'
      },
      due_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      comments: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: '[]'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    const indexes = await queryInterface.showIndex('approvals');
    const hasIndex = (name) => indexes.some((index) => index.name === name);

    if (!hasIndex('approvals_tenant_company_idx')) {
      await queryInterface.addIndex('approvals', ['tenant_id', 'company_id'], {
        name: 'approvals_tenant_company_idx'
      });
    }
    if (!hasIndex('approvals_requester_id_idx')) {
      await queryInterface.addIndex('approvals', ['requester_id'], {
        name: 'approvals_requester_id_idx'
      });
    }
    if (!hasIndex('approvals_status_idx')) {
      await queryInterface.addIndex('approvals', ['status'], {
        name: 'approvals_status_idx'
      });
    }
    if (!hasIndex('approvals_document_id_idx')) {
      await queryInterface.addIndex('approvals', ['document_id'], {
        name: 'approvals_document_id_idx'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('approvals');
    
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_approvals_type";
      DROP TYPE IF EXISTS "enum_approvals_status";
      DROP TYPE IF EXISTS "enum_approvals_priority";
    `);
  }
};







