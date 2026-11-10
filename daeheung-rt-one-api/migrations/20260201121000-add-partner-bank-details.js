'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE \"partners\" " +
        "ADD COLUMN IF NOT EXISTS \"bank_ifsc\" VARCHAR(50), " +
        "ADD COLUMN IF NOT EXISTS \"account_holder\" VARCHAR(120);"
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE \"partners\" " +
        "DROP COLUMN IF EXISTS \"bank_ifsc\", " +
        "DROP COLUMN IF EXISTS \"account_holder\";"
    );
  }
};
