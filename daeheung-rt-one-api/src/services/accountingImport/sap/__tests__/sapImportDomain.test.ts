import { groupSapDocuments, validateVoucherBalance } from '../documents';
import { normalizeSapRow } from '../normalizers';
import { parseSapWorkbook } from '../parsers';
import { validateSapDocuments } from '../validators';
import { SapImportTemplateConfig } from '../types';

const template: SapImportTemplateConfig = {
  columnMapping: {
    companyCode: 'Company Code',
    fiscalYear: 'Fiscal Year',
    documentNumber: 'Document Number',
    postingDate: 'Posting Date',
    glAccountCode: 'G/L Account',
    amount: 'Amount',
    debitCreditIndicator: 'D/C',
  },
  documentGroupKeys: ['companyCode', 'fiscalYear', 'documentNumber'],
  amountMode: 'amount_indicator',
  debitCreditConfig: { debitIndicators: ['S'], creditIndicators: ['H'] },
};

describe('SAP import domain', () => {
  it('normalizes configurable S/H indicators without Number arithmetic', () => {
    const debit = normalizeSapRow(
      {
        rowNumber: 2,
        values: {
          'Company Code': '1000 ',
          'Fiscal Year': '2026',
          'Document Number': ' 900001 ',
          'G/L Account': '640210',
          Amount: '100,000.10',
          'D/C': 'S',
        },
      },
      template
    );
    const credit = normalizeSapRow(
      {
        rowNumber: 3,
        values: {
          'Company Code': '1000',
          'Fiscal Year': '2026',
          'Document Number': '900001',
          'G/L Account': '210000',
          Amount: '100000.10',
          'D/C': 'H',
        },
      },
      template
    );

    expect(debit.debit).toBe('100000.10');
    expect(debit.credit).toBe('0');
    expect(credit.debit).toBe('0');
    expect(credit.credit).toBe('100000.10');
  });

  it('groups the standard SAP document key and validates the decimal balance', () => {
    const debit = normalizeSapRow(
      {
        rowNumber: 2,
        values: {
          'Company Code': '1000',
          'Fiscal Year': '2026',
          'Document Number': '900001',
          'G/L Account': '640210',
          Amount: '0.10',
          'D/C': 'S',
        },
      },
      template
    );
    const credit = normalizeSapRow(
      {
        rowNumber: 3,
        values: {
          'Company Code': '1000',
          'Fiscal Year': '2026',
          'Document Number': '900001',
          'G/L Account': '210000',
          Amount: '0.10',
          'D/C': 'H',
        },
      },
      template
    );
    const { documents, issues } = groupSapDocuments([debit, credit], template.documentGroupKeys);

    expect(issues).toHaveLength(0);
    expect(documents).toHaveLength(1);
    expect(documents[0].documentKey).toBe('1000|2026|900001');
    expect(validateVoucherBalance(documents[0])).toHaveLength(0);
  });

  it('reports invalid indicator and missing GL as structured blocking issues', () => {
    const row = normalizeSapRow(
      {
        rowNumber: 2,
        values: {
          'Company Code': '1000',
          'Fiscal Year': '2026',
          'Document Number': '900002',
          Amount: '10',
          'D/C': 'X',
        },
      },
      template
    );
    const { documents } = groupSapDocuments([row], template.documentGroupKeys);
    const issues = validateSapDocuments(documents, template);

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SAP_DEBIT_CREDIT_INDICATOR_INVALID', severity: 'ERROR' }),
      expect.objectContaining({ code: 'SAP_GL_ACCOUNT_MISSING', severity: 'ERROR' }),
    ]));
  });

  it('reads CSV headers and skips blank rows', () => {
    const csv = Buffer.from('Company Code,Fiscal Year,Document Number\n1000,2026,900001\n,,\n', 'utf8');
    const parsed = parseSapWorkbook(csv);

    expect(parsed.headers).toEqual(['Company Code', 'Fiscal Year', 'Document Number']);
    expect([...parsed.rows]).toEqual([
      {
        rowNumber: 2,
        values: {
          'Company Code': '1000',
          'Fiscal Year': '2026',
          'Document Number': '900001',
        },
      },
    ]);
  });
});
