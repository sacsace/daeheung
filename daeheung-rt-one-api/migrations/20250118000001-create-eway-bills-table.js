'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // E-Way Bill 공급 유형 ENUM 생성
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_eway_bills_supply_type" AS ENUM('outward', 'inward');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // E-Way Bill 문서 유형 ENUM 생성
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_eway_bills_document_type" AS ENUM('invoice', 'credit_note', 'debit_note', 'bill_of_supply');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // E-Way Bill 운송 수단 ENUM 생성
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_eway_bills_transport_mode" AS ENUM('road', 'rail', 'air', 'ship');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // E-Way Bill 상태 ENUM 생성
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_eway_bills_status" AS ENUM('draft', 'generated', 'active', 'expired', 'cancelled', 'rejected');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.createTable('eway_bills', {
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
      eway_bill_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      invoice_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'invoices',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      invoice_number: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      invoice_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      supply_type: {
        type: Sequelize.ENUM('outward', 'inward'),
        allowNull: false
      },
      sub_supply_type: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      document_type: {
        type: Sequelize.ENUM('invoice', 'credit_note', 'debit_note', 'bill_of_supply'),
        allowNull: false,
        defaultValue: 'invoice'
      },
      document_number: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      document_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      from_gstin: {
        type: Sequelize.STRING(15),
        allowNull: false
      },
      from_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      from_address: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      from_pincode: {
        type: Sequelize.STRING(10),
        allowNull: false
      },
      from_state: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      from_state_code: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      to_gstin: {
        type: Sequelize.STRING(15),
        allowNull: true
      },
      to_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      to_address: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      to_pincode: {
        type: Sequelize.STRING(10),
        allowNull: false
      },
      to_state: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      to_state_code: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      transport_mode: {
        type: Sequelize.ENUM('road', 'rail', 'air', 'ship'),
        allowNull: false,
        defaultValue: 'road'
      },
      vehicle_number: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      vehicle_type: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      transporter_id: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      transporter_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      transporter_gstin: {
        type: Sequelize.STRING(15),
        allowNull: true
      },
      transporter_doc_number: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      transporter_doc_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      distance: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      total_value: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      total_tax_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      total_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      status: {
        type: Sequelize.ENUM('draft', 'generated', 'active', 'expired', 'cancelled', 'rejected'),
        allowNull: false,
        defaultValue: 'draft'
      },
      generated_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      valid_until: {
        type: Sequelize.DATE,
        allowNull: true
      },
      cancelled_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      cancellation_reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      generated_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      qr_code: {
        type: Sequelize.TEXT,
        allowNull: true
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

    const ewayBillIndexes = await queryInterface.showIndex('eway_bills');
    const hasEwayBillIndex = (name) =>
      ewayBillIndexes.some((index) => index.name === name);

    if (!hasEwayBillIndex('eway_bills_tenant_company_idx')) {
      await queryInterface.addIndex('eway_bills', ['tenant_id', 'company_id'], {
        name: 'eway_bills_tenant_company_idx'
      });
    }
    if (!hasEwayBillIndex('eway_bills_eway_bill_number_idx')) {
      await queryInterface.addIndex('eway_bills', ['eway_bill_number'], {
        name: 'eway_bills_eway_bill_number_idx',
        unique: true
      });
    }
    if (!hasEwayBillIndex('eway_bills_invoice_id_idx')) {
      await queryInterface.addIndex('eway_bills', ['invoice_id'], {
        name: 'eway_bills_invoice_id_idx'
      });
    }
    if (!hasEwayBillIndex('eway_bills_invoice_number_idx')) {
      await queryInterface.addIndex('eway_bills', ['invoice_number'], {
        name: 'eway_bills_invoice_number_idx'
      });
    }
    if (!hasEwayBillIndex('eway_bills_status_idx')) {
      await queryInterface.addIndex('eway_bills', ['status'], {
        name: 'eway_bills_status_idx'
      });
    }
    if (!hasEwayBillIndex('eway_bills_generated_at_idx')) {
      await queryInterface.addIndex('eway_bills', ['generated_at'], {
        name: 'eway_bills_generated_at_idx'
      });
    }

    // E-Way Bill Items 테이블 생성
    await queryInterface.createTable('eway_bill_items', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      eway_bill_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'eway_bills',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      item_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      hsn_code: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      quantity: {
        type: Sequelize.DECIMAL(15, 3),
        allowNull: false,
        defaultValue: 0
      },
      unit: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'PCS'
      },
      unit_price: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      total_value: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      cgst_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      cgst_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0
      },
      sgst_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      sgst_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0
      },
      igst_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      igst_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0
      },
      cess_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      cess_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0
      },
      total_tax_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      total_amount: {
        type: Sequelize.DECIMAL(15, 2),
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

    const ewayBillItemIndexes = await queryInterface.showIndex('eway_bill_items');
    const hasEwayBillItemIndex = (name) =>
      ewayBillItemIndexes.some((index) => index.name === name);

    if (!hasEwayBillItemIndex('eway_bill_items_eway_bill_id_idx')) {
      await queryInterface.addIndex('eway_bill_items', ['eway_bill_id'], {
        name: 'eway_bill_items_eway_bill_id_idx'
      });
    }
    if (!hasEwayBillItemIndex('eway_bill_items_hsn_code_idx')) {
      await queryInterface.addIndex('eway_bill_items', ['hsn_code'], {
        name: 'eway_bill_items_hsn_code_idx'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('eway_bill_items');
    await queryInterface.dropTable('eway_bills');
    
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_eway_bills_supply_type";
      DROP TYPE IF EXISTS "enum_eway_bills_document_type";
      DROP TYPE IF EXISTS "enum_eway_bills_transport_mode";
      DROP TYPE IF EXISTS "enum_eway_bills_status";
    `);
  }
};



