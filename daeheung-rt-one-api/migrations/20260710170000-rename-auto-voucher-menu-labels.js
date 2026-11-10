'use strict';

/** 사이드바·메뉴에서 AI 표현 제거 — 전표입력 / Voucher Entry */
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET
        name_en = 'Voucher Entry',
        description = '증빙 업로드 후 전표 검토·승인·장부 반영',
        updated_at = NOW()
      WHERE route = '/accounting/auto-voucher'
        AND (name_en ILIKE '%AI%' OR description ILIKE '%AI%');
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE menus
      SET
        name_en = 'AI Auto Voucher',
        description = 'AI 자동 전표 입력',
        updated_at = NOW()
      WHERE route = '/accounting/auto-voucher';
    `);
  },
};
