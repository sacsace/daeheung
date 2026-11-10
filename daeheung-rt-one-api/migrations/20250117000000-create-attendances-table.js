'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 근태 상태 ENUM 타입 생성
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_attendances_status" AS ENUM('normal', 'late', 'early', 'overtime', 'absent');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // attendances 테이블 생성
    await queryInterface.createTable('attendances', {
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
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      check_in: {
        type: Sequelize.DATE,
        allowNull: true
      },
      check_out: {
        type: Sequelize.DATE,
        allowNull: true
      },
      work_hours: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('normal', 'late', 'early', 'overtime', 'absent'),
        allowNull: false,
        defaultValue: 'normal'
      },
      notes: {
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
    const indexes = await queryInterface.showIndex('attendances');
    const hasIndex = (name) => indexes.some((index) => index.name === name);

    if (!hasIndex('attendances_tenant_company_idx')) {
      await queryInterface.addIndex('attendances', ['tenant_id', 'company_id'], {
        name: 'attendances_tenant_company_idx'
      });
    }
    if (!hasIndex('attendances_user_id_idx')) {
      await queryInterface.addIndex('attendances', ['user_id'], {
        name: 'attendances_user_id_idx'
      });
    }
    if (!hasIndex('attendances_date_idx')) {
      await queryInterface.addIndex('attendances', ['date'], {
        name: 'attendances_date_idx'
      });
    }

    // 사용자와 날짜의 유니크 제약 조건
    if (!hasIndex('attendances_user_date_unique')) {
      await queryInterface.addIndex('attendances', ['user_id', 'date'], {
        unique: true,
        name: 'attendances_user_date_unique'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('attendances');
    
    // ENUM 타입 삭제
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_attendances_status";
    `);
  }
};







