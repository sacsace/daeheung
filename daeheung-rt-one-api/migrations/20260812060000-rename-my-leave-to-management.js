'use strict';

/** 내 업무 > 휴가 메뉴 명칭: 휴가 신청 → 휴가 관리 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `
      UPDATE menus
      SET name_ko = $1,
          name_en = $2,
          description = $3,
          updated_at = NOW()
      WHERE route = '/my/leave'
      `,
      { bind: ['휴가 관리', 'Leave Management', '휴가 조회·신청'] }
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `
      UPDATE menus
      SET name_ko = $1,
          name_en = $2,
          description = $3,
          updated_at = NOW()
      WHERE route = '/my/leave'
      `,
      { bind: ['휴가 신청', 'Leave Request', '휴가 신청 및 조회'] }
    );
  },
};
