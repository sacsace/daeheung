'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // enum에 study, maternity, paternity 누락 시: VARCHAR로 변경
    // (ALTER TYPE ADD VALUE는 enum 소유자만 가능하여 mvs_user에서 실패하는 경우 대안)
    await queryInterface.sequelize.query(`
      ALTER TABLE vacations 
      ALTER COLUMN vacation_type TYPE VARCHAR(50) 
      USING vacation_type::text;
    `);
  },

  async down() {
    // PostgreSQL enum에서 값 제거는 복잡하므로 down은 비워둠
    // 필요 시 enum 재생성 마이그레이션 별도 작성
  }
};
