'use strict';

/**
 * 인사 관리 > 급여발송 (/hr/payslip-send)
 * - 확정된 급여 목록에서 PDF 명세서를 직원 이메일로 보내는 전용 화면
 * - 관리자/root에 조회·발송(create/edit) 권한 부여
 */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const [parents] = await sequelize.query(`
      SELECT id, tenant_id
      FROM menus
      WHERE route = '/hr' AND parent_id IS NULL
    `);

    for (const parent of parents) {
      const [existing] = await sequelize.query(
        `
        SELECT id
        FROM menus
        WHERE tenant_id = $1 AND route = '/hr/payslip-send'
        LIMIT 1
        `,
        { bind: [parent.tenant_id] }
      );

      let menuId;
      if (existing.length > 0) {
        menuId = existing[0].id;
        await sequelize.query(
          `
          UPDATE menus
          SET parent_id = $2, name_ko = $3, name_en = $4, icon = $5, "order" = 7,
              level = 2, is_active = true, description = $6, updated_at = NOW()
          WHERE id = $1
          `,
          {
            bind: [
              menuId,
              parent.id,
              '급여발송',
              'Payslip Send',
              'email',
              '확정된 급여 목록에서 직원별 급여 명세서 PDF를 이메일로 발송합니다.'
            ]
          }
        );
      } else {
        const [inserted] = await sequelize.query(
          `
          INSERT INTO menus (
            tenant_id, parent_id, name_ko, name_en, route, icon, "order", level,
            is_active, description, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, '/hr/payslip-send', $5, 7, 2, true, $6, NOW(), NOW()
          )
          RETURNING id
          `,
          {
            bind: [
              parent.tenant_id,
              parent.id,
              '급여발송',
              'Payslip Send',
              'email',
              '확정된 급여 목록에서 직원별 급여 명세서 PDF를 이메일로 발송합니다.'
            ]
          }
        );
        menuId = inserted[0].id;
      }

      await sequelize.query(
        `
        INSERT INTO user_permissions (
          user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at
        )
        SELECT u.id, $1, true, true, true, false, NOW(), NOW()
        FROM users u
        WHERE u.tenant_id = $2
          AND u.role IN ('admin', 'root')
          AND COALESCE(u.status, 'active') <> 'inactive'
          AND NOT EXISTS (
            SELECT 1 FROM user_permissions p WHERE p.user_id = u.id AND p.menu_id = $1
          )
        `,
        { bind: [menuId, parent.tenant_id] }
      );
    }
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    await sequelize.query(`
      DELETE FROM user_permissions
      WHERE menu_id IN (SELECT id FROM menus WHERE route = '/hr/payslip-send')
    `);
    await sequelize.query(`
      DELETE FROM menus WHERE route = '/hr/payslip-send'
    `);
  }
};
