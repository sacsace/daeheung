'use strict';

/**
 * OT 적용 대상 기본값: 미적용
 * - 컬럼 default 를 false 로 유지/보정
 * - 기존 직원도 기본적으로 미적용으로 맞춤 (필요 시 인사정보에서 개별 체크)
 */

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    await sequelize.query(
      'ALTER TABLE "users" ALTER COLUMN "ot_eligible" SET DEFAULT false;'
    ).catch(() => {});
    await sequelize.query(
      'UPDATE "users" SET "ot_eligible" = false WHERE "ot_eligible" IS DISTINCT FROM false;'
    );
  },

  async down(queryInterface) {
    // 개별 true 복원은 불가 — default 만 되돌림
    await queryInterface.sequelize.query(
      'ALTER TABLE "users" ALTER COLUMN "ot_eligible" SET DEFAULT false;'
    ).catch(() => {});
  },
};
