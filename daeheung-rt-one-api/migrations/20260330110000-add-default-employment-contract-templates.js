'use strict';

const DEFAULT_TEMPLATES = [
  {
    name: '고용 계약서',
    contract_type: 'regular',
    content_html: `
<!-- system_default_template_v1 -->
<h2>Employment Contract</h2>
<p>This agreement is made between the Company and the Employee to define the terms and conditions of employment.</p>
<ul>
  <li>Start Date: {{start_date}}</li>
  <li>End Date: {{end_date}}</li>
  <li>Work Location: {{work_location}}</li>
  <li>Working Hours: {{working_hours}}</li>
  <li>Annual Salary: {{salary}}</li>
</ul>
<p>Both parties agree to perform this contract in good faith and in accordance with applicable laws and company policy.</p>
`
  },
  {
    name: '수습 고용 계약서',
    contract_type: 'probation',
    content_html: `
<!-- system_default_template_v1 -->
<h2>Probationary Employment Contract</h2>
<p>This agreement defines the terms and conditions applicable during the probation period.</p>
<ul>
  <li>Probation Period (Months): {{probation_months}}</li>
  <li>Start Date: {{start_date}}</li>
  <li>End Date: {{end_date}}</li>
  <li>Work Location: {{work_location}}</li>
  <li>Annual Salary: {{salary}}</li>
</ul>
<p>Confirmation of permanent employment is subject to satisfactory performance during probation.</p>
`
  },
  {
    name: '연봉 조정 계약서',
    contract_type: 'salary_adjustment',
    content_html: `
<!-- system_default_template_v1 -->
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
`
  }
];

module.exports = {
  up: async (queryInterface) => {
    const [companies] = await queryInterface.sequelize.query(`
      SELECT id, tenant_id
      FROM companies
    `);

    for (const company of companies) {
      for (const template of DEFAULT_TEMPLATES) {
        const [exists] = await queryInterface.sequelize.query(
          `
          SELECT id
          FROM employment_contract_templates
          WHERE tenant_id = $1
            AND company_id = $2
            AND name = $3
          LIMIT 1
          `,
          { bind: [company.tenant_id, company.id, template.name] }
        );

        if (exists.length > 0) continue;

        await queryInterface.sequelize.query(
          `
          INSERT INTO employment_contract_templates (
            tenant_id, company_id, name, contract_type, language, version, content_html, is_active, created_by, updated_by, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, 'en', 1, $5, true, NULL, NULL, NOW(), NOW()
          )
          `,
          {
            bind: [
              company.tenant_id,
              company.id,
              template.name,
              template.contract_type,
              template.content_html.trim()
            ]
          }
        );
      }
    }
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `
      DELETE FROM employment_contract_templates
      WHERE content_html LIKE '%system_default_template_v1%'
        AND name IN ('고용 계약서', '수습 고용 계약서', '연봉 조정 계약서')
      `
    );
  }
};

