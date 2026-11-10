import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import nodemailer from 'nodemailer';
import { Op, Sequelize } from 'sequelize';
import { RequestWithUser } from '../types';
import { Approval, Company, Payroll, PayrollBonus, PayslipDelivery, User } from '../models';
import {
  bonusPaymentAmount,
  bonusRatePercent,
  listFiscalYears,
  monthsSinceHire,
  parseFiscalYearLabel,
} from '../services/payrollBonusCalc';
import { buildBonusStatementPdf, BonusStatementInput } from '../services/bonusStatementPdf';
import { buildAndStoreBonusListExcelAttachment } from '../services/bonusApprovalExcel';
import { ensureUploadSubdir } from '../utils/uploadPath';
import { buildNodemailerTransportOptions, getResolvedMailTransportOptions } from '../utils/mailConfig';
import { pushNotification } from './notificationController';
import SocketService from '../services/socketService';

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

function notExcluded() {
  return { excluded_at: { [Op.is]: null } };
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

function bonusDocumentId(
  companyId: number,
  fiscalYear: string,
  installmentsPerYear: number,
  installment: number
) {
  return `BONUS-${companyId}-${fiscalYear}-${installmentsPerYear}-${installment}`;
}

function approvalBlocksEdit(status: unknown) {
  const value = String(status || '');
  return value === 'submitted' || value === 'in_review' || value === 'approved';
}

async function findBonusApproval(
  tenantId: number,
  companyId: number,
  fiscalYear: string,
  installmentsPerYear: number,
  installment: number
) {
  return (Approval as any).findOne({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      document_id: bonusDocumentId(companyId, fiscalYear, installmentsPerYear, installment),
      is_active: true,
    },
    include: [
      {
        model: User,
        as: 'currentApprover',
        attributes: ['id', 'username'],
        required: false,
      },
    ],
  });
}

function approvalPayload(approval: any) {
  if (!approval) return null;
  return {
    id: approval.id,
    status: approval.status,
    title: approval.title,
    current_approver_id: approval.current_approver_id,
    currentApprover: approval.currentApprover || null,
    amount: approval.amount != null ? Number(approval.amount) : null,
  };
}

async function batchIsLocked(
  tenantId: number,
  companyId: number,
  fiscalYear: string,
  installment: number,
  installmentsPerYear: number
) {
  const current = await findBonusApproval(
    tenantId,
    companyId,
    fiscalYear,
    installmentsPerYear,
    installment
  );
  if (approvalBlocksEdit(current?.status)) return true;
  const sample = await (PayrollBonus as any).findOne({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      fiscal_year: fiscalYear,
      installment,
      ...notExcluded(),
    },
    attributes: ['installments_per_year'],
  });
  if (sample && Number(sample.installments_per_year) !== installmentsPerYear) {
    const other = await findBonusApproval(
      tenantId,
      companyId,
      fiscalYear,
      Number(sample.installments_per_year) === 2 ? 2 : 1,
      installment
    );
    if (approvalBlocksEdit(other?.status)) return true;
  }
  return false;
}

function periodLabel(fiscalYear: string, installment: number, installmentsPerYear: number) {
  return installmentsPerYear === 2
    ? `${fiscalYear} installment ${installment} of 2`
    : `${fiscalYear}`;
}

function payslipPeriod(fiscalYear: string, installment: number) {
  return `Bonus ${fiscalYear} #${installment}`.slice(0, 30);
}

