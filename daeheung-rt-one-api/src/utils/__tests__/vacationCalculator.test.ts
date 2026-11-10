import {
  buildEmployeeAccrualLeaveYearLabel,
  calculateAnnualLeaveTotalDays,
  countAnnualLeaveMonthsInLeaveYear,
  getAnnualLeaveAccrualPeriod,
  getDefaultIndiaFiscalYearRange,
  getHireAccrualStartMonth,
  qualifiesForFullFiscalYearLeave,
} from '../vacationCalculator';

describe('annual leave accrual by hire date and fiscal year', () => {
  const fy2026 = getDefaultIndiaFiscalYearRange(new Date('2026-08-01'));

  it('counts Aug–Mar as 8 months for mid-July hire', () => {
    const hire = new Date('2026-07-13');
    const eligibility = new Date('2026-07-13');
    expect(countAnnualLeaveMonthsInLeaveYear(hire, fy2026, eligibility)).toBe(8);
  });

  it('counts Aug–Mar as 8 months for July 1 hire (hire month excluded)', () => {
    const hire = new Date('2026-07-01');
    const eligibility = new Date('2026-07-01');
    expect(countAnnualLeaveMonthsInLeaveYear(hire, fy2026, eligibility)).toBe(8);
  });

  it('counts Sep–Mar as 7 months for July 31 hire', () => {
    const hire = new Date('2026-07-31');
    const eligibility = new Date('2026-07-31');
    expect(countAnnualLeaveMonthsInLeaveYear(hire, fy2026, eligibility)).toBe(7);
  });

  it('counts Apr–Mar as 12 months for April 1 hire at fiscal year start', () => {
    const hire = new Date('2026-04-01');
    const eligibility = new Date('2026-04-01');
    expect(countAnnualLeaveMonthsInLeaveYear(hire, fy2026, eligibility)).toBe(12);
  });

  it('counts Apr–Mar for March hire before fiscal year (clamped to FY start)', () => {
    const hire = new Date('2026-03-01');
    const eligibility = new Date('2026-03-01');
    expect(countAnnualLeaveMonthsInLeaveYear(hire, fy2026, eligibility)).toBe(12);
  });

  it('ignores eligibility delay for grant months (hire-date based only)', () => {
    const hire = new Date('2026-07-13');
    const eligibility = new Date('2026-10-01');
    expect(countAnnualLeaveMonthsInLeaveYear(hire, fy2026, eligibility)).toBe(8);
  });

  it('counts Sep–Mar as 7 months for Aug 10 hire even with 30-day wait', () => {
    const hire = new Date('2026-08-10');
    const eligibility = new Date('2026-09-09');
    expect(countAnnualLeaveMonthsInLeaveYear(hire, fy2026, eligibility)).toBe(7);
  });

  it('builds per-employee accrual label from hire date within fiscal year', () => {
    const hire = new Date('2026-08-10');
    const eligibility = new Date('2026-09-09');
    const period = getAnnualLeaveAccrualPeriod(hire, fy2026, eligibility);
    expect(period?.months).toBe(7);
    expect(buildEmployeeAccrualLeaveYearLabel(fy2026, period)).toBe(
      '2026-27 (2026-09-01 ~ 2027-03-31)'
    );
  });

  it('April 1 fiscal hire starts accrual in April', () => {
    const hire = new Date('2026-04-01');
    const start = getHireAccrualStartMonth(hire, fy2026.start);
    expect(start).toEqual({ year: 2026, month: 3 });
  });

  it('grants 12 days for full fiscal year when fixed policy is on', () => {
    const hire = new Date('2026-04-01');
    const eligibility = new Date('2026-04-01');
    const policy = { forceFixedAnnualForTenure: true, forceFixedAnnualDays: 12 };
    expect(qualifiesForFullFiscalYearLeave(hire, fy2026, eligibility)).toBe(true);
    expect(calculateAnnualLeaveTotalDays(hire, fy2026, eligibility, policy)).toBe(12);
  });

  it('grants fixed days for pre-FY hire even when start policy delays use', () => {
    const hire = new Date('2026-02-02');
    const eligibility = new Date('2026-04-03'); // 60일 이후
    const policy = { forceFixedAnnualForTenure: true, forceFixedAnnualDays: 6 };
    expect(qualifiesForFullFiscalYearLeave(hire, fy2026, eligibility)).toBe(true);
    expect(calculateAnnualLeaveTotalDays(hire, fy2026, eligibility, policy)).toBe(6);
  });

  it('keeps month-based days for mid-year hire even when fixed policy is on', () => {
    const hire = new Date('2026-07-13');
    const eligibility = new Date('2026-07-13');
    const policy = { forceFixedAnnualForTenure: true, forceFixedAnnualDays: 12 };
    expect(qualifiesForFullFiscalYearLeave(hire, fy2026, eligibility)).toBe(false);
    expect(calculateAnnualLeaveTotalDays(hire, fy2026, eligibility, policy)).toBe(8);
  });
});
