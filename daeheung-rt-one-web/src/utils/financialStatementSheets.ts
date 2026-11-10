/** SEDA 재무제표 엑셀 시트와 동일한 구조로 MVS 집계를 재구성 */

import { formatEnglishSentenceLabel } from './textCase';

export type AmountRow = {
  accountId: number;
  code: string;
  name: string;
  nameEn?: string | null;
  amount: number;
  nature?: string;
  debit?: number;
  credit?: number;
  opening?: number;
  synthetic?: boolean;
};

export type ComparativeLine = {
  /** 좌측 인덱스 (A, B, 1, 2, 3 등) — 엑셀 BS 첫 열 */
  index?: string;
  /** 동적 계정명 등 — labelKey 없을 때 표시 */
  label: string;
  /** i18n 키 (예: balanceSheet.lines.shareCapital) */
  labelKey?: string;
  current: number | null;
  previous: number | null;
  indent?: 0 | 1 | 2;
  section?: boolean;
  total?: boolean;
  /** SEDA 구분 헤더 (금액 없음, 아래 실제 계정 나열) */
  group?: boolean;
  note?: string;
  accountId?: number;
  code?: string;
  nameEn?: string | null;
  /** 대차 불일치 시 당기 금액 강조 */
  mismatchCurrent?: boolean;
  /** 대차 불일치 시 전기 금액 강조 */
  mismatchPrevious?: boolean;
};

export type BsBundle = {
  assetRows: AmountRow[];
  liabilityRows: AmountRow[];
  equityRows: AmountRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  netProfit: number;
};