function shortCompanyName(name?: string | null) {
  return String(name || '')
    .replace(/\bprivate\s+limited\b\.?/gi, '')
    .replace(/\bpvt\.?\s*ltd\.?\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[,\s]+$/g, '')
    .trim();
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
      attributes: [
        'id',
        'username',
        'email',
        'department',
        'employee_number',
        'hire_date',
        'salary',
        'bank_account',
        'bank_ifsc',
      ],
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

    const locked = await batchIsLocked(
      tenantId,
      companyId,
      fy.label,
      installment,
      installmentsPerYear
    );
    const data = [];
    for (const user of users) {
      const saved = savedByEmployee.get(user.id);
      if (saved?.excluded_at) continue;
      const hire = user.hire_date ? String(user.hire_date).slice(0, 10) : null;
      const savedMatches = Boolean(
        saved && Number(saved.installments_per_year) === installmentsPerYear
      );
      const tenure = monthsSinceHire(hire);
      const paid = savedMatches && saved.status === 'paid';
      const storedMonths = savedMatches ? Number(saved.months_worked) || 0 : 0;
      const storedRate = savedMatches ? money(saved.rate_percent) : 0;
      const manualRate =
        savedMatches && Math.abs(storedRate - bonusRatePercent(storedMonths)) > 0.05;
      const monthly = savedMatches
        ? money(saved.monthly_salary)
        : monthlyByEmployee.get(user.id) || money(user.salary);
      const months = paid ? storedMonths : tenure;
      const ratePercent = paid
        ? storedRate
        : manualRate
          ? storedRate
          : bonusRatePercent(tenure);
      const amount = paid
        ? money(saved.amount)
        : manualRate
          ? money(saved.amount)
          : bonusPaymentAmount(monthly, tenure, installmentsPerYear);
      if (savedMatches && !paid && !locked) {
        const monthsChanged = storedMonths !== months;
        const rateChanged = Math.abs(storedRate - ratePercent) > 0.01;
        const amountChanged = Math.abs(money(saved.amount) - amount) > 0.5;
        if (monthsChanged || rateChanged || amountChanged) {
          await saved.update({
            months_worked: months,
            rate_percent: ratePercent,
            amount,
          });
        }
      }
      data.push({
        id: savedMatches ? Number(saved.id) : null,
        employee_id: user.id,
        employee_name: user.username,
        employee_number: user.employee_number || '',
        department: user.department || '',
        email: user.email || '',
        bank_account: user.bank_account || '',
        bank_ifsc: user.bank_ifsc || '',
        hire_date: hire,
        months_worked: months,
        monthly_salary: monthly,
        rate_percent: ratePercent,
        amount,
        installments_per_year: installmentsPerYear,
        installment,
        status: savedMatches ? saved.status : null,
        paid_at: savedMatches ? saved.paid_at || null : null,
      });
    }

    const approval = await findBonusApproval(
      tenantId,
      companyId,
      fy.label,
      installmentsPerYear,
      installment
    );

    return res.json({
      success: true,
      data: {
        fiscal_year: fy,
        fiscal_years: listFiscalYears(),
        installments_per_year: installmentsPerYear,
        installment,
        approval: approvalPayload(approval),
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
    const generateAll = Boolean(req.body?.generate_all);
    const employeeIds = Array.isArray(req.body?.employee_ids)
      ? req.body.employee_ids.map((id: unknown) => Number(id)).filter((id: number) => id > 0)
      : [];
    if (!generateAll && employeeIds.length === 0) {
      return res.status(400).json({ success: false, message: '직원을 선택해 주세요.' });
    }
    if (
      !markPaid &&
      (await batchIsLocked(tenantId, companyId, fy.label, installment, installmentsPerYear))
    ) {
      return res.status(400).json({
        success: false,
        message: '결재가 진행 중이거나 승인된 보너스는 다시 생성할 수 없습니다.',
      });
    }

    if (markPaid) {
      if (userRole !== 'root') {
        const approval = await findBonusApproval(
          tenantId,
          companyId,
          fy.label,
          installmentsPerYear,
          installment
        );
        if (!approval || String(approval.status) !== 'approved') {
          return res.status(400).json({
            success: false,
            message: '결재 승인 후에 지급 완료할 수 있습니다.',
          });
        }
      }
      const existing = await (PayrollBonus as any).findAll({
        where: {
          tenant_id: tenantId,
          company_id: companyId,
          fiscal_year: fy.label,
          installment,
          installments_per_year: installmentsPerYear,
          employee_id: { [Op.in]: employeeIds },
          ...notExcluded(),
        },
      });
      if (existing.length !== employeeIds.length) {
        return res.status(400).json({
          success: false,
          message: '등록되지 않은 직원이 있습니다. 먼저 보너스를 생성하세요.',
        });
      }
      const now = new Date();
      for (const row of existing) {
        await row.update({ status: 'paid', paid_at: now });
      }
      return res.json({
        success: true,
        message: '선택한 보너스를 지급 완료로 기록했습니다.',
        data: { saved: existing.length },
      });
    }

    const users = await (User as any).findAll({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        status: 'active',
        ...(generateAll ? {} : { id: { [Op.in]: employeeIds } }),
      },
      attributes: ['id', 'hire_date', 'salary'],
    });
    const monthlyByEmployee = await latestMonthlyByEmployee(
      tenantId,
      companyId,
      users.map((user: any) => user.id)
    );

    let saved = 0;
    for (const user of users) {
      const hire = user.hire_date ? String(user.hire_date).slice(0, 10) : null;
      const months = monthsSinceHire(hire);
      const monthly = monthlyByEmployee.get(user.id) || money(user.salary);
      const amount = bonusPaymentAmount(monthly, months, installmentsPerYear);
      const ratePercent = bonusRatePercent(months);
      const existing = await (PayrollBonus as any).findOne({
        where: {
          tenant_id: tenantId,
          company_id: companyId,
          employee_id: user.id,
          fiscal_year: fy.label,
          installment,
        },
      });
      if (existing?.excluded_at) continue;
      const payload = {
        installments_per_year: installmentsPerYear,
        months_worked: months,
        monthly_salary: monthly,
        rate_percent: ratePercent,
        amount,
        status: 'registered',
        paid_at: null,
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
      message: '보너스를 등록했습니다.',
      data: { saved },
    });
  } catch (error) {
    console.error('보너스 등록 오류:', error);
    return res.status(500).json({ success: false, message: '보너스 등록에 실패했습니다.' });
  }
};

export const removePayrollBonuses = async (req: RequestWithUser, res: Response) => {
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
    const employeeIds = Array.isArray(req.body?.employee_ids)
      ? req.body.employee_ids.map((id: unknown) => Number(id)).filter((id: number) => id > 0)
      : [];
    if (employeeIds.length === 0) {
      return res.status(400).json({ success: false, message: '직원을 선택해 주세요.' });
    }
    if (await batchIsLocked(tenantId, companyId, fy.label, installment, installmentsPerYear)) {
      return res.status(400).json({
        success: false,
        message: '결재가 진행 중이거나 승인된 보너스는 삭제할 수 없습니다.',
      });
    }

    const users = await (User as any).findAll({
      where: {
        id: { [Op.in]: employeeIds },
        tenant_id: tenantId,
        company_id: companyId,
        status: 'active',
      },
      attributes: ['id'],
    });
    if (!users.length) {
      return res.status(400).json({ success: false, message: '직원을 선택해 주세요.' });
    }

    const existing = await (PayrollBonus as any).findAll({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        fiscal_year: fy.label,
        installment,
        employee_id: { [Op.in]: users.map((user: any) => user.id) },
      },
    });
    if (existing.some((row: any) => row.status === 'paid' && !row.excluded_at)) {
      return res.status(400).json({
        success: false,
        message: '지급 완료된 보너스는 삭제할 수 없습니다.',
      });
    }

    const now = new Date();
    let removed = 0;
    for (const user of users) {
      const row = existing.find((item: any) => Number(item.employee_id) === Number(user.id));
      if (row?.excluded_at) continue;
      if (row) {
        await row.update({ excluded_at: now });
      } else {
        await (PayrollBonus as any).create({
          tenant_id: tenantId,
          company_id: companyId,
          employee_id: user.id,
          fiscal_year: fy.label,
          installments_per_year: installmentsPerYear,
          installment,
          months_worked: 0,
          monthly_salary: 0,
          rate_percent: 0,
          amount: 0,
          status: 'registered',
          paid_at: null,
          excluded_at: now,
          created_by: userId ?? null,
        });
      }
      removed += 1;
    }

    return res.json({
      success: true,
      message: '선택한 직원을 이번 보너스 대상에서 제외했습니다.',
      data: { removed },
    });
  } catch (error) {
    console.error('보너스 대상 제외 오류:', error);
    return res.status(500).json({ success: false, message: '보너스 대상을 삭제하지 못했습니다.' });
  }
};

