'use strict';

/**
 * 회사 타임존 기본값을 인도(Asia/Kolkata, IST)로 통일.
 * 콜카타·첸나이 등 인도 전역은 동일 IANA 타임존을 사용한다.
 */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    await sequelize.query(`
      UPDATE companies
      SET timezone = 'Asia/Kolkata', updated_at = NOW()
      WHERE timezone IN ('Asia/Seoul', 'Asia/Calcutta', 'Asia/Chennai')
         OR timezone IS NULL
         OR TRIM(timezone) = ''
    `);

    await sequelize.query(`
      ALTER TABLE companies
      ALTER COLUMN timezone SET DEFAULT 'Asia/Kolkata'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE companies
      ALTER COLUMN timezone SET DEFAULT 'Asia/Seoul'
    `);
  },
};
