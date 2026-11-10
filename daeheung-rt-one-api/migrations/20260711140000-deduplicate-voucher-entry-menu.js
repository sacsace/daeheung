'use strict';

/**
 * 전표 입력 메뉴 중복 제거
 * 원인: 20260711130000 마이그레이션이
 *  1) /accounting/auto-voucher → /accounting/voucher-entry 로 경로 변경
 *  2) /accounting/voucher-entry 신규 메뉴 INSERT
 * 를 동시에 수행하여 동일 라우트 메뉴가 2개 활성화됨
 */
module.exports = {
  async up(queryInterface) {
    const [parents] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id FROM menus WHERE route = '/accounting' AND parent_id IS NULL AND is_active = true
    `);

    for (const parent of parents) {
      const [dupes] = await queryInterface.sequelize.query(
        `
        SELECT id, route, name_ko, "order"
        FROM menus
        WHERE tenant_id = $1
          AND parent_id = $2
          AND is_active = true
          AND route = '/accounting/voucher-entry'
        ORDER BY id ASC
        `,
        { bind: [parent.tenant_id, parent.id] }
      );

      if (dupes.length <= 1) continue;

      const keepId = dupes[0].id;
      const removeIds = dupes.slice(1).map((d) => d.id);

      await queryInterface.sequelize.query(
        `
        UPDATE menus
        SET is_active = false, updated_at = NOW()
        WHERE id = ANY($1::int[])
        `,
        { bind: [removeIds] }
      );

      await queryInterface.sequelize.query(
        `
        UPDATE menus
        SET name_ko = '전표 입력', name_en = 'Voucher Entry', icon = 'receipt_long',
            "order" = 4, description = '간편·고급 전표 입력', updated_at = NOW()
        WHERE id = $1
        `,
        { bind: [keepId] }
      );
    }

    // 혹시 남아있는 auto-voucher 경로는 비활성화 (document-voucher로 대체됨)
    await queryInterface.sequelize.query(`
      UPDATE menus SET is_active = false, updated_at = NOW()
      WHERE route = '/accounting/auto-voucher' AND is_active = true
    `);
  },

  async down() {
    // 데이터 복구 불필요 — 중복 제거는 비가역 정리
  },
};
