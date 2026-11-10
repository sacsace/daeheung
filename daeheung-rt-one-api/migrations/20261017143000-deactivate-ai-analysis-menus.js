'use strict';

/**
 * 「AI 분석」 및 하위 메뉴 soft-deactivate — 미사용 기능
 * (메뉴 권한·네비 조회는 is_active=true 만 대상)
 */
const AI_ROUTES = [
  '/ai',
  '/ai/cost-analysis',
  '/ai/efficiency-metrics',
  '/ai/forecasting-data',
  '/ai/recommendation-engine',
];

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `
      UPDATE menus
      SET is_active = false, updated_at = NOW()
      WHERE route IN ($1, $2, $3, $4, $5)
    `,
      { bind: AI_ROUTES }
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `
      UPDATE menus
      SET is_active = true, updated_at = NOW()
      WHERE route IN ($1, $2, $3, $4, $5)
    `,
      { bind: AI_ROUTES }
    );
  },
};
