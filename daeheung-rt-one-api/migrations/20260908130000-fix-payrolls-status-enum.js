'use strict';

/**
 * 운영 payrolls.status 는 레거시 ENUM('draft','approved','paid') 인데
 * 일괄 생성 코드는 'pending' 을 넣어 실패한다.
 * VARCHAR(20) 으로 바꿔 모델과 맞춘다.
 */

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));
    if (!names.includes('payrolls')) return;

    const [col] = await sequelize.query(
      `SELECT data_type, udt_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'payrolls' AND column_name = 'status'`,
      { type: sequelize.QueryTypes.SELECT }
    );

    if (!col) return;

    if (col.data_type === 'USER-DEFINED' || String(col.udt_name || '').includes('payrolls_status')) {
      await sequelize.query(`ALTER TABLE payrolls ALTER COLUMN status DROP DEFAULT`);
      await sequelize.query(`
        ALTER TABLE payrolls
          ALTER COLUMN status TYPE VARCHAR(20) USING status::text
      `);
      await sequelize.query(`
        ALTER TABLE payrolls
          ALTER COLUMN status SET DEFAULT 'draft',
          ALTER COLUMN status SET NOT NULL
      `);
      await sequelize.query(`DROP TYPE IF EXISTS enum_payrolls_status`).catch(() => {});
    }
  },

  async down() {
    // no-op
  },
};
