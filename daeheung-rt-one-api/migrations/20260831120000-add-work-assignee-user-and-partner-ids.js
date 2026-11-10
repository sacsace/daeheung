'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const descAssignees = await queryInterface.describeTable('work_assignees');
    if (!descAssignees.user_id) {
      await queryInterface.addColumn('work_assignees', 'user_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
      await queryInterface.addIndex('work_assignees', ['tenant_id', 'company_id', 'user_id'], {
        name: 'work_assignees_tenant_company_user_idx',
      });
    }

    const descItems = await queryInterface.describeTable('work_assignee_items');
    if (!descItems.partner_id) {
      await queryInterface.addColumn('work_assignee_items', 'partner_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
      await queryInterface.addIndex('work_assignee_items', ['partner_id'], {
        name: 'work_assignee_items_partner_id_idx',
      });
    }

    // 담당자 ↔ 사용자: 동일 회사 email / username 매칭
    await queryInterface.sequelize.query(`
      UPDATE work_assignees wa
      SET user_id = u.id
      FROM users u
      WHERE wa.user_id IS NULL
        AND wa.is_active = true
        AND u.tenant_id = wa.tenant_id
        AND u.company_id = wa.company_id
        AND (
          (
            wa.email IS NOT NULL
            AND TRIM(wa.email) <> ''
            AND LOWER(TRIM(wa.email)) = LOWER(TRIM(u.email))
          )
          OR (
            (wa.email IS NULL OR TRIM(wa.email) = '')
            AND LOWER(TRIM(wa.name)) = LOWER(TRIM(COALESCE(u.username, u.userid, '')))
          )
        )
    `);

    // 고객사 ↔ 파트너: 회사 내 이름(대소문자/공백 무시) 매칭
    await queryInterface.sequelize.query(`
      UPDATE work_assignee_items AS wai
      SET partner_id = p.id
      FROM work_assignees AS wa, partners AS p
      WHERE wai.assignee_id = wa.id
        AND p.tenant_id = wa.tenant_id
        AND p.company_id = wa.company_id
        AND LOWER(TRIM(p.company_name)) = LOWER(TRIM(wai.name))
        AND wai.partner_id IS NULL
        AND wai.is_active = true
        AND wa.is_active = true
    `);
  },

  async down(queryInterface) {
    const descItems = await queryInterface.describeTable('work_assignee_items');
    if (descItems.partner_id) {
      await queryInterface.removeIndex('work_assignee_items', 'work_assignee_items_partner_id_idx').catch(() => {});
      await queryInterface.removeColumn('work_assignee_items', 'partner_id');
    }
    const descAssignees = await queryInterface.describeTable('work_assignees');
    if (descAssignees.user_id) {
      await queryInterface
        .removeIndex('work_assignees', 'work_assignees_tenant_company_user_idx')
        .catch(() => {});
      await queryInterface.removeColumn('work_assignees', 'user_id');
    }
  },
};
