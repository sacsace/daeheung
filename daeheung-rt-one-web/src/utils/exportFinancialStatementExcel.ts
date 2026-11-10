import ExcelJS from 'exceljs';
import { getGlAccountLabel } from './glAccountLabel';
import { addSheetFromAoA, downloadExcelWorkbook } from './excelExportStyle';

type AccountRow = {
  accountId: number;
  code: string;
  name: string;
  nameEn?: string | null;
  amount: number;
  synthetic?: boolean;
};

const dateToken = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

const accountLabel = (row: AccountRow, language: string) =>
  row.synthetic ? row.name : getGlAccountLabel(row, language);

const sectionAoA = (
  rows: AccountRow[],
  totalLabel: string,
  total: number,
  language: string,
  sectionLabel: string
): Array<Array<string | number>> => {
  const header = ['구분', '코드', '계정과목', '금액'];
  const body = (rows.length ? rows : [{ accountId: 0, code: '-', name: '-', amount: 0 } as AccountRow]).map(
    (row) => [sectionLabel, row.code || '-', accountLabel(row, language), Number(row.amount || 0)]
  );
  body.push([sectionLabel, '', totalLabel, Number(total || 0)]);
  return [header, ...body];
};

const metaAoA = (pairs: Array<{ 항목: string; 값: string | number }>) => [
  ['항목', '값'],
  ...pairs.map((p) => [p.항목, p.값]),
];

export const exportProfitAndLossExcel = async ({
  data,
  companyName,
  language,
  filePrefix = '손익계산서',
}: {
  data: {
    from: string | null;
    to: string | null;
    incomeRows: AccountRow[];
    expenseRows: AccountRow[];
    totalIncome: number;
    totalExpense: number;
    netProfit: number;
  };
  companyName?: string;
  language: string;
  filePrefix?: string;
}) => {
  const workbook = new ExcelJS.Workbook();
  addSheetFromAoA(
    workbook,
    '요약',
    metaAoA([
      { 항목: '보고서', 값: '손익계산서 (Profit & Loss)' },
      { 항목: '생성일시', 값: new Date().toLocaleString(language?.startsWith('en') ? 'en-US' : 'ko-KR') },
      { 항목: '회사', 값: companyName || '-' },
      { 항목: '시작일', 값: data.from || '-' },
      { 항목: '종료일', 값: data.to || '-' },
      { 항목: '총 수익', 값: data.totalIncome },
      { 항목: '총 비용', 값: data.totalExpense },
      { 항목: '당기순이익', 값: data.netProfit },
    ])
  );
  addSheetFromAoA(
    workbook,
    '수익',
    sectionAoA(data.incomeRows, '수익 합계', data.totalIncome, language, '수익')
  );
  addSheetFromAoA(
    workbook,
    '비용',
    sectionAoA(data.expenseRows, '비용 합계', data.totalExpense, language, '비용')
  );
  await downloadExcelWorkbook(workbook, `${filePrefix}_${dateToken()}.xlsx`);
};

export const exportBalanceSheetExcel = async ({
  data,
  companyName,
  language,
  filePrefix = '재무상태표',
}: {
  data: {
    asOf: string | null;
    from: string | null;
    assetRows: AccountRow[];
    liabilityRows: AccountRow[];
    equityRows: AccountRow[];
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    totalLiabilitiesAndEquity: number;
    netProfit: number;
    balanced: boolean;
  };
  companyName?: string;
  language: string;
  filePrefix?: string;
}) => {
  const workbook = new ExcelJS.Workbook();
  addSheetFromAoA(
    workbook,
    '요약',
    metaAoA([
      { 항목: '보고서', 값: '재무상태표 (Balance Sheet)' },
      { 항목: '생성일시', 값: new Date().toLocaleString(language?.startsWith('en') ? 'en-US' : 'ko-KR') },
      { 항목: '회사', 값: companyName || '-' },
      { 항목: '시작일', 값: data.from || '-' },
      { 항목: '기준일', 값: data.asOf || '-' },
      { 항목: '총 자산', 값: data.totalAssets },
      { 항목: '총 부채', 값: data.totalLiabilities },
      { 항목: '총 자본', 값: data.totalEquity },
      { 항목: '부채+자본', 값: data.totalLiabilitiesAndEquity },
      { 항목: '당기손익(자본반영)', 값: data.netProfit },
      { 항목: '대차일치', 값: data.balanced ? 'Y' : 'N' },
    ])
  );
  addSheetFromAoA(
    workbook,
    '자산',
    sectionAoA(data.assetRows, '자산 합계', data.totalAssets, language, '자산')
  );
  addSheetFromAoA(
    workbook,
    '부채',
    sectionAoA(data.liabilityRows, '부채 합계', data.totalLiabilities, language, '부채')
  );
  addSheetFromAoA(
    workbook,
    '자본',
    sectionAoA(data.equityRows, '자본 합계', data.totalEquity, language, '자본')
  );
  await downloadExcelWorkbook(workbook, `${filePrefix}_${dateToken()}.xlsx`);
};
