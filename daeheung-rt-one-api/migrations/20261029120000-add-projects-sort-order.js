'use strict';

/**
 * 프로젝트 목록 수동 정렬용 sort_order 컬럼.
 * 기존 행은 회사별로 이전 목록 순서(start_date DESC, id DESC)로 백필한다.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('projects');
    if (!table.sort_order) {
      await queryInterface.addColumn('projects', 'sort_order', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
      await queryInterface.sequelize.query(`
        WITH ranked AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY company_id
              ORDER BY start_date DESC NULLS LAST, id DESC
            ) - 1 AS rn
          FROM projects
          WHERE is_active = true
        )
        UPDATE projects AS p
        SET sort_order = ranked.rn
        FROM ranked
        WHERE p.id = ranked.id
      `);
    }

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS projects_company_sort_order_idx
      ON projects (company_id, sort_order);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS projects_company_sort_order_idx;
    `);
    const table = await queryInterface.describeTable('projects');
    if (table.sort_order) {
      await queryInterface.removeColumn('projects', 'sort_order');
    }
  },
};
