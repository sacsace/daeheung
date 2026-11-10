'use strict';

/**
 * Aadhaar eSign ASP 세션 테이블
 * - mock/live ASP 연동용 거래 상태 추적
 * - 완료 시에만 employment_contract_signatures 생성
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const normalized = tables.map((t) => String(t).toLowerCase());
    if (normalized.includes('employment_contract_esign_sessions')) return;

    await queryInterface.createTable('employment_contract_esign_sessions', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      contract_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'employment_contracts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      signer_type: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      signer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      provider: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'mock',
      },
      mode: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'mock',
      },
      session_token: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      asp_txn_id: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'initiated',
      },
      document_hash: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      aadhaar_last4: {
        type: Sequelize.STRING(4),
        allowNull: true,
      },
      consent_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      redirect_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      return_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      callback_payload: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      error_code: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      error_message: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
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

    await queryInterface.addIndex('employment_contract_esign_sessions', ['contract_id', 'status'], {
      name: 'emp_contract_esign_sessions_contract_status_idx',
    });
    await queryInterface.addIndex('employment_contract_esign_sessions', ['asp_txn_id'], {
      name: 'emp_contract_esign_sessions_asp_txn_idx',
    });
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const normalized = tables.map((t) => String(t).toLowerCase());
    if (!normalized.includes('employment_contract_esign_sessions')) return;
    try {
      await queryInterface.removeIndex(
        'employment_contract_esign_sessions',
        'emp_contract_esign_sessions_contract_status_idx'
      );
    } catch (_) {
      /* ignore */
    }
    try {
      await queryInterface.removeIndex(
        'employment_contract_esign_sessions',
        'emp_contract_esign_sessions_asp_txn_idx'
      );
    } catch (_) {
      /* ignore */
    }
    await queryInterface.dropTable('employment_contract_esign_sessions');
  },
};
