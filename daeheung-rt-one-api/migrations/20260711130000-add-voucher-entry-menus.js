'use strict';

/** 직관적 전표 입력 화면 메뉴 추가 */
module.exports = {
  async up(queryInterface) {
    const [parents] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id FROM menus WHERE route = '/accounting' AND parent_id IS NULL AND is_active = true
    `);

    for (const parent of parents) {
      // 기존 auto-voucher 메뉴가 있으면 경로만 변경 (신규 INSERT 하지 않음)
      const [legacy] = await queryInterface.sequelize.query(
        `SELECT id FROM menus WHERE tenant_id = $1 AND route = '/accounting/auto-voucher' LIMIT 1`,
        { bind: [parent.tenant_id] }
      );

      if (legacy[0]?.id) {
        await queryInterface.sequelize.query(
          `UPDATE menus SET route = '/accounting/voucher-entry', name_ko = '전표 입력', name_en = 'Voucher Entry',
           icon = 'receipt_long', "order" = 4, description = '간편·고급 전표 입력', is_active = true, updated_at = NOW()
           WHERE id = $1`,
          { bind: [legacy[0].id] }
        );
      }

      const routes = [
        { route: '/accounting/voucher-entry', name_ko: '전표 입력', name_en: 'Voucher Entry', icon: 'receipt_long', order: 4, description: '간편·고급 전표 입력', skipIfLegacy: true },
        { route: '/accounting/voucher-list', name_ko: '전표 조회', name_en: 'Voucher List', icon: 'list_alt', order: 5, description: '전표 목록·상태 조회' },
        { route: '/accounting/settings/masters', name_ko: '회계 마스터', name_en: 'Accounting Masters', icon: 'tune', order: 9, description: '전표유형·거래항목·GST·TDS·은행 관리' },
        { route: '/accounting/document-voucher', name_ko: '증빙 전표', name_en: 'Document Voucher', icon: 'upload_file', order: 10, description: '증빙 업로드·자동 분류' },
      ];

      for (const item of routes) {
        if (item.skipIfLegacy && legacy[0]?.id) continue;

        const [existing] = await queryInterface.sequelize.query(
          `SELECT id FROM menus WHERE tenant_id = $1 AND route = $2 LIMIT 1`,
          { bind: [parent.tenant_id, item.route] }
        );
        if (!existing[0]?.id) {
          await queryInterface.sequelize.query(
            `INSERT INTO menus (tenant_id, parent_id, name_ko, name_en, route, icon, "order", level, is_active, description, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 2, true, $8, NOW(), NOW())`,
            { bind: [parent.tenant_id, parent.id, item.name_ko, item.name_en, item.route, item.icon, item.order, item.description] }
          );
        } else {
          await queryInterface.sequelize.query(
            `UPDATE menus SET is_active = true, name_ko = $1, name_en = $2, icon = $3, "order" = $4, description = $5, updated_at = NOW() WHERE id = $6`,
            { bind: [item.name_ko, item.name_en, item.icon, item.order, item.description, existing[0].id] }
          );
        }
      }
    }
  },

  async down(queryInterface) {
    const [parents] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id FROM menus WHERE route = '/accounting' AND parent_id IS NULL
    `);
    for (const parent of parents) {
      for (const route of ['/accounting/voucher-list', '/accounting/settings/masters', '/accounting/document-voucher']) {
        await queryInterface.sequelize.query(
          `UPDATE menus SET is_active = false WHERE tenant_id = $1 AND route = $2`,
          { bind: [parent.tenant_id, route] }
        );
      }
    }
  },
};
