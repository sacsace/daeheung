/** 인도 법인세·Advance Tax 추정 계산 유틸 */

export type CorporateTaxInputs = {
  netProfit: number;
  additions: number;
  deductions: number;
  /** 기본세율 % (예: 22, 25, 30) */
  baseRatePercent: number;
  /** 할증세(surcharge) % */
  surchargePercent: number;
  /** Health & Education Cess % (보통 4) */
  cessPercent: number;
};

export type CorporateTaxResult = {
  taxableIncome: number;
  baseTax: number;
  surcharge: number;
  cess: number;
  totalTax: number;
  effectiveRatePercent: number;
};

export type AdvanceInstallment = {
  key: 'q1' | 'q2' | 'q3' | 'q4';
  dueDate: string;
  cumulativePercent: number;
  installmentPercent: number;
  requiredCumulative: number;
  installmentDue: number;
  paid: number;
  balance: number;
};

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const computeCorporateTax = (input: CorporateTaxInputs): CorporateTaxResult => {
  const taxableIncome = round2(Math.max(0, input.netProfit + input.additions - input.deductions));
  const baseTax = round2((taxableIncome * input.baseRatePercent) / 100);
  const surcharge = round2((baseTax * input.surchargePercent) / 100);
  const cess = round2(((baseTax + surcharge) * input.cessPercent) / 100);
  const totalTax = round2(baseTax + surcharge + cess);
  const effectiveRatePercent =
    taxableIncome > 0 ? round2((totalTax / taxableIncome) * 100) : 0;
  return { taxableIncome, baseTax, surcharge, cess, totalTax, effectiveRatePercent };
};

/** FY 시작연도 기준 Advance Tax 납부일 (인도) */
export const buildAdvanceTaxDueDates = (fyStartYear: number) => ({
  q1: `${fyStartYear}-06-15`,
  q2: `${fyStartYear}-09-15`,
  q3: `${fyStartYear}-12-15`,
  q4: `${fyStartYear + 1}-03-15`,
});

/**
 * Advance Tax 분기 스케줄
 * 누적: 15% / 45% / 75% / 100%
 */
export const buildAdvanceTaxSchedule = (
  estimatedAnnualTax: number,
  fyStartYear: number,
  paid: { q1: number; q2: number; q3: number; q4: number }
): AdvanceInstallment[] => {
  const due = buildAdvanceTaxDueDates(fyStartYear);
  const tax = Math.max(0, round2(estimatedAnnualTax));
  const rows: Array<{
    key: AdvanceInstallment['key'];
    dueDate: string;
    cumulativePercent: number;
    installmentPercent: number;
  }> = [
    { key: 'q1', dueDate: due.q1, cumulativePercent: 15, installmentPercent: 15 },
    { key: 'q2', dueDate: due.q2, cumulativePercent: 45, installmentPercent: 30 },
    { key: 'q3', dueDate: due.q3, cumulativePercent: 75, installmentPercent: 30 },
    { key: 'q4', dueDate: due.q4, cumulativePercent: 100, installmentPercent: 25 },
  ];

  let prevCumulativeRequired = 0;
  return rows.map((row) => {
    const requiredCumulative = round2((tax * row.cumulativePercent) / 100);
    const installmentDue = round2(Math.max(0, requiredCumulative - prevCumulativeRequired));
    const paidAmt = round2(paid[row.key] || 0);
    const balance = round2(installmentDue - paidAmt);
    prevCumulativeRequired = requiredCumulative;
    return {
      ...row,
      requiredCumulative,
      installmentDue,
      paid: paidAmt,
      balance,
    };
  });
};

export const DEFAULT_CORPORATE_TAX_RATES = {
  /** Sec 115BAA 신세제 기본 */
  baseRatePercent: 22,
  surchargePercent: 10,
  cessPercent: 4,
} as const;
