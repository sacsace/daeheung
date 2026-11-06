import { Response } from 'express';
import { Op } from 'sequelize';
import { RequestWithUser } from '../types';
import { Payroll, PayrollBonus, User } from '../models';
import {
  bonusPaymentAmount,
  listFiscalYears,
  monthsWorkedInFiscalYear,
  parseFiscalYearLabel,
} from '../services/payrollBonusCalc';

function resolveScope(req: RequestWithUser) {
  const tenantId = req.user?.tenant_id;
  const companyId = req.user?.company_id;
  const userRole = req.user?.role;
  const queryCompanyId = req.query.company_id
    ? parseInt(String(req.query.company_id), 10)
    : undefined;
  const bodyCompanyId = (req.body as { company_id?: unknown } | undefined)?.company_id
    ? parseInt(String((req.body as { company_id?: unknown }).company_id), 10)
    : undefined;

  let effectiveCompanyId = companyId;
  if (userRole === 'root' || userRole === 'audit') {
    const requested = queryCompanyId || bodyCompanyId;
    if (requested != null && Number.isFinite(requested) && requested > 0) {
      effectiveCompanyId = requested;
    }
  }
  return { tenantId, companyId: effectiveCompanyId, userRole, userId: req.user?.id };
}

function money(value: unknown) {
  const n = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function monthlyFromPayroll(row: { basic_salary?: unknown; allowances?: unknown; gross_salary?: unknown } | undefined) {
  if (!row) return 0;
  const packaged = money(row.basic_salary) + money(row.allowances);
  if (packaged > 0) return packaged;
  return money(row.gross_salary);
}

async function latestMonthlyByEmployee(tenantId: number, companyId: number, employeeIds?: number[]) {
  const payrolls = await (Payroll as any).findAll({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      is_active: true,
      ...(employeeIds ? { employee_id: { [Op.in]: employeeIds } } : {}),
    },
    attributes: ['employee_id', 'basic_salary', 'allowances', 'gross_salary', 'payroll_period'],
    order: [['payroll_period', 'DESC']],
  });
  const monthlyByEmployee = new Map<number, number>();
  for (const row of payrolls) {
    const employeeId = Number(row.employee_id);
    if (monthlyByEmployee.has(employeeId)) continue;
    const monthly = monthlyFromPayroll(row);
    if (monthly > 0) monthlyByEmployee.set(employeeId, monthly);
  }
  return monthlyByEmployee;
}

function installmentsOf(raw: unknown): 1 | 2 {
  return Number(raw) === 2 ? 2 : 1;
}

export const getPayrollBonuses = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId, userRole } = resolveScope(req);
    if (tenantId == null) {
      return res.status(400).json({ success: false, message: '테넌트 정보가 없습니다.' });
    }
    if (companyId == null) {
      return res.status(400).json({
        success: false,
        message: userRole === 'root' ? '회사를 선택해 주세요.' : '회사 정보가 없습니다.',
      });
    }

    const fy =
      parseFiscalYearLabel(String(req.query.fiscal_year || '')) || listFiscalYears()[0];
    const installmentsPerYear = installmentsOf(req.query.installments_per_year);
    const installment =
      installmentsPerYear === 1 ? 1 : Number(req.query.installment) === 2 ? 2 : 1;

    const users = await (User as any).findAll({
      where: { tenant_id: tenantId, company_id: companyId, status: 'active' },
      attributes: ['id', 'username', 'email', 'department', 'employee_number', 'hire_date', 'salary'],
      order: [['username', 'ASC']],
    });

    const monthlyByEmployee = await latestMonthlyByEmployee(tenantId, companyId);
    const savedRows = await (PayrollBonus as any).findAll({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        fiscal_year: fy.label,
        installment,
      },
    });
    const savedByEmployee = new Map<number, any>(
      savedRows.map((row: any) => [Number(row.employee_id), row])
    );

    const data = users.map((user: any) => {
      const hire = user.hire_date ? String(user.hire_date).slice(0, 10) : null;
      const months = monthsWorkedInFiscalYear(hire, fy);
      const monthly = monthlyByEmployee.get(user.id) || money(user.salary);
      const ratePercent = Math.round((months / 12) * 10000) / 100;
      const amount = bonusPaymentAmount(monthly, months, installmentsPerYear);
      const saved = savedByEmployee.get(user.id);
      return {
        employee_id: user.id,
        employee_name: user.username,
        employee_number: user.employee_number || '',
        department: user.department || '',
        email: user.email || '',
        hire_date: hire,
        months_worked: months,
        monthly_salary: monthly,
        rate_percent: ratePercent,
        amount,
        installments_per_year: installmentsPerYear,
        installment,
        status: saved?.status || null,
        paid_at: saved?.paid_at || null,
      };
    });

    return res.json({
      success: true,
      data: {
        fiscal_year: fy,
        fiscal_years: listFiscalYears(),
        installments_per_year: installmentsPerYear,
        installment,
        rows: data,
      },
    });
  } catch (error) {
    console.error('보너스 조회 오류:', error);
    return res.status(500).json({ success: false, message: '보너스 목록을 불러오지 못했습니다.' });
  }
};