export const updatePayrollBonusLine = async (req: RequestWithUser, res: Response) => {
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
    const employeeId = Number(req.body?.employee_id);
    const ratePercent = money(req.body?.rate_percent);
    const amount = money(req.body?.amount);
    if (!Number.isFinite(employeeId) || employeeId <= 0) {
      return res.status(400).json({ success: false, message: '직원을 확인해 주세요.' });
    }
    if (ratePercent < 0 || ratePercent > 1000 || amount < 0) {
      return res.status(400).json({ success: false, message: '지급률과 금액은 0 이상이어야 합니다.' });
    }
    if (await batchIsLocked(tenantId, companyId, fy.label, installment, installmentsPerYear)) {
      return res.status(400).json({
        success: false,
        message: '결재가 진행 중이거나 승인된 보너스는 수정할 수 없습니다.',
      });
    }

    const user = await (User as any).findOne({
      where: { id: employeeId, tenant_id: tenantId, company_id: companyId, status: 'active' },
      attributes: ['id', 'hire_date', 'salary'],
    });
    if (!user) {
      return res.status(404).json({ success: false, message: '직원을 찾을 수 없습니다.' });
    }
    const monthlyByEmployee = await latestMonthlyByEmployee(tenantId, companyId, [user.id]);
    const hire = user.hire_date ? String(user.hire_date).slice(0, 10) : null;
    const months = monthsSinceHire(hire);
    const monthly = monthlyByEmployee.get(user.id) || money(user.salary);
    const existing = await (PayrollBonus as any).findOne({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        employee_id: user.id,
        fiscal_year: fy.label,
        installment,
      },
    });
    if (existing?.excluded_at) {
      return res.status(400).json({
        success: false,
        message: '이번 보너스 대상에서 제외된 직원입니다.',
      });
    }
    const payload = {
      installments_per_year: installmentsPerYear,
      months_worked: months,
      monthly_salary: existing ? money(existing.monthly_salary) || monthly : monthly,
      rate_percent: Math.round(ratePercent * 100) / 100,
      amount: Math.round(amount),
      status: existing?.status === 'paid' ? 'paid' : 'registered',
      paid_at: existing?.paid_at || null,
      created_by: userId ?? null,
    };
    const row = existing
      ? await existing.update(payload)
      : await (PayrollBonus as any).create({
          tenant_id: tenantId,
          company_id: companyId,
          employee_id: user.id,
          fiscal_year: fy.label,
          installment,
          ...payload,
        });
    return res.json({
      success: true,
      data: {
        id: Number(row.id),
        employee_id: user.id,
        rate_percent: money(row.rate_percent),
        amount: money(row.amount),
        status: row.status,
      },
    });
  } catch (error) {
    console.error('보너스 금액 수정 오류:', error);
    return res.status(500).json({ success: false, message: '보너스 금액을 저장하지 못했습니다.' });
  }
};

