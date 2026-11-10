'use strict';

/** products: 제품 이미지 URL, 공급업체, 보관 위치 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier VARCHAR(200);
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS location VARCHAR(200);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE products DROP COLUMN IF EXISTS image_url;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE products DROP COLUMN IF EXISTS supplier;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE products DROP COLUMN IF EXISTS location;
    `);
  }
};
