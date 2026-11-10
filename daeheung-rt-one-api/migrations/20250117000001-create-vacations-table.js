'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 휴가 유형 ENUM 타입 생성
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_vacations_vacation_type" AS ENUM('annual', 'sick', 'personal', 'study', 'maternity', 'paternity');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 휴가 상태 ENUM 타입 생성
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_vacations_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // vacations 테이블 생성
    await queryInterface.createTable('vacations', {
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
      vacation_type: {
        type: Sequelize.ENUM('annual', 'sick', 'personal', 'study', 'maternity', 'paternity'),
        allowNull: false
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      days: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending'
      },
      applied_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_DATE')
      },
      approved_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      approved_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      rejection_reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      attachments: {
        type: Sequelize.TEXT,
        allowNull: true
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
    const indexes = await queryInterface.showIndex('vacations');
    const hasIndex = (name) => indexes.some((index) => index.name === name);

    if (!hasIndex('vacations_tenant_company_idx')) {
      await queryInterface.addIndex('vacations', ['tenant_id', 'company_id'], {
        name: 'vacations_tenant_company_idx'
      });
    }
    if (!hasIndex('vacations_user_id_idx')) {
      await queryInterface.addIndex('vacations', ['user_id'], {
        name: 'vacations_user_id_idx'
      });
    }
    if (!hasIndex('vacations_status_idx')) {
      await queryInterface.addIndex('vacations', ['status'], {
        name: 'vacations_status_idx'
      });
    }
    if (!hasIndex('vacations_dates_idx')) {
      await queryInterface.addIndex('vacations', ['start_date', 'end_date'], {
        name: 'vacations_dates_idx'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('vacations');
    
    // ENUM 타입 삭제
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_vacations_vacation_type";
      DROP TYPE IF EXISTS "enum_vacations_status";
    `);
  }
};