export const requestPayrollBonusApproval = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId, userRole, userId } = resolveScope(req);
    if (tenantId == null || companyId == null || userId == null) {
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
    const approverId = Number(req.body?.approver_id);
    if (!Number.isFinite(approverId) || approverId <= 0) {
      return res.status(400).json({ success: false, message: '승인자를 선택해 주세요.' });
    }
    if (Number(approverId) === Number(userId)) {
      return res.status(400).json({ success: false, message: '본인을 승인자로 지정할 수 없습니다.' });
    }

    const rows = await (PayrollBonus as any).findAll({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        fiscal_year: fy.label,
        installment,
        installments_per_year: installmentsPerYear,
        ...notExcluded(),
      },
    });
    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: '생성된 보너스가 없습니다. 먼저 보너스를 생성하세요.',
      });
    }
    const total = rows.reduce((sum: number, row: any) => sum + money(row.amount), 0);
    const approver = await (User as any).findOne({
      where: { id: approverId, tenant_id: tenantId, company_id: companyId, status: 'active' },
      attributes: ['id', 'username', 'department', 'position'],
    });
    if (!approver) {
      return res.status(400).json({ success: false, message: '선택한 승인자를 찾을 수 없습니다.' });
    }

    const documentId = bonusDocumentId(companyId, fy.label, installmentsPerYear, installment);
    const existing = await findBonusApproval(
      tenantId,
      companyId,
      fy.label,
      installmentsPerYear,
      installment
    );
    if (existing && String(existing.status) === 'approved') {
      return res.status(400).json({ success: false, message: '이미 결재 승인된 보너스입니다.' });
    }
    if (existing && ['submitted', 'in_review'].includes(String(existing.status))) {
      return res.status(400).json({ success: false, message: '이미 결재가 진행 중입니다.' });
    }

    const title = `보너스 지급 결재 (${fy.label}${installmentsPerYear === 2 ? ` ${installment}차` : ''})`;
    const description = [
      `회계연도: ${fy.label}`,
      `지급: ${installmentsPerYear === 2 ? `${installment}차 / 연 2회` : '연 1회'}`,
      `대상 인원: ${rows.length}명`,
      `지급 합계: INR ${Math.round(total).toLocaleString('en-IN')}`,
      '',
      '보너스 지급·명세서 발송·은행 송금 전 승인 요청입니다.',
      '첨부: 보너스 리스트 엑셀',
    ].join('\n');
    const excelAttachment = await buildAndStoreBonusListExcelAttachment({
      tenantId,
      companyId,
      fiscalYear: fy.label,
      installmentsPerYear,
      installment,
    });
    if (!excelAttachment) {
      return res.status(500).json({
        success: false,
        message: '보너스 리스트 첨부를 만들지 못했습니다.',
      });
    }
    const approvalFlow = [
      {
        step: 1,
        approverId: Number(approver.id),
        approverName: String(approver.username || ''),
        approverDepartment: String(approver.department || '-'),
        approverPosition: String(approver.position || '-'),
        status: 'pending',
        comment: null,
        approvedAt: null,
      },
    ];
    const fields = {
      title,
      type: 'payroll',
      category: 'bonus',
      amount: Math.round(total),
      requester_id: userId,
      description,
      attachments: [excelAttachment],
      status: 'submitted',
      priority: 'high',
      current_approver_id: Number(approver.id),
      approval_flow: approvalFlow,
      is_active: true,
    };
    const approval = existing
      ? await existing.update(fields)
      : await (Approval as any).create({
          tenant_id: tenantId,
          company_id: companyId,
          document_id: documentId,
          ...fields,
        });

    const socketService = (req as any).socketService as SocketService | undefined;
    pushNotification(
      {
        title: '보너스 지급 결재 요청',
        message: `${req.user?.username || '요청자'}님이 "${title}" 결재를 요청했습니다.`,
        type: 'info',
        target_type: 'user',
        target_id: Number(approver.id),
        tenant_id: tenantId,
        company_id: companyId,
        sender_user_id: userId,
        data: {
          feature: 'approval',
          approval_id: approval.id || existing?.id,
          document_id: documentId,
          approval_title: title,
          href: '/work/approval',
        },
      },
      socketService
    );

    const refreshed = await findBonusApproval(
      tenantId,
      companyId,
      fy.label,
      installmentsPerYear,
      installment
    );
    return res.json({
      success: true,
      message: '보너스 지급 결재를 요청했습니다.',
      data: { approval: approvalPayload(refreshed) },
    });
  } catch (error) {
    console.error('보너스 결재 요청 오류:', error);
    return res.status(500).json({ success: false, message: '보너스 결재 요청에 실패했습니다.' });
  }
};

