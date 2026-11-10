'use strict';

const UPDATED_SALARY_TEMPLATE_HTML = `
<!-- system_default_template_v2 -->
<h2 style="text-align:center;">Subject: Confirmation of Salary Structure</h2>
<p style="text-align:right;"><strong>Date:</strong> {{issue_date}}</p>
<p><strong>To,</strong></p>
<p>{{employee_name}}<br/>{{employee_address}}</p>
<p>Dear <strong>{{employee_name}}</strong>,</p>
<p>We are pleased to confirm that your compensation has been mutually agreed and finalized as per the discussions held between you and the management.</p>
<p>Your revised salary structure shall be as follows:</p>
<ul>
  <li><strong>Effective Date:</strong> {{start_date}}</li>
  <li><strong>Annual CTC (Cost to Company):</strong> {{annual_ctc}}</li>
  <li><strong>Monthly Gross Salary:</strong> {{monthly_gross_salary}}</li>
  <li><strong>Net Pay:</strong> {{net_pay}}</li>
</ul>
<p>A detailed salary breakup (including Basic, HRA, Allowances, and applicable deductions such as PF, ESI, Professional Tax, and Income Tax) will be provided separately.</p>
<h3>Terms & Conditions</h3>
<ol>
  <li>The above compensation is inclusive of all statutory components and subject to applicable labor and tax regulations.</li>
  <li>Income tax and other statutory deductions shall be applied as per prevailing law.</li>
  <li>This salary structure is confidential and should not be disclosed to any third party.</li>
  <li>The company reserves the right to revise the compensation structure in line with policy and statutory requirements.</li>
  <li>All other terms and conditions of your employment remain unchanged unless explicitly amended in writing.</li>
</ol>
<p>Please sign and return a copy of this letter as a token of your acceptance.</p>
<p>We look forward to your continued contribution to the organization.</p>
<table style="width:100%; margin-top:24px;">
  <tr>
    <td style="width:50%; vertical-align:top;">
      <strong>For {{company_name}}</strong><br/><br/>
      Signature: _______________________<br/>
      Name: {{company_signer_name}}<br/>
      Designation: {{company_signer_title}}
    </td>
    <td style="width:50%; vertical-align:top;">
      <strong>Accepted & Agreed</strong><br/><br/>
      Signature: _______________________<br/>
      Name: {{employee_name}}
    </td>
  </tr>
</table>
`;

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `
      UPDATE employment_contract_templates
      SET
        content_html = $1,
        updated_at = NOW()
      WHERE name = '연봉 조정 계약서'
        AND language = 'ko'
      `,
      { bind: [UPDATED_SALARY_TEMPLATE_HTML.trim()] }
    );
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `
      UPDATE employment_contract_templates
      SET
        content_html = '<!-- system_default_template_v1 --><h2>연봉 조정 계약서</h2><p>본 계약은 기존 고용 계약의 연봉 조정 내용을 반영하기 위해 작성됩니다.</p><ul><li>적용 시작일: {{start_date}}</li><li>적용 종료일: {{end_date}}</li><li>조정 연봉: {{salary}}</li><li>비고: {{note}}</li></ul><p>본 조정 사항은 회사와 근로자의 합의에 따라 효력을 가집니다.</p>',
        updated_at = NOW()
      WHERE name = '연봉 조정 계약서'
        AND language = 'ko'
        AND content_html LIKE '%system_default_template_v2%'
      `
    );
  }
};

