'use strict';

/** WebAuthn(Passkey/지문) 자격 증명 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));
    if (names.includes('webauthn_credentials')) return;

    await queryInterface.createTable('webauthn_credentials', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.INTEGER, allowNull: false },
      tenant_id: { type: Sequelize.INTEGER, allowNull: false },
      company_id: { type: Sequelize.INTEGER, allowNull: false },
      credential_id: { type: Sequelize.STRING(512), allowNull: false },
      public_key: { type: Sequelize.TEXT, allowNull: false },
      counter: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      transports: { type: Sequelize.JSONB, allowNull: true },
      device_name: { type: Sequelize.STRING(120), allowNull: true },
      backed_up: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      last_used_at: { type: Sequelize.DATE, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('webauthn_credentials', ['credential_id'], {
      name: 'webauthn_credentials_credential_id_uq',
      unique: true,
    });
    await queryInterface.addIndex('webauthn_credentials', ['user_id', 'is_active'], {
      name: 'webauthn_credentials_user_active_idx',
    });
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name));
    if (names.includes('webauthn_credentials')) {
      await queryInterface.dropTable('webauthn_credentials');
    }
  },
};
