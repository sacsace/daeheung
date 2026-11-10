'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const users = await queryInterface.describeTable('users').catch(() => null);
    if (users && !users.session_version) {
      await queryInterface.addColumn('users', 'session_version', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }

    // PK(id)로 session_version 조회가 주 경로이지만, 활성 사용자 필터·감사 조회를 위한 보조 인덱스
    const addIndexSafe = async (table, fields, options) => {
      try {
        await queryInterface.addIndex(table, fields, options);
      } catch (error) {
        const msg = String(error?.message || error || '').toLowerCase();
        if (msg.includes('already exists') || msg.includes('duplicate')) return;
        throw error;
      }
    };

    if (users) {
      await addIndexSafe('users', ['status', 'userid'], {
        name: 'users_status_userid_idx',
      });
    }

    const loginLogs = await queryInterface.describeTable('login_logs').catch(() => null);
    if (loginLogs) {
      await addIndexSafe('login_logs', ['user_id', 'logged_at'], {
        name: 'login_logs_user_id_logged_at_idx',
      });
      await addIndexSafe('login_logs', ['tenant_id', 'company_id', 'logged_at'], {
        name: 'login_logs_tenant_company_logged_at_idx',
      });
      await addIndexSafe('login_logs', ['userid', 'logged_at'], {
        name: 'login_logs_userid_logged_at_idx',
      });
    }
  },

  async down(queryInterface) {
    const removeIndexSafe = async (table, name) => {
      try {
        await queryInterface.removeIndex(table, name);
      } catch (_) {
        /* ignore */
      }
    };

    await removeIndexSafe('login_logs', 'login_logs_userid_logged_at_idx');
    await removeIndexSafe('login_logs', 'login_logs_tenant_company_logged_at_idx');
    await removeIndexSafe('login_logs', 'login_logs_user_id_logged_at_idx');
    await removeIndexSafe('users', 'users_status_userid_idx');

    const users = await queryInterface.describeTable('users').catch(() => null);
    if (users?.session_version) {
      await queryInterface.removeColumn('users', 'session_version');
    }
  },
};