async function loadStatementRows(
  tenantId: number,
  companyId: number,
  fiscalYear: string,
  installmentsPerYear: number,
  installment: number,
  employeeIds: number[]
) {
  const bonuses = await (PayrollBonus as any).findAll({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      fiscal_year: fiscalYear,
      installment,
      installments_per_year: installmentsPerYear,
      ...(employeeIds.length ? { employee_id: { [Op.in]: employeeIds } } : {}),
      ...notExcluded(),
    },
  });
  if (!bonuses.length) return [];
  const users = await (User as any).findAll({
    where: {
      id: { [Op.in]: bonuses.map((row: any) => Number(row.employee_id)) },
      tenant_id: tenantId,
      company_id: companyId,
      status: 'active',
    },
    attributes: ['id', 'username', 'email', 'department', 'employee_number', 'hire_date'],
  });
  const userById = new Map<number, any>(users.map((user: any) => [Number(user.id), user]));
  return bonuses
    .map((row: any) => {
      const user = userById.get(Number(row.employee_id));
      if (!user) return null;
      return { row, user };
    })
    .filter(Boolean) as Array<{ row: any; user: any }>;
}

function statementInput(
  companyName: string,
  fiscalYear: string,
  installment: number,
  installmentsPerYear: number,
  row: any,
  user: any
): BonusStatementInput {
  return {
    companyName,
    employeeName: String(user.username || ''),
    employeeNumber: String(user.employee_number || ''),
    department: String(user.department || ''),
    fiscalYear,
    installment,
    installmentsPerYear,
    hireDate: user.hire_date ? String(user.hire_date).slice(0, 10) : '-',
    monthsWorked: Number(row.months_worked) || 0,
    monthlySalary: money(row.monthly_salary),
    ratePercent: money(row.rate_percent),
    amount: money(row.amount),
  };
}

