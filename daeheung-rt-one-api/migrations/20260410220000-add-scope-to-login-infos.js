'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('login_infos');
    if (!table.scope) {
      await queryInterface.addColumn('login_infos', 'scope', {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'external'
      });
    }

    const indexes = await queryInterface.showIndex('login_infos');
    const hasIndexOnFields = (fields) =>
      indexes.some((index) => {
        const indexFields = (index.fields || []).map((field) => field.attribute);
        return (
          indexFields.length === fields.length &&
          indexFields.every((field, idx) => field === fields[idx])
        );
      });

    if (!hasIndexOnFields(['company_id', 'scope'])) {
      await queryInterface.addIndex('login_infos', ['company_id', 'scope'], {
        name: 'login_infos_company_id_scope_idx'
      });
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeIndex('login_infos', 'login_infos_company_id_scope_idx');
    } catch {
      // ignore
    }
    const table = await queryInterface.describeTable('login_infos');
    if (table.scope) {
      await queryInterface.removeColumn('login_infos', 'scope');
    }
  }
};
