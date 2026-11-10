'use strict';

/**
 * 메일 발송 테스트 메뉴 보강
 * - 이전 마이그레이션(20260412150000)이 `level = 1`인 부모만 찾아,
 *   실제 DB에서 기본정보 최상위가 level 0이면 메뉴가 한 건도 추가되지 않을 수 있음.
 * - 부모: route = '/basic-info' AND parent_id IS NULL
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [parents] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id
      FROM menus
      WHERE route = '/basic-info' AND parent_id IS NULL
    `);

    for (const row of parents) {
      const [existing] = await queryInterface.sequelize.query(
        `
        SELECT id FROM menus
        WHERE tenant_id = $1 AND route = '/basic-info/mail-send-test'
        `,
        { bind: [row.tenant_id] }
      );

      if (existing.length > 0) {
        continue;
      }

      const [orderRows] = await queryInterface.sequelize.query(
        `
        SELECT COALESCE(MAX("order"), 0) AS max_order
        FROM menus
        WHERE tenant_id = $1 AND parent_id = $2
        `,
        { bind: [row.tenant_id, row.id] }
      );

      const nextOrder = Number(orderRows?.[0]?.max_order || 0) + 1;

      await queryInterface.sequelize.query(
        `
        INSERT INTO menus (
          tenant_id, parent_id, name_ko, name_en, route, icon, "order", level, is_active, description, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 2, true, $8, NOW(), NOW()
        )
        `,
        {
          bind: [
            row.tenant_id,
            row.id,
            '메일 발송 테스트',
            'Mail send test',
            '/basic-info/mail-send-test',
            'email',
            nextOrder,
            'SMTP 설정이 정상인지 확인하기 위한 테스트 메일을 보냅니다.'
          ]
        }
      );
    }

    const [newMenuRows] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id FROM menus WHERE route = '/basic-info/mail-send-test'
    `);

    for (const m of newMenuRows) {
      await queryInterface.sequelize.query(
        `
        INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
        SELECT u.id, $1, true, true, true, true, NOW(), NOW()
        FROM users u
        WHERE u.tenant_id = $2 AND u.role IN ('admin', 'root')
        AND NOT EXISTS (
          SELECT 1 FROM user_permissions p WHERE p.user_id = u.id AND p.menu_id = $1
        )
        `,
        { bind: [m.id, m.tenant_id] }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM user_permissions WHERE menu_id IN (
        SELECT id FROM menus WHERE route = '/basic-info/mail-send-test'
      )
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM menus WHERE route = '/basic-info/mail-send-test'
    `);
  }
};
