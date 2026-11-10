'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 성과 상태 ENUM 타입 생성
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_performances_status" AS ENUM('draft', 'submitted', 'reviewed', 'approved', 'finalized');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // performances 테이블 생성
    await queryInterface.createTable('performances', {
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
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      review_period: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      overall_rating: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 0
      },
      goals: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: '[]'
      },
      competencies: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: '[]'
      },
      strengths: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: '[]'
      },
      improvements: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: '[]'
      },
      manager_comment: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      employee_comment: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('draft', 'submitted', 'reviewed', 'approved', 'finalized'),
        allowNull: false,
        defaultValue: 'draft'
      },
      reviewed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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

    // 인덱스 생성
    const indexes = await queryInterface.showIndex('performances');
    const hasIndex = (name) => indexes.some((index) => index.name === name);

    if (!hasIndex('performances_tenant_company_idx')) {
      await queryInterface.addIndex('performances', ['tenant_id', 'company_id'], {
        name: 'performances_tenant_company_idx'
      });
    }
    if (!hasIndex('performances_user_id_idx')) {
      await queryInterface.addIndex('performances', ['user_id'], {
        name: 'performances_user_id_idx'
      });
    }
    if (!hasIndex('performances_status_idx')) {
      await queryInterface.addIndex('performances', ['status'], {
        name: 'performances_status_idx'
      });
    }
    if (!hasIndex('performances_review_period_idx')) {
      await queryInterface.addIndex('performances', ['review_period'], {
        name: 'performances_review_period_idx'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('performances');
    
    // ENUM 타입 삭제
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_performances_status";
    `);
  }
};