async function readBonusRequest(req: RequestWithUser, res: Response) {
  const { tenantId, companyId, userRole, userId } = resolveScope(req);
  if (tenantId == null || companyId == null) {
    res.status(400).json({
      success: false,
      message: userRole === 'root' ? '회사를 선택해 주세요.' : '회사 정보가 없습니다.',
    });
    return null;
  }
  const fy = parseFiscalYearLabel(String(req.body?.fiscal_year || ''));
  if (!fy) {
    res.status(400).json({ success: false, message: '회계연도를 확인해 주세요.' });
    return null;
  }
  const installmentsPerYear = installmentsOf(req.body?.installments_per_year);
  const installment = installmentsPerYear === 1 ? 1 : Number(req.body?.installment) === 2 ? 2 : 1;
  const employeeIds = Array.isArray(req.body?.employee_ids)
    ? req.body.employee_ids.map((id: unknown) => Number(id)).filter((id: number) => id > 0)
    : [];
  return { tenantId, companyId, userId, userRole, fy, installmentsPerYear, installment, employeeIds };
}

export const downloadPayrollBonusStatement = async (req: RequestWithUser, res: Response) => {
  try {
    const scope = await readBonusRequest(req, res);
    if (!scope) return;
    const { tenantId, companyId, fy, installmentsPerYear, installment, employeeIds } = scope;
    if (employeeIds.length === 0) {
      return res.status(400).json({ success: false, message: '명세서를 만들 직원을 선택해 주세요.' });
    }
    const pairs = await loadStatementRows(
      tenantId,
      companyId,
      fy.label,
      installmentsPerYear,
      installment,
      employeeIds
    );
    if (!pairs.length) {
      return res.status(400).json({
        success: false,
        message: '등록된 보너스가 없습니다. 먼저 보너스를 생성하세요.',
      });
    }
    const company = await (Company as any).findOne({
      where: { id: companyId, tenant_id: tenantId },
      attributes: ['name'],
    });
    const pdf = await buildBonusStatementPdf(
      pairs.map(({ row, user }) =>
        statementInput(String(company?.name || ''), fy.label, installment, installmentsPerYear, row, user)
      )
    );
    return res.json({
      success: true,
      data: {
        filename: `bonus-statement-${fy.label}-${installment}.pdf`,
        pdf_base64: pdf.toString('base64'),
      },
    });
  } catch (error) {
    console.error('보너스 명세서 작성 오류:', error);
    return res.status(500).json({ success: false, message: '보너스 명세서를 만들지 못했습니다.' });
  }
};

