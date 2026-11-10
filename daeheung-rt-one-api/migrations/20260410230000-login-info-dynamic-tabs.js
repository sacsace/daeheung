'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const qi = queryInterface;
    const sequelize = qi.sequelize;

    const tables = await qi.showAllTables();
    const hasTabsTable = tables.includes('login_info_tabs');

    if (!hasTabsTable) {
      await qi.createTable('login_info_tabs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'companies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });
    }

    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS login_info_tabs_company_id_idx ON login_info_tabs (company_id)`
    );
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS login_info_tabs_tenant_id_idx ON login_info_tabs (tenant_id)`
    );

    const liBefore = await qi.describeTable('login_infos');
    if (!liBefore.tab_id) {
      await qi.addColumn('login_infos', 'tab_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'login_info_tabs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
    }

    const [companies] = await sequelize.query(`SELECT id, tenant_id FROM companies ORDER BY id ASC`);
    const rows = [];
    const now = new Date();
    for (const c of companies) {
      const cid = c.id;
      const tid = c.tenant_id;
      rows.push({
        tenant_id: tid,
        company_id: cid,
        name: '외부 사이트',
        sort_order: 0,
        created_at: now,
        updated_at: now
      });
      rows.push({
        tenant_id: tid,
        company_id: cid,
        name: 'MCA 로그인 정보',
        sort_order: 1,
        created_at: now,
        updated_at: now
      });
    }
    const [countRows] = await sequelize.query(
      `SELECT COUNT(*)::int AS cnt FROM login_info_tabs`
    );
    const cnt = Number(countRows[0]?.cnt ?? 0);
    if (rows.length && cnt === 0) {
      await qi.bulkInsert('login_info_tabs', rows);
    }

    const li = await qi.describeTable('login_infos');
    const hasScope = !!li.scope;

    if (hasScope) {
      await sequelize.query(`
        UPDATE login_infos li
        SET tab_id = lit.id
        FROM login_info_tabs lit
        WHERE li.company_id = lit.company_id
          AND lit.sort_order = 1
          AND li.scope = 'mca'
      `);
      await sequelize.query(`
        UPDATE login_infos li
        SET tab_id = lit.id
        FROM login_info_tabs lit
        WHERE li.company_id = lit.company_id
          AND lit.sort_order = 0
          AND (li.scope IS NULL OR li.scope IS DISTINCT FROM 'mca')
      `);
    } else {
      await sequelize.query(`
        UPDATE login_infos li
        SET tab_id = lit.id
        FROM login_info_tabs lit
        WHERE li.company_id = lit.company_id AND lit.sort_order = 0
      `);
    }

    await sequelize.query(`
      UPDATE login_infos li
      SET tab_id = lit.id
      FROM login_info_tabs lit
      WHERE li.tab_id IS NULL AND li.company_id = lit.company_id AND lit.sort_order = 0
    `);

    try {
      await sequelize.query(`ALTER TABLE login_infos ALTER COLUMN tab_id SET NOT NULL`);
    } catch {
      // 이미 NOT NULL이거나 적용 불가
    }

    try {
      await qi.removeIndex('login_infos', 'login_infos_company_id_scope_idx');
    } catch {
      // ignore
    }
    if (hasScope) {
      try {
        await qi.removeColumn('login_infos', 'scope');
      } catch {
        // 이미 제거됨
      }
    }

    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS login_infos_tab_id_idx ON login_infos (tab_id)`
    );
  },

  async down() {
    // 복구 시 수동 마이그레이션 권장 (tab_id ↔ scope)
  }
};
