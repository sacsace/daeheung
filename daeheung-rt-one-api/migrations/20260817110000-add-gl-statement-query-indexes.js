'use strict';

/**
 * 재무제표/손익계산서의 Tally 전표 기간 집계와
 * 시산표의 게시 전표 기간 집계를 위한 복합 인덱스.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex(
      'gl_vouchers',
      ['tenant_id', 'company_id', 'input_mode', 'status', 'voucher_date'],
      { name: 'gl_vouchers_statement_scope_idx' }
    );
    await queryInterface.addIndex(
      'gl_vouchers',
      ['tenant_id', 'company_id', 'status', 'voucher_date'],
      { name: 'gl_vouchers_trial_scope_idx' }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('gl_vouchers', 'gl_vouchers_statement_scope_idx');
    await queryInterface.removeIndex('gl_vouchers', 'gl_vouchers_trial_scope_idx');
  },
};
