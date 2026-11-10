'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 견적서 상태 ENUM 생성
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_quotations_status" AS ENUM('draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.createTable('quotations', {
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
      quotation_number: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      customer_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'customers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      customer_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      customer_email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      customer_phone: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      customer_address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      items: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: '[]'
      },
      subtotal: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      tax_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0
      },
      tax_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      discount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      total_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      currency: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'KRW'
      },
      valid_until: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled'),
        allowNull: false,
        defaultValue: 'draft'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      terms: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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

    const indexes = await queryInterface.showIndex('quotations');
    const hasIndex = (name) => indexes.some((index) => index.name === name);

    if (!hasIndex('quotations_tenant_company_idx')) {
      await queryInterface.addIndex('quotations', ['tenant_id', 'company_id'], {
        name: 'quotations_tenant_company_idx'
      });
    }
    if (!hasIndex('quotations_quotation_number_idx')) {
      await queryInterface.addIndex('quotations', ['quotation_number'], {
        name: 'quotations_quotation_number_idx'
      });
    }
    if (!hasIndex('quotations_customer_id_idx')) {
      await queryInterface.addIndex('quotations', ['customer_id'], {
        name: 'quotations_customer_id_idx'
      });
    }
    if (!hasIndex('quotations_status_idx')) {
      await queryInterface.addIndex('quotations', ['status'], {
        name: 'quotations_status_idx'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('quotations');
    
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_quotations_status";
    `);
  }
};







