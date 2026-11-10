'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('login_infos', {
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
      division: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      login_id: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      open_file_returns: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      url: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
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

    const indexes = await queryInterface.showIndex('login_infos');
    const hasIndexOnFields = (fields) =>
      indexes.some((index) => {
        const indexFields = (index.fields || []).map((field) => field.attribute);
        return indexFields.length === fields.length
          && indexFields.every((field, idx) => field === fields[idx]);
      });

    if (!hasIndexOnFields(['tenant_id'])) {
      await queryInterface.addIndex('login_infos', ['tenant_id'], {
        name: 'login_infos_tenant_id_idx'
      });
    }
    if (!hasIndexOnFields(['company_id'])) {
      await queryInterface.addIndex('login_infos', ['company_id'], {
        name: 'login_infos_company_id_idx'
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('login_infos');
  }
};