export type PlBundle = {
  incomeRows: AmountRow[];
  expenseRows: AmountRow[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
};

export type TbRow = {
  accountId: number;
  code: string;
  name: string;
  nature?: string;
  nameEn?: string | null;
  debit: number;
  credit: number;
  balance: number;
  opening?: number;
};

const rx = (pattern: string | RegExp) =>
  typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;

export const matchName = (name: string, pattern: string | RegExp) => rx(pattern).test(name || '');

export const sumAmounts = (rows: AmountRow[]) =>
  rows.reduce((s, r) => s + Number(r.amount || 0), 0);

export const pick = (rows: AmountRow[], pattern: string | RegExp) =>
  rows.filter((r) => matchName(r.name, pattern));

export const exclude = (rows: AmountRow[], pattern: string | RegExp) =>
  rows.filter((r) => !matchName(r.name, pattern));

const AMT_EPS = 0.005;

type MergedAccount = { row: AmountRow; current: number; previous: number };

function mergeAmountRows(curr: AmountRow[], prev: AmountRow[]): MergedAccount[] {
  const byKey: Record<string, MergedAccount> = {};
  const keyOf = (r: AmountRow) =>
    r.accountId ? `id:${r.accountId}` : `name:${String(r.name || '').toLowerCase()}`;
  for (let i = 0; i < curr.length; i += 1) {
    const r = curr[i];
    byKey[keyOf(r)] = { row: r, current: Number(r.amount || 0), previous: 0 };
  }
  for (let i = 0; i < prev.length; i += 1) {
    const r = prev[i];
    const k = keyOf(r);
    if (byKey[k]) byKey[k].previous = Number(r.amount || 0);
    else byKey[k] = { row: r, current: 0, previous: Number(r.amount || 0) };
  }
  const keys = Object.keys(byKey);
  const out: MergedAccount[] = [];
  for (let i = 0; i < keys.length; i += 1) out.push(byKey[keys[i]]);
  out.sort(
    (a, b) =>
      Math.abs(b.current) - Math.abs(a.current) ||
      Math.abs(b.previous) - Math.abs(a.previous) ||
      String(a.row.name || '').localeCompare(String(b.row.name || ''))
  );
  return out;
}

function accountLines(curr: AmountRow[], prev: AmountRow[], indent: 0 | 1 | 2 = 1): ComparativeLine[] {
  const merged = mergeAmountRows(curr, prev);
  const out: ComparativeLine[] = [];
  for (let i = 0; i < merged.length; i += 1) {
    const x = merged[i];
    if (Math.abs(x.current) <= AMT_EPS && Math.abs(x.previous) <= AMT_EPS) continue;
    out.push(
      line(accountLineLabel(x.row.name), x.current, x.previous, {
        indent,
        accountId: x.row.accountId,
        code: x.row.code,
        nameEn: x.row.nameEn,
      })
    );
  }
  return out;
}

function groupBlock(header: ComparativeLine, curr: AmountRow[], prev: AmountRow[], indent: 0 | 1 | 2 = 1): ComparativeLine[] {
  const items = accountLines(curr, prev, indent);
  if (!items.length) return [];
  return [{ ...header, group: true, current: null, previous: null }, ...items];
}

/** 본표용 — 계정은 합산만 하고, 금액이 없으면 줄을 생략한다 */
function summedLine(
  header: ComparativeLine,
  curr: AmountRow[],
  prev: AmountRow[],
  extraC = 0,
  extraP = 0
): ComparativeLine[] {
  const c = Number((sumAmounts(curr) + extraC).toFixed(2));
  const p = Number((sumAmounts(prev) + extraP).toFixed(2));
  if (Math.abs(c) <= AMT_EPS && Math.abs(p) <= AMT_EPS) return [];
  return [{ ...header, current: c, previous: p }];
}

const accountLineLabel = (name: string) => formatEnglishSentenceLabel(name);

const PAT = {
  cash: /\b(bank|cash|petty cash|cash[- ]?in[- ]?hand)\b/i,
  receivable: /\b(receivable|sundry debtors|debtor)\b/i,
  advance: /\b(advance|loan|deposit)\b/i,
  fixed: /\b(fixed|vehicle|furniture|computer|equipment|machinery|building|tangible|depreciation)\b/i,
  inventory: /\b(inventory|stock|stock[- ]?in[- ]?hand)\b/i,
  investment: /\b(investment)\b/i,
  borrowing: /\b(loan|borrowing|overdraft|\bod\b)\b/i,
  payable: /\b(payable|sundry creditors|creditor|supplier)\b/i,
  provision: /\b(provision)\b/i,
  gstOutput: /\b(output\s*(cgst|sgst|igst|gst)|(cgst|sgst|igst)\s*output)\b/i,
  gstInput: /\b(input\s*(cgst|sgst|igst|gst)|(cgst|sgst|igst)\s*input)\b/i,
  tds: /\btds\b/i,
  capital: /\b(share capital|capital account|equity share)\b/i,
  reserve: /\b(reserve|surplus|premium|retained)\b/i,
  deferredTax: /\bdeferred\s*tax\b/i,
  shortBorrow: /\b(short[- ]?term|working capital|overdraft|\bod\b|emi)\b/i,
  taxExpense: /\b(income tax|current tax|deferred tax|provision for tax|tax expense)\b/i,
  sales: /\b(sales|revenue|service fee|professional service|room rent|food sales|card sales)\b/i,
  otherIncome: /\b(other income|written off|interest (received|income)|discount received|prior period income)\b/i,
  purchase: /\b(purchase|cost of|material)\b/i,
  employee: /\b(salary|wage|employee|payroll|pf |esi )\b/i,
  finance: /\b(bank charge|interest (paid|on)|finance cost)\b/i,
  depreciation: /\b(depreciation|amortisation|amortization)\b/i,
  otherExpense: /\b(expense|charges|repair|maintenance|travel|telephone|electric|professional|legal|consultancy|labour|food|accomodation|accommodation)\b/i,
};

const line = (
  label: string,
  current: number | null,
  previous: number | null,
  opts?: Partial<ComparativeLine>
): ComparativeLine => ({
  label,
  current,
  previous,
  indent: 1,
  ...opts,
});

/** BS 시트 — SEDA 본표: 구분 합계만. 개별 계정은 스케줄(주석)에 둔다 */
export function buildBsSheet(current: BsBundle | null, previous: BsBundle | null): ComparativeLine[] {
  const ca = current?.assetRows || [];
  const pa = previous?.assetRows || [];
  const cl = current?.liabilityRows || [];
  const pl = previous?.liabilityRows || [];
  const ce = (current?.equityRows || []).filter((r) => !r.synthetic);
  const pe = (previous?.equityRows || []).filter((r) => !r.synthetic);

  const shareCapitalC = pick(ce, PAT.capital);
  const shareCapitalP = pick(pe, PAT.capital);
  const reservesC = exclude(ce, PAT.capital);
  const reservesP = exclude(pe, PAT.capital);

  const deferredC = pick(cl, PAT.deferredTax);
  const deferredP = pick(pl, PAT.deferredTax);
  const allBorrowC = pick(cl, PAT.borrowing);
  const allBorrowP = pick(pl, PAT.borrowing);
  const shortBorrowC = allBorrowC.filter((r) => matchName(r.name, PAT.shortBorrow));
  const shortBorrowP = allBorrowP.filter((r) => matchName(r.name, PAT.shortBorrow));
  const longBorrowC = exclude(allBorrowC, PAT.shortBorrow);
  const longBorrowP = exclude(allBorrowP, PAT.shortBorrow);
  const payablesC = pick(cl, PAT.payable);
  const payablesP = pick(pl, PAT.payable);
  const provisionsC = pick(cl, PAT.provision);
  const provisionsP = pick(pl, PAT.provision);
  const otherLiabC = exclude(
    cl,
    new RegExp(
      `${PAT.borrowing.source}|${PAT.payable.source}|${PAT.provision.source}|${PAT.deferredTax.source}`,
      'i'
    )
  );
  const otherLiabP = exclude(
    pl,
    new RegExp(
      `${PAT.borrowing.source}|${PAT.payable.source}|${PAT.provision.source}|${PAT.deferredTax.source}`,
      'i'
    )
  );

  const fixedC = pick(ca, PAT.fixed);
  const fixedP = pick(pa, PAT.fixed);
  const investC = pick(ca, PAT.investment);
  const investP = pick(pa, PAT.investment);
  const invC = pick(ca, PAT.inventory);
  const invP = pick(pa, PAT.inventory);
  const recvC = pick(ca, PAT.receivable);
  const recvP = pick(pa, PAT.receivable);
  const cashC = pick(ca, PAT.cash);
  const cashP = pick(pa, PAT.cash);
  const advanceC = pick(ca, PAT.advance);
  const advanceP = pick(pa, PAT.advance);
  const otherAssetC = exclude(
    ca,
    new RegExp(
      `${PAT.fixed.source}|${PAT.investment.source}|${PAT.inventory.source}|${PAT.receivable.source}|${PAT.cash.source}|${PAT.advance.source}`,
      'i'
    )
  );
  const otherAssetP = exclude(
    pa,
    new RegExp(
      `${PAT.fixed.source}|${PAT.investment.source}|${PAT.inventory.source}|${PAT.receivable.source}|${PAT.cash.source}|${PAT.advance.source}`,
      'i'
    )
  );

  const profitC = current?.netProfit || 0;
  const profitP = previous?.netProfit || 0;
  const equityLiabTotalC =
    sumAmounts(ce) + profitC + sumAmounts(cl);
  const equityLiabTotalP =
    sumAmounts(pe) + profitP + sumAmounts(pl);
  const assetsTotalC = sumAmounts(ca);
  const assetsTotalP = sumAmounts(pa);

  const mismatchCurrent = Math.abs(equityLiabTotalC - assetsTotalC) > 0.05;
  const mismatchPrevious = Math.abs(equityLiabTotalP - assetsTotalP) > 0.05;

  const out: ComparativeLine[] = [
    line('EQUITY AND LIABILITIES', null, null, {
      section: true,
      indent: 0,
      index: 'A',
      labelKey: 'balanceSheet.lines.equityAndLiabilities',
    }),
  ];

  const capitalLine = summedLine(
    line('(a) Share capital', 0, 0, { note: '1', labelKey: 'balanceSheet.lines.shareCapital' }),
    shareCapitalC,
    shareCapitalP
  );
  const reserveLine = summedLine(
    line('(b) Reserves and surplus', 0, 0, { note: '2', labelKey: 'balanceSheet.lines.reservesAndSurplus' }),
    reservesC,
    reservesP,
    profitC,
    profitP
  );
  if (capitalLine.length || reserveLine.length) {
    out.push(
      line("Shareholders' funds", null, null, {
        indent: 0,
        index: '1',
        group: true,
        labelKey: 'balanceSheet.lines.shareholdersFunds',
      }),
      ...capitalLine,
      ...reserveLine
    );
  }

  const ncl = [
    ...summedLine(
      line('(a) Long-term borrowings', 0, 0, {
        note: '3',
        labelKey: 'balanceSheet.lines.longTermBorrowings',
      }),
      longBorrowC,
      longBorrowP
    ),
    ...summedLine(
      line('(b) Deferred tax liabilities (net)', 0, 0, {
        labelKey: 'balanceSheet.lines.deferredTaxLiabilities',
      }),
      deferredC,
      deferredP
    ),
  ];
  if (ncl.length) {
    out.push(
      line('Non-current liabilities', null, null, {
        indent: 0,
        index: '2',
        group: true,
        labelKey: 'balanceSheet.lines.nonCurrentLiabilities',
      }),
      ...ncl
    );
  }

  const clines = [
    ...summedLine(
      line('(a) Short Term Borrowings', 0, 0, {
        labelKey: 'balanceSheet.lines.shortTermBorrowings',
      }),
      shortBorrowC,
      shortBorrowP
    ),
    ...summedLine(
      line('(b) Trade payables', 0, 0, { labelKey: 'balanceSheet.lines.tradePayables' }),
      payablesC,
      payablesP
    ),
    ...summedLine(
      line('(c) Other current liabilities', 0, 0, {
        note: '4',
        labelKey: 'balanceSheet.lines.otherCurrentLiabilities',
      }),
      otherLiabC,
      otherLiabP
    ),
    ...summedLine(
      line('(d) Short-term provisions', 0, 0, {
        labelKey: 'balanceSheet.lines.shortTermProvisions',
      }),
      provisionsC,
      provisionsP
    ),
  ];
  if (clines.length) {
    out.push(
      line('Current liabilities', null, null, {
        indent: 0,
        index: '3',
        group: true,
        labelKey: 'balanceSheet.lines.currentLiabilities',
      }),
      ...clines
    );
  }

  out.push(
    line('Total', equityLiabTotalC, equityLiabTotalP, {
      total: true,
      indent: 0,
      mismatchCurrent,
      mismatchPrevious,
      labelKey: 'balanceSheet.lines.total',
    }),
    line('ASSETS', null, null, {
      section: true,
      indent: 0,
      index: 'B',
      labelKey: 'balanceSheet.lines.assets',
    })
  );

  const tangibleLine = summedLine(
    line('(i) Tangible assets', 0, 0, {
      indent: 2,
      note: '5',
      labelKey: 'balanceSheet.lines.tangibleAssets',
    }),
    fixedC,
    fixedP
  );
  const investLine = summedLine(
    line('(b) Non-current investments', 0, 0, {
      labelKey: 'balanceSheet.lines.nonCurrentInvestments',
    }),
    investC,
    investP
  );
  if (tangibleLine.length || investLine.length) {
    out.push(
      line('Non-current assets', null, null, {
        indent: 0,
        index: '1',
        group: true,
        labelKey: 'balanceSheet.lines.nonCurrentAssets',
      })
    );
    if (tangibleLine.length) {
      out.push(
        line('(a) Fixed assets', null, null, {
          indent: 1,
          group: true,
          labelKey: 'balanceSheet.lines.fixedAssets',
        }),
        ...tangibleLine
      );
    }
    out.push(...investLine);
  }

  const caLines = [
    ...summedLine(
      line('(a) Inventories', 0, 0, { labelKey: 'balanceSheet.lines.inventories' }),
      invC,
      invP
    ),
    ...summedLine(
      line('(b) Trade receivables', 0, 0, { labelKey: 'balanceSheet.lines.tradeReceivables' }),
      recvC,
      recvP
    ),
    ...summedLine(
      line('(c) Cash and cash equivalents', 0, 0, {
        note: '6',
        labelKey: 'balanceSheet.lines.cashAndCashEquivalents',
      }),
      cashC,
      cashP
    ),
    ...summedLine(
      line('(d) Short-term loans and advances', 0, 0, {
        labelKey: 'balanceSheet.lines.shortTermLoansAndAdvances',
      }),
      advanceC,
      advanceP
    ),
    ...summedLine(
      line('(e) Other Current Assets', 0, 0, {
        note: '7',
        labelKey: 'balanceSheet.lines.otherCurrentAssets',
      }),
      otherAssetC,
      otherAssetP
    ),
  ];
  if (caLines.length) {
    out.push(
      line('Current assets', null, null, {
        indent: 0,
        index: '2',
        group: true,
        labelKey: 'balanceSheet.lines.currentAssets',
      }),
      ...caLines
    );
  }

  out.push(
    line('Total', assetsTotalC, assetsTotalP, {
      total: true,
      indent: 0,
      mismatchCurrent,
      mismatchPrevious,
      labelKey: 'balanceSheet.lines.total',
    })
  );

  if (mismatchCurrent || mismatchPrevious) {
    out.push(
      line(
        'Difference (Assets − Equity & Liabilities)',
        Number((assetsTotalC - equityLiabTotalC).toFixed(2)),
        Number((assetsTotalP - equityLiabTotalP).toFixed(2)),
        {
          total: true,
          indent: 0,
          mismatchCurrent,
          mismatchPrevious,
          labelKey: 'balanceSheet.lines.difference',
        }
      )
    );
  }

  return out;
}

/** PL 시트 — SEDA 본표: 구분 합계만. 개별 계정은 P&L 스케줄에 둔다 */
export function buildPlSheet(current: PlBundle | null, previous: PlBundle | null): ComparativeLine[] {
  const ci = current?.incomeRows || [];
  const pi = previous?.incomeRows || [];
  const ce = current?.expenseRows || [];
  const pe = previous?.expenseRows || [];

  const revC = pick(ci, PAT.sales);
  const revP = pick(pi, PAT.sales);
  const othIncC = revC.length || revP.length ? exclude(ci, PAT.sales) : [];
  const othIncP = revC.length || revP.length ? exclude(pi, PAT.sales) : [];
  const revenueRowsC = revC.length || revP.length ? revC : ci;
  const revenueRowsP = revC.length || revP.length ? revP : pi;

  const purchaseC = pick(ce, PAT.purchase);
  const purchaseP = pick(pe, PAT.purchase);
  const empC = pick(ce, PAT.employee);
  const empP = pick(pe, PAT.employee);
  const finC = pick(ce, PAT.finance);
  const finP = pick(pe, PAT.finance);
  const depC = pick(ce, PAT.depreciation);
  const depP = pick(pe, PAT.depreciation);
  const taxC = pick(ce, PAT.taxExpense);
  const taxP = pick(pe, PAT.taxExpense);
  const otherExpC = exclude(
    ce,
    new RegExp(
      `${PAT.purchase.source}|${PAT.employee.source}|${PAT.finance.source}|${PAT.depreciation.source}|${PAT.taxExpense.source}`,
      'i'
    )
  );
  const otherExpP = exclude(
    pe,
    new RegExp(
      `${PAT.purchase.source}|${PAT.employee.source}|${PAT.finance.source}|${PAT.depreciation.source}|${PAT.taxExpense.source}`,
      'i'
    )
  );

  const totalRevC = sumAmounts(ci);
  const totalRevP = sumAmounts(pi);
  const totalExpC = sumAmounts(ce);
  const totalExpP = sumAmounts(pe);
  const pbtC = totalRevC - totalExpC;
  const pbtP = totalRevP - totalExpP;

  const out: ComparativeLine[] = [
    line('A  CONTINUING OPERATIONS', null, null, {
      section: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.continuingOperations',
    }),
  ];

  const revItems = summedLine(
    line('1  Revenue from operations (net)', 0, 0, {
      indent: 0,
      note: '8',
      labelKey: 'balanceSheet.lines.revenueFromOperations',
    }),
    revenueRowsC,
    revenueRowsP
  );
  const othItems = summedLine(
    line('2  Other Income', 0, 0, {
      indent: 0,
      note: '9',
      labelKey: 'balanceSheet.lines.otherIncome',
    }),
    othIncC,
    othIncP
  );
  out.push(...revItems, ...othItems);
  out.push(
    line('3  Total Revenue (1+2)', totalRevC, totalRevP, {
      total: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.totalRevenue',
    })
  );

  const expItems = [
    ...summedLine(
      line('(b) Purchases', 0, 0, { labelKey: 'balanceSheet.lines.purchases' }),
      purchaseC,
      purchaseP
    ),
    ...summedLine(
      line('(d) Employee benefits expenses', 0, 0, {
        labelKey: 'balanceSheet.lines.employeeBenefits',
      }),
      empC,
      empP
    ),
    ...summedLine(
      line('(e) Finance costs', 0, 0, { labelKey: 'balanceSheet.lines.financeCosts' }),
      finC,
      finP
    ),
    ...summedLine(
      line('(f) Depreciation and amortisation expenses', 0, 0, {
        labelKey: 'balanceSheet.lines.depreciation',
      }),
      depC,
      depP
    ),
    ...summedLine(
      line('(g) Other expenses', 0, 0, {
        note: '10',
        labelKey: 'balanceSheet.lines.otherExpenses',
      }),
      otherExpC,
      otherExpP
    ),
  ];
  if (expItems.length) {
    out.push(
      line('4  Expenses', null, null, { indent: 0, group: true, labelKey: 'balanceSheet.lines.expenses' }),
      ...expItems
    );
  }
  out.push(
    line('Total Expenses', totalExpC, totalExpP, {
      total: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.totalExpenses',
    }),
    line('5  Profit / (Loss) before tax (3 - 4)', pbtC, pbtP, {
      total: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.profitBeforeTax',
    })
  );

  const taxItems = summedLine(
    line('6  Tax Expense', 0, 0, { indent: 0, labelKey: 'balanceSheet.lines.taxExpense' }),
    taxC,
    taxP
  );
  out.push(...taxItems);
  out.push(
    line('7  Profit / (Loss) from continuing operations', pbtC, pbtP, {
      total: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.profitFromContinuing',
    })
  );
  return out;
}

/** Capital (Note 1–3) — 자본/잉여금 스케줄 */
export function buildCapitalSheet(current: BsBundle | null, previous: BsBundle | null): ComparativeLine[] {
  const ce = (current?.equityRows || []).filter((r) => !r.synthetic);
  const pe = (previous?.equityRows || []).filter((r) => !r.synthetic);
  const capitalC = sumAmounts(pick(ce, PAT.capital));
  const capitalP = sumAmounts(pick(pe, PAT.capital));
  const reservesC = sumAmounts(exclude(ce, PAT.capital));
  const reservesP = sumAmounts(exclude(pe, PAT.capital));
  const profitC = current?.netProfit || 0;
  const profitP = previous?.netProfit || 0;
  const openingSurplusC = reservesP; // 전기 잉여금을 당기 기초로 근사
  const closingSurplusC = openingSurplusC + profitC;
  const closingSurplusP = reservesP + profitP;

  return [
    line('Note 1  SHARE CAPITAL', null, null, {
      section: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.note1ShareCapital',
    }),
    ...groupBlock(
      line('Issued, Subscribed and Paid up', null, null, {
        labelKey: 'balanceSheet.lines.issuedSubscribedPaidUp',
      }),
      pick(ce, PAT.capital),
      pick(pe, PAT.capital)
    ),
    line('Total', capitalC, capitalP, {
      total: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.total',
    }),
    line('Note 2  RESERVES AND SURPLUS', null, null, {
      section: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.note2Reserves',
    }),
    ...groupBlock(
      line('(A) Share Premium / Other reserves', null, null, {
        labelKey: 'balanceSheet.lines.sharePremiumOtherReserves',
      }),
      exclude(ce, PAT.capital),
      exclude(pe, PAT.capital)
    ),
    line('(B) Surplus / (Deficit) in Statement of P&L', null, null, {
      indent: 0,
      labelKey: 'balanceSheet.lines.surplusDeficit',
    }),
    line('Opening balance', openingSurplusC, reservesP - profitP, {
      labelKey: 'balanceSheet.lines.openingBalance',
    }),
    line('Add: Profit / (Loss) for the year', profitC, profitP, {
      labelKey: 'balanceSheet.lines.addProfitForYear',
    }),
    line('Closing balance (B)', closingSurplusC, closingSurplusP, {
      total: true,
      labelKey: 'balanceSheet.lines.closingBalanceB',
    }),
    line('Total (A)+(B)', reservesC + closingSurplusC, reservesP + closingSurplusP, {
      total: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.totalAB',
    }),
    line('Note 3  LONG TERM BORROWINGS', null, null, {
      section: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.note3LongTermBorrowings',
    }),
    ...accountLines(
      exclude(pick(current?.liabilityRows || [], PAT.borrowing), PAT.shortBorrow),
      exclude(pick(previous?.liabilityRows || [], PAT.borrowing), PAT.shortBorrow)
    ),
  ];
}

/** Sch - BS */
export function buildSchBsSheet(current: BsBundle | null, previous: BsBundle | null): ComparativeLine[] {
  const ca = current?.assetRows || [];
  const pa = previous?.assetRows || [];
  const cl = current?.liabilityRows || [];
  const pl = previous?.liabilityRows || [];

  const otherLiabC = exclude(cl, new RegExp(`${PAT.payable.source}|${PAT.borrowing.source}`, 'i'));
  const otherLiabP = exclude(pl, new RegExp(`${PAT.payable.source}|${PAT.borrowing.source}`, 'i'));
  const tdsC = pick(cl, PAT.tds);
  const tdsP = pick(pl, PAT.tds);
  const fixedC = pick(ca, PAT.fixed);
  const fixedP = pick(pa, PAT.fixed);
  const cashC = pick(ca, PAT.cash);
  const cashP = pick(pa, PAT.cash);
  const inputGstC = pick(ca, PAT.gstInput);
  const inputGstP = pick(pa, PAT.gstInput);
  const otherAssetC = exclude(ca, new RegExp(`${PAT.fixed.source}|${PAT.cash.source}|${PAT.receivable.source}|${PAT.inventory.source}`, 'i'));
  const otherAssetP = exclude(pa, new RegExp(`${PAT.fixed.source}|${PAT.cash.source}|${PAT.receivable.source}|${PAT.inventory.source}`, 'i'));

  const lines: ComparativeLine[] = [
    line('Note 4  OTHER CURRENT LIABILITIES', null, null, {
      section: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.note4OtherCurrentLiabilities',
    }),
  ];
  if (tdsC.length || tdsP.length) {
    lines.push(
      line('TDS Payable', sumAmounts(tdsC), sumAmounts(tdsP), {
        labelKey: 'balanceSheet.lines.tdsPayable',
      })
    );
  }
  const restLiabC = exclude(otherLiabC, PAT.tds);
  const restLiabP = exclude(otherLiabP, PAT.tds);
  restLiabC.forEach((r) => {
    const prev = restLiabP.find((x) => x.name === r.name);
    lines.push(line(accountLineLabel(r.name), r.amount, prev?.amount || 0));
  });
  restLiabP
    .filter((r) => !restLiabC.some((x) => x.name === r.name))
    .forEach((r) => lines.push(line(accountLineLabel(r.name), 0, r.amount)));
  lines.push(
    line('Total', sumAmounts(otherLiabC), sumAmounts(otherLiabP), {
      total: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.total',
    }),
    line('Note 5  FIXED TANGIBLE ASSETS', null, null, {
      section: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.note5FixedTangible',
    }),
    line('Closing balance', sumAmounts(fixedC), sumAmounts(fixedP), {
      total: true,
      labelKey: 'balanceSheet.lines.closingBalance',
    }),
    line('Note 6  CASH AND CASH EQUIVALENTS', null, null, {
      section: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.note6Cash',
    })
  );
  cashC.forEach((r) => {
    const prev = cashP.find((x) => x.name === r.name);
    lines.push(line(accountLineLabel(r.name), r.amount, prev?.amount || 0));
  });
  cashP
    .filter((r) => !cashC.some((x) => x.name === r.name))
    .forEach((r) => lines.push(line(accountLineLabel(r.name), 0, r.amount)));
  lines.push(
    line('Total', sumAmounts(cashC), sumAmounts(cashP), {
      total: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.total',
    }),
    line('Note 7  OTHER CURRENT ASSETS', null, null, {
      section: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.note7OtherCurrentAssets',
    }),
    line('Input GST', sumAmounts(inputGstC), sumAmounts(inputGstP), {
      labelKey: 'balanceSheet.lines.inputGst',
    })
  );
  exclude(otherAssetC, PAT.gstInput).forEach((r) => {
    const prev = otherAssetP.find((x) => x.name === r.name);
    lines.push(line(accountLineLabel(r.name), r.amount, prev?.amount || 0));
  });
  lines.push(
    line('Total', sumAmounts(otherAssetC), sumAmounts(otherAssetP), {
      total: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.total',
    })
  );
  return lines;
}

/** Sch - PL */
export function buildSchPlSheet(current: PlBundle | null, previous: PlBundle | null): ComparativeLine[] {
  const ci = current?.incomeRows || [];
  const pi = previous?.incomeRows || [];
  const ce = current?.expenseRows || [];
  const pe = previous?.expenseRows || [];

  const revC = pick(ci, PAT.sales);
  const revP = pick(pi, PAT.sales);
  const othIncC = exclude(ci, PAT.sales);
  const othIncP = exclude(pi, PAT.sales);
  const otherExpC = exclude(
    ce,
    new RegExp(`${PAT.purchase.source}|${PAT.employee.source}|${PAT.finance.source}|${PAT.depreciation.source}`, 'i')
  );
  const otherExpP = exclude(
    pe,
    new RegExp(`${PAT.purchase.source}|${PAT.employee.source}|${PAT.finance.source}|${PAT.depreciation.source}`, 'i')
  );

  const lines: ComparativeLine[] = [
    line('Note 8  REVENUE FROM OPERATIONS', null, null, {
      section: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.note8Revenue',
    }),
  ];
  (revC.length ? revC : ci).forEach((r) => {
    const prev = (revP.length ? revP : pi).find((x) => x.name === r.name);
    lines.push(line(accountLineLabel(r.name), r.amount, prev?.amount || 0));
  });
  lines.push(
    line(
      'Total',
      revC.length ? sumAmounts(revC) : sumAmounts(ci),
      revP.length ? sumAmounts(revP) : sumAmounts(pi),
      { total: true, indent: 0, labelKey: 'balanceSheet.lines.total' }
    ),
    line('Note 9  OTHER INCOME', null, null, {
      section: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.note9OtherIncome',
    })
  );
  othIncC.forEach((r) => {
    const prev = othIncP.find((x) => x.name === r.name);
    lines.push(line(accountLineLabel(r.name), r.amount, prev?.amount || 0));
  });
  if (!othIncC.length && !othIncP.length) {
    lines.push(line('(None)', 0, 0, { labelKey: 'balanceSheet.lines.none' }));
  }
  lines.push(
    line('Total', sumAmounts(othIncC), sumAmounts(othIncP), {
      total: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.total',
    }),
    line('Note 10  OTHER EXPENSES', null, null, {
      section: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.note10OtherExpenses',
    })
  );
  otherExpC.forEach((r) => {
    const prev = otherExpP.find((x) => x.name === r.name);
    lines.push(line(accountLineLabel(r.name), r.amount, prev?.amount || 0));
  });
  otherExpP
    .filter((r) => !otherExpC.some((x) => x.name === r.name))
    .forEach((r) => lines.push(line(accountLineLabel(r.name), 0, r.amount)));
  lines.push(
    line('Total', sumAmounts(otherExpC), sumAmounts(otherExpP), {
      total: true,
      indent: 0,
      labelKey: 'balanceSheet.lines.total',
    })
  );
  return lines;
}

export function buildTradePayableRows(liabilityRows: AmountRow[]): AmountRow[] {
  return pick(liabilityRows, PAT.payable).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

export function buildGstRows(rows: AmountRow[], kind: 'input' | 'output'): AmountRow[] {
  return pick(rows, kind === 'input' ? PAT.gstInput : PAT.gstOutput).sort(
    (a, b) => Math.abs(b.amount) - Math.abs(a.amount)
  );
}

export function buildOtherExpenseRows(expenseRows: AmountRow[]): AmountRow[] {
  return exclude(
    expenseRows,
    new RegExp(`${PAT.purchase.source}|${PAT.employee.source}|${PAT.finance.source}|${PAT.depreciation.source}`, 'i')
  ).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

type DetailSource = 'asset' | 'liability' | 'income' | 'expense';

export type DetailScheduleKey =
  | 'cashBank'
  | 'tradeReceivable'
  | 'inventory'
  | 'investments'
  | 'loansAdvances'
  | 'tradePayable'
  | 'borrowings'
  | 'provisions'
  | 'inputGst'
  | 'outputGst'
  | 'tds'
  | 'revenue'
  | 'otherIncome'
  | 'purchases'
  | 'employeeCost'
  | 'financeCost'
  | 'depreciation'
  | 'otherExpenses';

const DETAIL_SCHEDULE_DEFS: Array<{
  key: Exclude<DetailScheduleKey, 'otherExpenses'>;
  sources: DetailSource[];
  pattern: RegExp;
}> = [
  { key: 'cashBank', sources: ['asset'], pattern: PAT.cash },
  { key: 'tradeReceivable', sources: ['asset'], pattern: PAT.receivable },
  { key: 'inventory', sources: ['asset'], pattern: PAT.inventory },
  { key: 'investments', sources: ['asset'], pattern: PAT.investment },
  { key: 'loansAdvances', sources: ['asset'], pattern: PAT.advance },
  { key: 'tradePayable', sources: ['liability'], pattern: PAT.payable },
  { key: 'borrowings', sources: ['liability'], pattern: PAT.borrowing },
  { key: 'provisions', sources: ['liability'], pattern: PAT.provision },
  { key: 'inputGst', sources: ['asset', 'liability'], pattern: PAT.gstInput },
  { key: 'outputGst', sources: ['asset', 'liability'], pattern: PAT.gstOutput },
  { key: 'tds', sources: ['asset', 'liability'], pattern: PAT.tds },
  { key: 'revenue', sources: ['income'], pattern: PAT.sales },
  { key: 'otherIncome', sources: ['income'], pattern: PAT.otherIncome },
  { key: 'purchases', sources: ['expense'], pattern: PAT.purchase },
  { key: 'employeeCost', sources: ['expense'], pattern: PAT.employee },
  { key: 'financeCost', sources: ['expense'], pattern: PAT.finance },
  { key: 'depreciation', sources: ['expense'], pattern: PAT.depreciation },
];

export const DETAIL_SCHEDULE_KEYS: DetailScheduleKey[] = [
  ...DETAIL_SCHEDULE_DEFS.map((d) => d.key),
  'otherExpenses',
];

const uniqueAmountRows = (rows: AmountRow[]): AmountRow[] => {
  const byKey: Record<string, AmountRow> = {};
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    const k = r.accountId ? `id:${r.accountId}` : `name:${String(r.name || '').toLowerCase()}`;
    byKey[k] = r;
  }
  const keys = Object.keys(byKey);
  const out: AmountRow[] = [];
  for (let i = 0; i < keys.length; i += 1) out.push(byKey[keys[i]]);
  out.sort((a, b) => Math.abs(Number(b.amount || 0)) - Math.abs(Number(a.amount || 0)));
  return out;
};

/** 본표 계정에서 스케줄 탭용 내역을 만든다. 금액 있는 탭만 UI에서 표시한다. */
export function buildDetailSchedules(params: {
  assetRows?: AmountRow[];
  liabilityRows?: AmountRow[];
  incomeRows?: AmountRow[];
  expenseRows?: AmountRow[];
}): Record<DetailScheduleKey, AmountRow[]> {
  const buckets: Record<DetailSource, AmountRow[]> = {
    asset: params.assetRows || [],
    liability: params.liabilityRows || [],
    income: params.incomeRows || [],
    expense: params.expenseRows || [],
  };
  const out = {} as Record<DetailScheduleKey, AmountRow[]>;
  for (let i = 0; i < DETAIL_SCHEDULE_DEFS.length; i += 1) {
    const def = DETAIL_SCHEDULE_DEFS[i];
    const collected: AmountRow[] = [];
    for (let s = 0; s < def.sources.length; s += 1) {
      const picked = pick(buckets[def.sources[s]], def.pattern);
      for (let p = 0; p < picked.length; p += 1) collected.push(picked[p]);
    }
    out[def.key] = uniqueAmountRows(collected);
  }
  out.otherExpenses = buildOtherExpenseRows(buckets.expense);
  return out;
}

export function detailScheduleHasRows(rows: AmountRow[] | undefined): boolean {
  if (!rows || !rows.length) return false;
  for (let i = 0; i < rows.length; i += 1) {
    if (Math.abs(Number(rows[i].amount || 0)) > AMT_EPS) return true;
  }
  return false;
}

/** 대차 불일치 점검용 — 시산표·BS 기준 이상 부호/큰 금액 계정 */
export type BsImbalanceReason =
  | 'atypical_asset'
  | 'atypical_liability'
  | 'atypical_equity'
  | 'large_bs'
  | 'large_tb';

export type BsImbalanceSuspect = {
  accountId: number;
  code: string;
  name: string;
  nameEn?: string | null;
  nature: string;
  debit: number;
  credit: number;
  /** 시산표 기간 순이동 (차변 − 대변) */
  periodNet: number;
  /** BS 쪽 금액 (없으면 null) */
  bsAmount: number | null;
  reason: BsImbalanceReason;
  score: number;
};

const IMBALANCE_EPS = 0.05;

/**
 * Trial Balance + BS 행에서 대차 차이 점검용 Top N 계정을 뽑는다.
 * 우선순위: 성격 대비 이상 부호 → BS 절대금액 → 시산표 기간 이동.
 */
export function buildBsImbalanceSuspects(
  trialRows: TbRow[],
  bs: Pick<BsBundle, 'assetRows' | 'liabilityRows' | 'equityRows'> | null,
  topN = 10
): BsImbalanceSuspect[] {
  const tbById: Record<number, TbRow> = {};
  for (let i = 0; i < trialRows.length; i += 1) {
    const row = trialRows[i];
    tbById[Number(row.accountId)] = row;
  }

  type BsSide = 'asset' | 'liability' | 'equity';
  const bsById: Record<number, { amount: number; side: BsSide; row: AmountRow }> = {};
  const pushBs = (rows: AmountRow[], side: BsSide) => {
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      if (r.synthetic || !r.accountId) continue;
      bsById[Number(r.accountId)] = { amount: Number(r.amount || 0), side, row: r };
    }
  };
  pushBs(bs?.assetRows || [], 'asset');
  pushBs(bs?.liabilityRows || [], 'liability');
  pushBs(bs?.equityRows || [], 'equity');

  const byId: Record<number, BsImbalanceSuspect> = {};

  const upsert = (candidate: BsImbalanceSuspect) => {
    const prev = byId[candidate.accountId];
    if (!prev || candidate.score > prev.score) {
      byId[candidate.accountId] = candidate;
    }
  };

  const idKeys = Object.keys(tbById).concat(Object.keys(bsById));
  const seenIds: Record<number, true> = {};

  for (let i = 0; i < idKeys.length; i += 1) {
    const accountId = Number(idKeys[i]);
    if (seenIds[accountId]) continue;
    seenIds[accountId] = true;
    const tb = tbById[accountId];
    const bsInfo = bsById[accountId];
    const nature = String(tb?.nature || bsInfo?.row.nature || bsInfo?.side || '').toLowerCase();
    const debit = Number(tb?.debit ?? bsInfo?.row.debit ?? 0);
    const credit = Number(tb?.credit ?? bsInfo?.row.credit ?? 0);
    const periodNet = Number((debit - credit).toFixed(2));
    const bsAmount = bsInfo != null ? Number(bsInfo.amount) : null;
    const code = String(tb?.code || bsInfo?.row.code || '');
    const name = String(tb?.name || bsInfo?.row.name || '');
    const nameEn = tb?.nameEn ?? bsInfo?.row.nameEn ?? null;

    const base = {
      accountId,
      code,
      name,
      nameEn,
      nature,
      debit,
      credit,
      periodNet,
      bsAmount,
    };

    if (nature === 'asset') {
      const creditHeavy = credit - debit > IMBALANCE_EPS;
      const negBs = bsAmount != null && bsAmount < -IMBALANCE_EPS;
      if (creditHeavy || negBs) {
        upsert({
          ...base,
          reason: 'atypical_asset',
          score: Math.max(credit - debit, Math.abs(bsAmount ?? 0)) * 100,
        });
        continue;
      }
    } else if (nature === 'liability' || nature === 'equity') {
      const debitHeavy = debit - credit > IMBALANCE_EPS;
      const negBs = bsAmount != null && bsAmount < -IMBALANCE_EPS;
      if (debitHeavy || negBs) {
        upsert({
          ...base,
          reason: nature === 'liability' ? 'atypical_liability' : 'atypical_equity',
          score: Math.max(debit - credit, Math.abs(bsAmount ?? 0)) * 100,
        });
        continue;
      }
    }

    if (bsAmount != null && Math.abs(bsAmount) > IMBALANCE_EPS) {
      upsert({
        ...base,
        reason: 'large_bs',
        score: Math.abs(bsAmount),
      });
    } else if (
      Math.abs(periodNet) > IMBALANCE_EPS &&
      (nature === 'asset' || nature === 'liability' || nature === 'equity')
    ) {
      upsert({
        ...base,
        reason: 'large_tb',
        score: Math.abs(periodNet) * 0.5,
      });
    }
  }

  const allSuspects = Object.keys(byId).map((k) => byId[Number(k)]);
  const atypical = allSuspects
    .filter((s) => s.reason.startsWith('atypical_'))
    .sort((a, b) => b.score - a.score);

  const fill = allSuspects
    .filter((s) => !s.reason.startsWith('atypical_'))
    .sort((a, b) => b.score - a.score);

  const out: BsImbalanceSuspect[] = [];
  const seen: Record<number, true> = {};
  const merged = atypical.concat(fill);
  for (let i = 0; i < merged.length; i += 1) {
    const s = merged[i];
    if (seen[s.accountId]) continue;
    seen[s.accountId] = true;
    out.push(s);
    if (out.length >= topN) break;
  }
  return out;
}
