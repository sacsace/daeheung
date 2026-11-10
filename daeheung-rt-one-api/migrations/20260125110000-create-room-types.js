'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('room_types', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'tenants',
          key: 'id',
        },
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'companies',
          key: 'id',
        },
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      room_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      nightly_rate: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });

    const indexes = await queryInterface.showIndex('room_types');
    const hasIndexOnFields = (fields) =>
      indexes.some((index) => {
        const indexFields = (index.fields || []).map((field) => field.attribute);
        return indexFields.length === fields.length
          && indexFields.every((field, idx) => field === fields[idx]);
      });

    if (!hasIndexOnFields(['tenant_id', 'company_id'])) {
      await queryInterface.addIndex('room_types', ['tenant_id', 'company_id'], {
        name: 'room_types_tenant_company_idx',
      });
    }
    if (!hasIndexOnFields(['tenant_id', 'company_id', 'name'])) {
      await queryInterface.addIndex('room_types', ['tenant_id', 'company_id', 'name'], {
        unique: true,
        name: 'room_types_tenant_company_name_unique',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('room_types');
  },
};