export const sendPayrollBonusStatements = async (req: RequestWithUser, res: Response) => {
  try {
    const scope = await readBonusRequest(req, res);
    if (!scope) return;
    const { tenantId, companyId, userId, fy, installmentsPerYear, installment, employeeIds } = scope;
    if (employeeIds.length === 0) {
      return res.status(400).json({ success: false, message: '명세서를 보낼 직원을 선택해 주세요.' });
    }
    const approval = await findBonusApproval(
      tenantId,
      companyId,
      fy.label,
      installmentsPerYear,
      installment
    );
    if (scope.userRole !== 'root' && (!approval || String(approval.status) !== 'approved')) {
      return res.status(400).json({
        success: false,
        message: '결재 승인 후에 보너스 명세서를 보낼 수 있습니다.',
      });
    }
    const company = await (Company as any).findOne({
      where: { id: companyId, tenant_id: tenantId },
    });
    const sender = userId
      ? await (User as any).findOne({
          where: { id: userId, tenant_id: tenantId },
          attributes: ['id', 'settings'],
        })
      : null;
    const mailOpts = getResolvedMailTransportOptions(company, sender);
    if (!mailOpts) {
      return res.status(503).json({
        success: false,
        message: '메일 서버가 설정되지 않았습니다. 시스템 설정의 보내는 메일 서버를 확인해 주세요.',
      });
    }
    const pairs = await loadStatementRows(
      tenantId,
      companyId,
      fy.label,
      installmentsPerYear,
      installment,
      employeeIds
    );
    if (!pairs.length) {
      return res.status(400).json({
        success: false,
        message: '등록된 보너스가 없습니다. 먼저 보너스를 생성하세요.',
      });
    }

    const clientPdfs = new Map<number, Buffer>();
    if (Array.isArray(req.body?.statements)) {
      for (const item of req.body.statements) {
        const employeeId = Number(item?.employee_id);
        const raw = String(item?.pdf_base64 || '');
        const b64 = raw.includes(',') ? raw.split(',')[1] : raw;
        if (!employeeId || !b64) continue;
        const buf = Buffer.from(b64, 'base64');
        if (buf.length >= 64 && buf.subarray(0, 5).toString('utf8') === '%PDF-') {
          clientPdfs.set(employeeId, buf);
        }
      }
    }

    const transporter = nodemailer.createTransport(buildNodemailerTransportOptions(mailOpts));
    const companyLabel = shortCompanyName(company?.name) || String(company?.name || '');
    const period = periodLabel(fy.label, installment, installmentsPerYear);
    const storedPeriod = payslipPeriod(fy.label, installment);
    let sent = 0;
    const failed: Array<{ name: string; message: string }> = [];

    for (const { row, user } of pairs) {
      const name = String(user.username || '');
      const to = String(user.email || '').trim();
      if (!to) {
        failed.push({ name, message: '이메일이 없습니다.' });
        continue;
      }
      try {
        const pdf =
          clientPdfs.get(Number(user.id)) ||
          (await buildBonusStatementPdf([
            statementInput(String(company?.name || ''), fy.label, installment, installmentsPerYear, row, user),
          ]));
        const safeName = `Bonus statement (${fy.label}) (${name})`.replace(/[\\/:*?"<>|]/g, '_');
        await transporter.sendMail({
          from: mailOpts.from,
          to,
          subject: `Bonus statement ${period}`,
          text: `Dear ${name},\n\nPlease find attached your bonus statement for ${period}.\n\nKindly review it, and contact us if you have any questions.\n\nBest regards,\n${companyLabel}`,
          attachments: [
            {
              filename: `${safeName}.pdf`,
              content: pdf,
              contentType: 'application/pdf',
            },
          ],
        });
        try {
          const dir = ensureUploadSubdir('payslips', String(tenantId), String(companyId));
          const fileName = `bonus-${fy.label}-${installment}-${Date.now()}-${user.id}.pdf`;
          const absPath = path.join(dir, fileName);
          await fs.promises.writeFile(absPath, pdf);
          const previous = await (PayslipDelivery as any).findAll({
            where: {
              tenant_id: tenantId,
              company_id: companyId,
              payroll_period: storedPeriod,
              is_active: true,
              [Op.and]: [
                Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('recipient_email')), to.toLowerCase()),
              ],
            },
          });
          for (const prev of previous) {
            await prev.update({ is_active: false });
          }
          await (PayslipDelivery as any).create({
            tenant_id: tenantId,
            company_id: companyId,
            user_id: user.id,
            payroll_period: storedPeriod,
            employee_name: name,
            recipient_email: to,
            emp_id: user.employee_number || null,
            net_salary: money(row.amount),
            pdf_path: absPath,
            pdf_url: `/uploads/payslips/${tenantId}/${companyId}/${fileName}`,
            sent_by: userId ?? null,
            sent_at: new Date(),
            is_active: true,
          });
        } catch (storeError) {
          console.error('보너스 명세서 보관 오류:', storeError);
        }
        sent += 1;
      } catch (mailError: any) {
        failed.push({ name, message: mailError?.message || '메일 발송에 실패했습니다.' });
      }
    }

    return res.json({
      success: true,
      message: `보너스 명세서 ${sent}건을 발송했습니다.`,
      data: { sent, failed },
    });
  } catch (error) {
    console.error('보너스 명세서 메일 오류:', error);
    return res.status(500).json({ success: false, message: '보너스 명세서 메일을 보내지 못했습니다.' });
  }
};
