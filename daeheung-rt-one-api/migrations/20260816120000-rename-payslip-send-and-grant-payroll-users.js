'use strict';

/**
 * 급여 명세서 발송 메뉴 표시명 → 「급여발송」
 * 급여 관리(can_view) 권한이 있는 사용자에게 동일 권한 부여
 * (메뉴 권한 저장 시 누락된 admin/user 복구 포함)
 */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    await sequelize.query(`
      UPDATE menus
      SET name_ko = '급여발송',
          name_en = 'Payslip Send',
          description = '확정된 급여 목록에서 직원별 급여 명세서 PDF를 이메일로 발송합니다.',
          updated_at = NOW()
      WHERE route = '/hr/payslip-send'
    `);

    await sequelize.query(`
      INSERT INTO user_permissions (
        user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at
      )
      SELECT
        p.user_id,
        ps.id,
        true,
        COALESCE(p.can_create, true),
        COALESCE(p.can_edit, true),
        false,
        NOW(),
        NOW()
      FROM user_permissions p
      JOIN menus payroll ON payroll.id = p.menu_id AND payroll.route = '/hr/payroll'
      JOIN menus ps ON ps.route = '/hr/payslip-send' AND ps.tenant_id = payroll.tenant_id
      WHERE p.can_view = true
        AND NOT EXISTS (
          SELECT 1 FROM user_permissions x
          WHERE x.user_id = p.user_id AND x.menu_id = ps.id
        )
    `);

    await sequelize.query(`
      UPDATE user_permissions up
      SET can_view = true,
          can_create = (up.can_create OR COALESCE(p.can_create, true)),
          can_edit = (up.can_edit OR COALESCE(p.can_edit, true)),
          updated_at = NOW()
      FROM user_permissions p
      JOIN menus payroll ON payroll.id = p.menu_id AND payroll.route = '/hr/payroll'
      JOIN menus ps ON ps.route = '/hr/payslip-send' AND ps.tenant_id = payroll.tenant_id
      WHERE up.user_id = p.user_id
        AND up.menu_id = ps.id
        AND p.can_view = true
        AND up.can_view IS DISTINCT FROM true
    `);

    await sequelize.query(`
      INSERT INTO user_permissions (
        user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at
      )
      SELECT u.id, m.id, true, true, true, false, NOW(), NOW()
      FROM users u
      JOIN menus m ON m.route = '/hr/payslip-send' AND m.tenant_id = u.tenant_id
      WHERE u.role IN ('admin', 'root')
        AND COALESCE(u.status, 'active') <> 'inactive'
        AND NOT EXISTS (
          SELECT 1 FROM user_permissions p WHERE p.user_id = u.id AND p.menu_id = m.id
        )
    `);
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    await sequelize.query(`
      UPDATE menus
      SET name_ko = '급여 명세서 발송 시스템',
          name_en = 'Payslip Delivery',
          updated_at = NOW()
      WHERE route = '/hr/payslip-send'
    `);
  }
};
