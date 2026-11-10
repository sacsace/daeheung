'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('work_statistics', {
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
      period: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      total_hours: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      productive_hours: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      tasks_completed: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      tasks_assigned: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      efficiency: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0
      },
      productivity: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0
      },
      attendance_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0
      },
      overtime_hours: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      break_time: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      focus_time: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      meeting_time: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      code_review_time: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      testing_time: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      documentation_time: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
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

    const indexes = await queryInterface.showIndex('work_statistics');
    const hasIndex = (name) => indexes.some((index) => index.name === name);

    if (!hasIndex('work_statistics_tenant_company_idx')) {
      await queryInterface.addIndex('work_statistics', ['tenant_id', 'company_id'], {
        name: 'work_statistics_tenant_company_idx'
      });
    }
    if (!hasIndex('work_statistics_user_id_idx')) {
      await queryInterface.addIndex('work_statistics', ['user_id'], {
        name: 'work_statistics_user_id_idx'
      });
    }
    if (!hasIndex('work_statistics_period_idx')) {
      await queryInterface.addIndex('work_statistics', ['period'], {
        name: 'work_statistics_period_idx'
      });
    }
    if (!hasIndex('work_statistics_user_period_unique_idx')) {
      await queryInterface.addIndex('work_statistics', ['user_id', 'period'], {
        unique: true,
        name: 'work_statistics_user_period_unique_idx'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('work_statistics');
  }
};







