'use strict';

/** 공지 조회수 — 사용자당 1회만 카운트하기 위한 이력 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [rows] = await queryInterface.sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'notice_views'
      ) AS exists;
    `);
    if (rows[0]?.exists) {
      console.log('notice_views 테이블 이미 존재 — 건너뜀');
      return;
    }

    await queryInterface.createTable('notice_views', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      notice_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'notices', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('notice_views', ['notice_id', 'user_id'], {
      unique: true,
      name: 'notice_views_notice_user_unique',
    });
    await queryInterface.addIndex('notice_views', ['tenant_id', 'company_id'], {
      name: 'notice_views_tenant_company_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notice_views');
  },
};
