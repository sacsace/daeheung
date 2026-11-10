/**
 * 급여월(YYYY-MM)에 해당하는 payrolls·payroll_period_locks 행 삭제.
 * 사용: npx ts-node scripts/delete-payrolls-by-month.ts [YYYY-MM]
 * 예: npx ts-node scripts/delete-payrolls-by-month.ts 2026-04
 */
import { Op } from 'sequelize';
import sequelize from '../src/config/database';
import Payroll from '../src/models/Payroll';
import PayrollPeriodLock from '../src/models/PayrollPeriodLock';

function sameMonthWhere(normalizedYm: string) {
  return {
    [Op.or]: [
      { payroll_period: normalizedYm },
      { payroll_period: { [Op.like]: `${normalizedYm}-%` } }
    ]
  };
}

const run = async () => {
  const ym = (process.argv[2] || '').trim() || '2026-04';
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    console.error('Usage: npx ts-node scripts/delete-payrolls-by-month.ts YYYY-MM');
    process.exitCode = 1;
    return;
  }
  try {
    await sequelize.authenticate();
    const lockDeleted = await (PayrollPeriodLock as any).destroy({ where: sameMonthWhere(ym) });
    const payrollDeleted = await (Payroll as any).destroy({ where: sameMonthWhere(ym) });
    console.log(`✅ 급여월 ${ym}: payrolls ${payrollDeleted}건, payroll_period_locks ${lockDeleted}건 삭제`);
  } catch (error) {
    console.error('❌ 삭제 실패:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

void run();
