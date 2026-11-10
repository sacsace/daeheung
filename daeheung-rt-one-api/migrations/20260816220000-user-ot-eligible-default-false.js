'use strict';

/** 신규 사용자 기본값: OT 미적용 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "users" ALTER COLUMN "ot_eligible" SET DEFAULT false;'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "users" ALTER COLUMN "ot_eligible" SET DEFAULT true;'
    );
  }
};
