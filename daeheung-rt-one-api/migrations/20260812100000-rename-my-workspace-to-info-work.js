'use strict';

/** 상위 메뉴 표기: 내 업무 → 내 정보·업무 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `
      UPDATE menus
      SET name_ko = $1,
          name_en = $2,
          description = $3,
          updated_at = NOW()
      WHERE route = '/my' AND parent_id IS NULL
      `,
      { bind: ['내 정보·업무', 'My Info & Work', '내 정보·업무'] }
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
      WHERE route = '/my' AND parent_id IS NULL
      `,
      { bind: ['내 업무', 'My Workspace', '내 업무'] }
    );
  },
};
