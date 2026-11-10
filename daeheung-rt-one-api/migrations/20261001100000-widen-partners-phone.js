'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // API validation allows phone maxLength 50; dual numbers exceed VARCHAR(20)
    await queryInterface.sequelize.query(
      'ALTER TABLE "partners" ALTER COLUMN "phone" TYPE VARCHAR(50);'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "partners" ALTER COLUMN "phone" TYPE VARCHAR(20);'
    );
  },
};
