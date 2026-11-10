'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // 1. Tenants 테이블
    await queryInterface.createTable('tenants', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      domain: {
        type: Sequelize.STRING(255),
        unique: true,
        allowNull: false
      },
      subdomain: {
        type: Sequelize.STRING(100),
        unique: true,
        allowNull: false
      },
      plan: {
        type: Sequelize.ENUM('basic', 'standard', 'premium', 'enterprise'),
        defaultValue: 'basic',
        allowNull: false
      },
      max_users: {
        type: Sequelize.INTEGER,
        defaultValue: 10,
        allowNull: false
      },
      max_companies: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        allowNull: false
      },
      features: {
        type: Sequelize.JSON,
        defaultValue: [],
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'suspended', 'trial'),
        defaultValue: 'active',
        allowNull: false
      },
      trial_ends_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      subscription_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // 2. Menus 테이블
    await queryInterface.createTable('menus', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'tenants',
          key: 'id'
        }
      },
      parent_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'menus',
          key: 'id'
        }
      },
      name_ko: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      name_en: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      route: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      icon: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      level: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // 3. Companies 테이블
    await queryInterface.createTable('companies', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'tenants',
          key: 'id'
        }
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      business_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      ceo_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      phone: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      website: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      industry: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      employee_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      subscription_plan: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'basic'
      },
      subscription_status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'active'
      },
      company_logo: {
        type: Sequelize.BLOB,
        allowNull: true
      },
      company_seal: {
        type: Sequelize.BLOB,
        allowNull: true
      },
      ceo_signature: {
        type: Sequelize.BLOB,
        allowNull: true
      },
      account_holder_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      bank_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      account_number: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      ifsc_code: {
        type: Sequelize.STRING(11),
        allowNull: true
      },
      bank_address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      swift_code: {
        type: Sequelize.STRING(11),
        allowNull: true
      },
      msme_number: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      iec_number: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      pan_number: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'suspended'),
        allowNull: false,
        defaultValue: 'active'
      },
      login_period_start: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      login_period_end: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      login_time_start: {
        type: Sequelize.TIME,
        allowNull: false,
        defaultValue: '09:00:00'
      },
      login_time_end: {
        type: Sequelize.TIME,
        allowNull: false,
        defaultValue: '18:00:00'
      },
      timezone: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'Asia/Seoul'
      },
      settings: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: '{}'
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // 4. Customers 테이블
    await queryInterface.createTable('customers', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'tenants',
          key: 'id'
        }
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'companies',
          key: 'id'
        }
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      business_number: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      ceo_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      website: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      industry: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'active'
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // 5. Products 테이블
    await queryInterface.createTable('products', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'tenants',
          key: 'id'
        }
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'companies',
          key: 'id'
        }
      },
      product_code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      unit_price: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      cost_price: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      stock_quantity: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      min_stock_level: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      max_stock_level: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1000
      },
      unit: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: '개'
      },
      tax_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'active'
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // 6. Invoices 테이블
    await queryInterface.createTable('invoices', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'tenants',
          key: 'id'
        }
      },
      company_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'companies',
          key: 'id'
        }
      },
      customer_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'customers',
          key: 'id'
        }
      },
      invoice_number: {
        type: Sequelize.STRING(100),
        unique: true
      },
      invoice_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      due_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      subtotal: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      tax_amount: {
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
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'draft'
      },
      payment_status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'pending'
      },
      payment_method: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      payment_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // 7. UserPermissions 테이블
    await queryInterface.createTable('user_permissions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      menu_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'menus',
          key: 'id'
        }
      },
      can_view: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      can_create: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      can_edit: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      can_delete: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // 8. SalesOpportunities 테이블
    await queryInterface.createTable('sales_opportunities', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'tenants',
          key: 'id'
        }
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'companies',
          key: 'id'
        }
      },
      customer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'customers',
          key: 'id'
        }
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      value: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      stage: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'prospecting'
      },
      probability: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 50
      },
      expected_close_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      assigned_to: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'active'
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // 9. Contracts 테이블
    await queryInterface.createTable('contracts', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      contract_number: {
        type: Sequelize.STRING(100),
        unique: true
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT
      },
      value: {
        type: Sequelize.DECIMAL(15, 2)
      },
      start_date: {
        type: Sequelize.DATE
      },
      end_date: {
        type: Sequelize.DATE
      },
      status: {
        type: Sequelize.ENUM('draft', 'active', 'expired', 'terminated'),
        defaultValue: 'draft'
      },
      customer_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'customers',
          key: 'id'
        }
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'tenants',
          key: 'id'
        }
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // 10. SupportTickets 테이블
    await queryInterface.createTable('support_tickets', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      ticket_number: {
        type: Sequelize.STRING(100),
        unique: true
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        defaultValue: 'medium'
      },
      status: {
        type: Sequelize.ENUM('open', 'in_progress', 'resolved', 'closed'),
        defaultValue: 'open'
      },
      customer_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'customers',
          key: 'id'
        }
      },
      assigned_to: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'tenants',
          key: 'id'
        }
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // 11. SupportResponses 테이블
    await queryInterface.createTable('support_responses', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      ticket_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'support_tickets',
          key: 'id'
        }
      },
      user_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      is_internal: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // 12. InvoiceItems 테이블
    await queryInterface.createTable('invoice_items', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      invoice_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'invoices',
          key: 'id'
        }
      },
      product_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'products',
          key: 'id'
        }
      },
      description: {
        type: Sequelize.STRING(255)
      },
      quantity: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      unit_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      total_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // 13. Projects 테이블
    await queryInterface.createTable('projects', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'tenants',
          key: 'id'
        }
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'companies',
          key: 'id'
        }
      },
      customer_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'customers',
          key: 'id'
        }
      },
      project_code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'planning'
      },
      priority: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'medium'
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      budget: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      actual_cost: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      progress: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      project_manager: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // 14. Payrolls 테이블
    await queryInterface.createTable('payrolls', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      employee_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      pay_period_start: {
        type: Sequelize.DATE,
        allowNull: false
      },
      pay_period_end: {
        type: Sequelize.DATE,
        allowNull: false
      },
      basic_salary: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      overtime_pay: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      bonus: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      deductions: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      net_pay: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('draft', 'approved', 'paid'),
        defaultValue: 'draft'
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'tenants',
          key: 'id'
        }
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // 15. InventoryTransactions 테이블
    await queryInterface.createTable('inventory_transactions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      product_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'products',
          key: 'id'
        }
      },
      transaction_type: {
        type: Sequelize.ENUM('in', 'out', 'adjustment', 'transfer'),
        allowNull: false
      },
      quantity: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      unit_cost: {
        type: Sequelize.DECIMAL(10, 2)
      },
      total_cost: {
        type: Sequelize.DECIMAL(10, 2)
      },
      reference_type: {
        type: Sequelize.STRING(50)
      },
      reference_id: {
        type: Sequelize.INTEGER
      },
      notes: {
        type: Sequelize.TEXT
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'tenants',
          key: 'id'
        }
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });
  },

  async down (queryInterface, Sequelize) {
    // 테이블 삭제 (역순으로)
    await queryInterface.dropTable('inventory_transactions');
    await queryInterface.dropTable('payrolls');
    await queryInterface.dropTable('projects');
    await queryInterface.dropTable('invoice_items');
    await queryInterface.dropTable('invoices');
    await queryInterface.dropTable('support_responses');
    await queryInterface.dropTable('support_tickets');
    await queryInterface.dropTable('contracts');
    await queryInterface.dropTable('sales_opportunities');
    await queryInterface.dropTable('products');
    await queryInterface.dropTable('customers');
    await queryInterface.dropTable('companies');
    await queryInterface.dropTable('user_permissions');
    await queryInterface.dropTable('menus');
    await queryInterface.dropTable('tenants');
  }
};