export const registerPayrollBonuses = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId, userRole, userId } = resolveScope(req);
    if (tenantId == null || companyId == null) {
      return res.status(400).json({
        success: false,
        message: userRole === 'root' ? '회사를 선택해 주세요.' : '회사 정보가 없습니다.',
      });
    }

    const fy = parseFiscalYearLabel(String(req.body?.fiscal_year || ''));
    if (!fy) {
      return res.status(400).json({ success: false, message: '회계연도를 확인해 주세요.' });
    }
    const installmentsPerYear = installmentsOf(req.body?.installments_per_year);
    const installment =
      installmentsPerYear === 1 ? 1 : Number(req.body?.installment) === 2 ? 2 : 1;
    const markPaid = Boolean(req.body?.mark_paid);
    const employeeIds = Array.isArray(req.body?.employee_ids)
      ? req.body.employee_ids.map((id: unknown) => Number(id)).filter((id: number) => id > 0)
      : [];
    if (employeeIds.length === 0) {
      return res.status(400).json({ success: false, message: '직원을 선택해 주세요.' });
    }

    const users = await (User as any).findAll({
      where: {
        id: { [Op.in]: employeeIds },
        tenant_id: tenantId,
        company_id: companyId,
        status: 'active',
      },
      attributes: ['id', 'hire_date', 'salary'],
    });
    const monthlyByEmployee = await latestMonthlyByEmployee(
      tenantId,
      companyId,
      users.map((user: any) => user.id)
    );

    const now = new Date();
    let saved = 0;
    for (const user of users) {
      const hire = user.hire_date ? String(user.hire_date).slice(0, 10) : null;
      const months = monthsWorkedInFiscalYear(hire, fy);
      const monthly = monthlyByEmployee.get(user.id) || money(user.salary);
      const amount = bonusPaymentAmount(monthly, months, installmentsPerYear);
      const ratePercent = Math.round((months / 12) * 10000) / 100;
      const existing = await (PayrollBonus as any).findOne({
        where: {
          tenant_id: tenantId,
          company_id: companyId,
          employee_id: user.id,
          fiscal_year: fy.label,
          installment,
        },
      });
      const payload = {
        installments_per_year: installmentsPerYear,
        months_worked: months,
        monthly_salary: monthly,
        rate_percent: ratePercent,
        amount,
        status: markPaid ? 'paid' : 'registered',
        paid_at: markPaid ? now : existing?.paid_at || null,
        created_by: userId ?? null,
      };
      if (existing) {
        await existing.update(payload);
      } else {
        await (PayrollBonus as any).create({
          tenant_id: tenantId,
          company_id: companyId,
          employee_id: user.id,
          fiscal_year: fy.label,
          installment,
          ...payload,
        });
      }
      saved += 1;
    }

    return res.json({
      success: true,
      message: markPaid ? '선택한 보너스를 지급 완료로 기록했습니다.' : '보너스를 등록했습니다.',
      data: { saved },
    });
  } catch (error) {
    console.error('보너스 등록 오류:', error);
    return res.status(500).json({ success: false, message: '보너스 등록에 실패했습니다.' });
  }
};
