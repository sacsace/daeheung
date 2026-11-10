/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "customers"
      ALTER COLUMN "business_number" TYPE VARCHAR(50);
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "customers"
      ALTER COLUMN "business_number" TYPE VARCHAR(20);
    `);
  }
};
