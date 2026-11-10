'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 업무 보고서 타입 ENUM 생성
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_work_reports_type" AS ENUM('daily', 'weekly', 'monthly', 'project', 'incident', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 업무 보고서 상태 ENUM 생성
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_work_reports_status" AS ENUM('draft', 'submitted', 'reviewed', 'approved', 'rejected');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 업무 보고서 우선순위 ENUM 생성
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_work_reports_priority" AS ENUM('low', 'medium', 'high', 'urgent');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.createTable('work_reports', {
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
      report_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      type: {
        type: Sequelize.ENUM('daily', 'weekly', 'monthly', 'project', 'incident', 'other'),
        allowNull: false
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      author_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      summary: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      achievements: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: '[]'
      },
      challenges: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: '[]'
      },
      next_steps: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: '[]'
      },
      attachments: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: '[]'
      },
      status: {
        type: Sequelize.ENUM('draft', 'submitted', 'reviewed', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'draft'
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'medium'
      },
      report_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      due_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      reviewer_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      review_comment: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      tags: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: '[]'
      },
      is_public: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    const indexes = await queryInterface.showIndex('work_reports');
    const hasIndex = (name) => indexes.some((index) => index.name === name);

    if (!hasIndex('work_reports_tenant_company_idx')) {
      await queryInterface.addIndex('work_reports', ['tenant_id', 'company_id'], {
        name: 'work_reports_tenant_company_idx'
      });
    }
    if (!hasIndex('work_reports_report_id_idx')) {
      await queryInterface.addIndex('work_reports', ['report_id'], {
        name: 'work_reports_report_id_idx'
      });
    }
    if (!hasIndex('work_reports_author_id_idx')) {
      await queryInterface.addIndex('work_reports', ['author_id'], {
        name: 'work_reports_author_id_idx'
      });
    }
    if (!hasIndex('work_reports_status_idx')) {
      await queryInterface.addIndex('work_reports', ['status'], {
        name: 'work_reports_status_idx'
      });
    }
    if (!hasIndex('work_reports_report_date_idx')) {
      await queryInterface.addIndex('work_reports', ['report_date'], {
        name: 'work_reports_report_date_idx'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('work_reports');
    
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_work_reports_type";
      DROP TYPE IF EXISTS "enum_work_reports_status";
      DROP TYPE IF EXISTS "enum_work_reports_priority";
    `);
  }
};




