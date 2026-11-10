'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 회의실 예약 상태 ENUM 생성
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_room_bookings_status" AS ENUM('confirmed', 'pending', 'cancelled', 'checked_in', 'checked_out', 'no_show');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 결제 상태 ENUM 생성
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_room_bookings_payment_status" AS ENUM('pending', 'paid', 'refunded', 'partial');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.createTable('room_bookings', {
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
      booking_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      room_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      room_number: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      room_type: {
        type: Sequelize.STRING(50),
        allowNull: false
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
      guest_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      guest_email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      guest_phone: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      check_in_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      check_out_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      number_of_guests: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      total_nights: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      total_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
      },
      status: {
        type: Sequelize.ENUM('confirmed', 'pending', 'cancelled', 'checked_in', 'checked_out', 'no_show'),
        allowNull: false,
        defaultValue: 'pending'
      },
      payment_status: {
        type: Sequelize.ENUM('pending', 'paid', 'refunded', 'partial'),
        allowNull: false,
        defaultValue: 'pending'
      },
      payment_method: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      special_requests: {
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

    const indexes = await queryInterface.showIndex('room_bookings');
    const hasIndex = (name) => indexes.some((index) => index.name === name);

    if (!hasIndex('room_bookings_tenant_company_idx')) {
      await queryInterface.addIndex('room_bookings', ['tenant_id', 'company_id'], {
        name: 'room_bookings_tenant_company_idx'
      });
    }
    if (!hasIndex('room_bookings_booking_id_idx')) {
      await queryInterface.addIndex('room_bookings', ['booking_id'], {
        name: 'room_bookings_booking_id_idx'
      });
    }
    if (!hasIndex('room_bookings_room_id_idx')) {
      await queryInterface.addIndex('room_bookings', ['room_id'], {
        name: 'room_bookings_room_id_idx'
      });
    }
    if (!hasIndex('room_bookings_user_id_idx')) {
      await queryInterface.addIndex('room_bookings', ['user_id'], {
        name: 'room_bookings_user_id_idx'
      });
    }
    if (!hasIndex('room_bookings_dates_idx')) {
      await queryInterface.addIndex('room_bookings', ['check_in_date', 'check_out_date'], {
        name: 'room_bookings_dates_idx'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('room_bookings');
    
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_room_bookings_status";
      DROP TYPE IF EXISTS "enum_room_bookings_payment_status";
    `);
  }
};




