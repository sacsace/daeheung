'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE \"users\" ADD COLUMN IF NOT EXISTS \"is_payment_officer\" BOOLEAN NOT NULL DEFAULT false;"
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE \"users\" DROP COLUMN IF EXISTS \"is_payment_officer\";"
    );
  }
};
