'use strict';

/**
 * project_code 유니크를 전역 → (tenant_id, company_id, project_code) 로 변경.
 * 회사별 PROJ-000001 채번과 스키마를 맞춘다.
 */
module.exports = {
  async up(queryInterface) {
    const qi = queryInterface.sequelize;

    await qi.query(`
      ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_project_code_key;
    `);
    await qi.query(`
      DROP INDEX IF EXISTS projects_project_code_key;
    `);
    await qi.query(`
      DROP INDEX IF EXISTS projects_project_code_idx;
    `);

    await qi.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS projects_tenant_company_code_uk
      ON projects (tenant_id, company_id, project_code);
    `);

    await qi.query(`
      CREATE INDEX IF NOT EXISTS projects_project_code_idx
      ON projects (project_code);
    `);
  },

  async down(queryInterface) {
    const qi = queryInterface.sequelize;

    await qi.query(`
      DROP INDEX IF EXISTS projects_tenant_company_code_uk;
    `);
    await qi.query(`
      DROP INDEX IF EXISTS projects_project_code_idx;
    `);

    await qi.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS projects_project_code_key
      ON projects (project_code);
    `);
    await qi.query(`
      CREATE INDEX IF NOT EXISTS projects_project_code_idx
      ON projects (project_code);
    `);
  },
};
