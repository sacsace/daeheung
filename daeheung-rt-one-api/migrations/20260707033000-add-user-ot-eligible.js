'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ot_eligible" BOOLEAN NOT NULL DEFAULT true;'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "ot_eligible";'
    );
  }
};
