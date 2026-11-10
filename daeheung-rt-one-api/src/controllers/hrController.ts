import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { RequestWithUser } from '../types';
import {
  Payroll,
  User,
  PayrollPeriodLock,
  Company,
  CompanyGstNumber,
  PayslipDelivery,
  Approval,
} from '../models';
import { Op, Sequelize } from 'sequelize';
import sequelize from '../config/database';
import fs from 'fs';
import path from 'path';
import { ensureUploadSubdir, resolveStoredUploadFile } from '../utils/uploadPath';
import { buildNodemailerTransportOptions, getResolvedMailTransportOptions } from '../utils/mailConfig';
import { pushNotification } from './notificationController';
import SocketService from '../services/socketService';
import ApprovalType, { DEFAULT_APPROVAL_TYPES } from '../models/ApprovalType';
import { buildAndStorePayrollListExcelAttachment } from '../services/payrollApprovalExcel';
import {
  parsePayrollPeriod,
  normalizePayrollPeriodInput,
  sameMonthPayrollPeriodWhere,
  isPayrollPeriodAfterCurrentMonth,
  findEffectiveEmploymentContract,
  computeBonusFromContract,
  aggregateAttendanceForPeriod,
  computeOvertimePay
} from '../services/payrollBulkGeneration';
import {
  computeIndianStatutoryPayroll,
  breakdownToExtraFields,
  normalizeUserPfCalcMode,
  type PfMode
} from '../services/indianStatutoryPayroll';
import { resolveCompanyRegisteredStateCode } from '../utils/indianProfessionalTax';
import {
  buildPayrollGridSettingsPatch,
  mergePayrollGridIntoCompanySettings,
  readPayrollGridSettingsFromCompanySettings,
} from '../utils/payrollGridSettings';
import {
  getHeresnowSettings,
  pullHeresnowAttendance,
} from '../services/heresnowIntegrationService';
import {
  computeEmploymentPaySumTotal,
  mergeEmploymentTypePayIntoCompanySettings,
  normalizeEmploymentTypePaySettings,
  readEmploymentTypePayFromCompanySettings,
  resolveEmploymentTypePayConfig,
} from '../utils/employmentTypePaySettings';

const MONTH_NAMES_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
] as const;

/** 「급여 명세서 발송」페이지 기본 메일과 동일 (영문 전용) */
const DEFAULT_PAYSLIP_MAIL_SUBJECT = '[{{company}}] {{month}} Payslip Attached ({{name}})';
const DEFAULT_PAYSLIP_MAIL_BODY =
  'Dear {{name}},\n\nI hope you are doing well.\n\nPlease find attached your payslip for {{month}} {{year}} for your reference.\nKindly review it at your convenience, and please feel free to contact us if you have any questions or require further clarification.\nThank you for your continued dedication and contribution to the company.\nBest regards,\n{{company}}';

function shortCompanyNameForMail(name?: string | null): string {
  return String(name || '')
    .replace(/\bprivate\s+limited\b\.?/gi, '')
    .replace(/\bpvt\.?\s*ltd\.?\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[,\s]+$/g, '')
    .trim();
}

function fillPayslipMailTemplate(
  template: string,
  vars: { name: string; company: string; period: string }
): string {
  const period = String(vars.period || '').trim();
  const ym = period.match(/^(20\d{2})-(\d{1,2})$/);
  const year = ym ? ym[1] : period.match(/^(20\d{2})/)?.[1] || '';
  const monthLabel = ym
    ? MONTH_NAMES_EN[Math.max(0, Number(ym[2]) - 1)] || period
    : period;
  return template
    .replace(/\{\{name\}\}/g, vars.name || '')
    .replace(/\{\{month\}\}/g, monthLabel)
    .replace(/\{\{year\}\}/g, year)
    .replace(/\{\{company\}\}/g, vars.company || '');
}

const PAYROLL_MUTABLE_FIELDS = [
  'employee_id',
  'payroll_period',
  'basic_salary',
  'overtime_pay',
  'bonus',
  'allowances',
  'deductions',
  'gross_salary',
  'net_salary',
  'tax_amount',
  'status',
  'payment_date',
  'extra_fields'
] as const;

function pickPayrollBody(body: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of PAYROLL_MUTABLE_FIELDS) {
    if (body[k] !== undefined) o[k] = body[k];
  }
  return o;
}

/** 급여 조회 스코프 — 기본은 로그인 회사, root만 query/body company_id로 전환 */
function resolvePayrollScope(req: RequestWithUser) {
  const tenantId = req.user?.tenant_id;
  const companyId = req.user?.company_id;
  const userRole = req.user?.role;
  const queryCompanyId = req.query.company_id
    ? parseInt(String(req.query.company_id), 10)
    : undefined;
  const bodyCompanyId = (req.body as Record<string, unknown> | undefined)?.company_id
    ? parseInt(String((req.body as Record<string, unknown>).company_id), 10)
    : undefined;

  // 일반·admin: 항상 로그인 회사. root/audit는 선택 회사로 전환(조회).
  let effectiveCompanyId = companyId;
  if (userRole === 'root' || userRole === 'audit') {
    const requested = queryCompanyId || bodyCompanyId;
    if (requested != null && Number.isFinite(requested) && requested > 0) {
      effectiveCompanyId = requested;
    }
  }

  return { tenantId, companyId: effectiveCompanyId, userRole };
}

/** 급여 생성·확정 등 회사 필수 작업용. 실패 시 응답을 보내고 null 반환 */
function requirePayrollCompanyScope(
  req: RequestWithUser,
  res: Response
): { tenant_id: number; company_id: number; user_id: number; userRole: string | undefined } | null {
  const { tenantId, companyId, userRole } = resolvePayrollScope(req);
  const user_id = req.user?.id;
  if (tenantId == null) {
    res.status(400).json({ success: false, message: '테넌트 정보가 없습니다.' });
    return null;
  }
  if (companyId == null) {
    res.status(400).json({
      success: false,
      message:
        userRole === 'root'
          ? '급여를 처리할 회사를 선택해 주세요.'
          : '회사 정보가 없습니다.'
    });
    return null;
  }
  if (user_id == null) {
    res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    return null;
  }
  return { tenant_id: tenantId, company_id: companyId, user_id, userRole };
}

async function isPayrollPeriodLocked(
  tenantId: number,
  companyId: number,
  payrollPeriod: string
): Promise<boolean> {
  const norm = normalizePayrollPeriodInput(payrollPeriod);
  if (!norm) return false;
  const row = await (PayrollPeriodLock as any).findOne({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      [Op.or]: [
        { payroll_period: norm },
        { payroll_period: { [Op.like]: `${norm}-%` } }
      ]
    }
  });
  return !!row;
}

async function assertPayrollPeriodEditable(
  req: RequestWithUser,
  tenantId: number,
  companyId: number,
  payrollPeriod: string,
  res: Response
): Promise<boolean> {
  if (req.user?.role === 'root') return true;
  const locked = await isPayrollPeriodLocked(tenantId, companyId, payrollPeriod);
  if (locked) {
    res.status(403).json({
      success: false,
      message: '해당 급여 월은 확정되어 수정할 수 없습니다.'
    });
    return false;
  }
  return true;
}

// 급여 목록 조회
export const getPayrolls = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId: effectiveCompanyId, userRole } = resolvePayrollScope(req);
    const { page = 1, limit = 10, employee_id = '', period = '' } = req.query;

    if (effectiveCompanyId == null) {
      return res.status(400).json({
        success: false,
        message:
          userRole === 'root' ? '급여를 조회할 회사를 선택해 주세요.' : '회사 정보가 없습니다.'
      });
    }

    const whereClause: any = { is_active: true };
    if (tenantId != null) whereClause.tenant_id = tenantId;
    whereClause.company_id = effectiveCompanyId;
    
    if (employee_id) {
      whereClause.employee_id = employee_id;
    }
    
    if (period) {
      whereClause.payroll_period = period;
    }

    const payrolls = await (Payroll as any).findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'employee',
          attributes: [
            'id',
            'username',
            'email',
            'department',
            'position',
            'employee_number',
            'birth_date',
            'hire_date',
            'employment_type',
            'ot_eligible',
            'pt_eligible',
            'pf_calc_mode'
          ]
        }
      ],
      limit: Number(limit),
      offset: (Number(page) - 1) * Number(limit),
      order: [['payroll_period', 'DESC'], ['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: payrolls.rows,
      pagination: {
        total: payrolls.count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(payrolls.count / Number(limit))
      }
    });
  } catch (error) {
    console.error('급여 목록 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 급여 상세 조회
export const getPayroll = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const { tenantId, companyId: effectiveCompanyId, userRole } = resolvePayrollScope(req);

    if (effectiveCompanyId == null) {
      return res.status(400).json({
        success: false,
        message:
          userRole === 'root' ? '급여를 조회할 회사를 선택해 주세요.' : '회사 정보가 없습니다.'
      });
    }

    const whereClause: any = { id, is_active: true };
    if (tenantId != null) whereClause.tenant_id = tenantId;
    whereClause.company_id = effectiveCompanyId;

    const payroll = await (Payroll as any).findOne({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'employee',
          attributes: [
            'id',
            'username',
            'email',
            'department',
            'position',
            'employee_number',
            'birth_date',
            'hire_date',
            'employment_type',
            'ot_eligible',
            'pt_eligible',
            'pf_calc_mode'
          ]
        }
      ]
    });

    if (!payroll) {
      return res.status(404).json({ success: false, message: '급여 정보를 찾을 수 없습니다.' });
    }

    res.json({ success: true, data: payroll });
  } catch (error) {
    console.error('급여 상세 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 급여 생성
export const createPayroll = async (req: RequestWithUser, res: Response) => {
  try {
    const scope = requirePayrollCompanyScope(req, res);
    if (!scope) return;
    const { tenant_id, company_id, user_id } = scope;
    const picked = pickPayrollBody(req.body as Record<string, unknown>);
    const period = String((picked as any).payroll_period ?? '').trim();
    if (!period) {
      return res.status(400).json({ success: false, message: '급여 기간(payroll_period)이 필요합니다.' });
    }
    const periodNorm = normalizePayrollPeriodInput(period);
    if (periodNorm && isPayrollPeriodAfterCurrentMonth(periodNorm)) {
      return res.status(400).json({
        success: false,
        message: '아직 도래하지 않은 급여 월은 생성할 수 없습니다.'
      });
    }
    if (!(await assertPayrollPeriodEditable(req, tenant_id, company_id, period, res))) return;

    const payrollData = { ...picked, tenant_id, company_id, created_by: user_id, is_active: true };

    const payroll = await (Payroll as any).create(payrollData);

    res.status(201).json({ success: true, data: payroll });
  } catch (error) {
    console.error('급여 생성 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

/** 현재 로그인 회사의 활성 사용자 기준으로 급여 행 일괄 생성.
 *  확정(잠금)된 월은 root 포함 일괄 생성 불가.
 *  미확정 월에 활성 급여가 있으면 soft-delete(is_active=false) 후 재생성.
 *  전자근로계약(해당 월 유효·서명/활성)의 기본급·상여 유형을 우선 반영하고, 근태(해당 월)로 근무일·연장시간을 채웁니다. */
export const bulkGeneratePayrolls = async (req: RequestWithUser, res: Response) => {
  try {
    const scope = requirePayrollCompanyScope(req, res);
    if (!scope) return;
    const { tenant_id, company_id, user_id } = scope;
    const payroll_period = normalizePayrollPeriodInput(String(req.body?.payroll_period || '').trim());
    if (!payroll_period) {
      return res.status(400).json({
        success: false,
        message: '급여 기간(payroll_period)이 필요하며 YYYY-MM 형식이어야 합니다.'
      });
    }

    const bounds = parsePayrollPeriod(payroll_period);
    if (!bounds) {
      return res.status(400).json({
        success: false,
        message: '급여 기간은 YYYY-MM 형식이어야 합니다.'
      });
    }

    if (isPayrollPeriodAfterCurrentMonth(payroll_period)) {
      return res.status(400).json({
        success: false,
        message: '아직 도래하지 않은 급여 월은 생성할 수 없습니다.'
      });
    }

    if (await isPayrollPeriodLocked(tenant_id, company_id, payroll_period)) {
      return res.status(403).json({
        success: false,
        message: '해당 급여 월은 확정되어 일괄 생성할 수 없습니다.'
      });
    }

    const companyForPay = await (Company as any).findOne({
      where: { id: company_id, tenant_id },
    });
    const companyPaySettings = companyForPay?.settings;

    /** HeresNow 연동 ON이면 일괄 생성 직전 근태를 당겨 일용직 근무일에 반영 */
    let heresnow_sync: {
      attempted: boolean;
      ok: boolean;
      applied?: number;
      total?: number;
      message?: string;
    } = { attempted: false, ok: false };
    if (companyForPay && getHeresnowSettings(companyForPay).enabled) {
      heresnow_sync.attempted = true;
      try {
        const syncResult = await pullHeresnowAttendance(companyForPay, {
          since: `${payroll_period}-01`,
        });
        heresnow_sync = {
          attempted: true,
          ok: true,
          applied: syncResult.applied,
          total: syncResult.total,
        };
      } catch (syncErr: any) {
        const msg = String(syncErr?.message || syncErr || 'HERESNOW_SYNC_FAILED');
        console.warn('[bulkGeneratePayrolls] HeresNow sync skipped:', msg);
        heresnow_sync = { attempted: true, ok: false, message: msg };
      }
    }

    // 미확정 월 재생성: 기존 활성 급여는 soft-delete 후 새로 생성
    const { created, deactivatedCount } = await sequelize.transaction(async (transaction) => {
      const [deactivated] = await (Payroll as any).update(
        { is_active: false },
        {
          where: {
            tenant_id,
            company_id,
            is_active: true,
            ...sameMonthPayrollPeriodWhere(payroll_period)
          },
          transaction
        }
      );

      const employees = await (User as any).findAll({
        where: { tenant_id, company_id, status: 'active' },
        attributes: [
          'id',
          'username',
          'department',
          'position',
          'birth_date',
          'hire_date',
          'salary',
          'bank_name',
          'bank_account',
          'bank_ifsc',
          'employment_type',
          'employee_number',
          'ot_eligible',
          'pt_eligible',
          'pf_calc_mode'
        ],
        transaction
      });

      let createdCount = 0;
      const registeredStateCode = await resolveCompanyRegisteredStateCode(company_id, {
        Company,
        CompanyGstNumber
      });
      const esiEmployeeCount = employees.length;

      for (const emp of employees) {
        const contract = await findEffectiveEmploymentContract(tenant_id, company_id, emp.id, bounds);
        const profileSalary = parseFloat(String(emp.salary ?? 0)) || 0;
        const contractSalary =
          contract && contract.salary != null ? parseFloat(String(contract.salary)) || 0 : 0;
        const payCfg = resolveEmploymentTypePayConfig(
          companyPaySettings,
          (emp as any).employment_type
        );
        const isDaily = payCfg.salaryBasis === 'daily';
        const isFixedRest = payCfg.salaryBasis === 'fixed_rest_monthly';
        // 일용직 급여 필드는 일당. 계약 월급으로 덮어쓰지 않는다.
        const useContractSalary = !isDaily && Boolean(contract) && contractSalary > 0;
        const basic_salary = useContractSalary ? contractSalary : profileSalary;

        /** 일당 기준: 상여·연장 산정용 월 환산 = 일당 × 해당월 일수 */
        const monthlyEquivForDaily = basic_salary * bounds.daysInMonth;

        const att = await aggregateAttendanceForPeriod(tenant_id, company_id, emp.id, bounds);
        const rawOtEligible = (emp as any).ot_eligible ?? (emp as any).get?.('ot_eligible');
        const otEligible =
          rawOtEligible === true ||
          rawOtEligible === 1 ||
          rawOtEligible === '1' ||
          rawOtEligible === 'true';
        const rawPtEligible = (emp as any).pt_eligible ?? (emp as any).get?.('pt_eligible');
        const ptEligible =
          rawPtEligible !== false &&
          rawPtEligible !== 0 &&
          rawPtEligible !== '0' &&
          rawPtEligible !== 'false';
        const dayOtHours = otEligible ? att.dayOtHours : 0;
        const nightOtHours = otEligible ? att.nightOtHours : 0;
        const overtimeHoursForPay = otEligible ? att.overtimeHours : 0;

        const bonus =
          isDaily && att.recordCount === 0
            ? 0
            : computeBonusFromContract(
                isDaily ? monthlyEquivForDaily : basic_salary,
                contract && typeof (contract as any).toJSON === 'function'
                  ? (contract as any).toJSON()
                  : contract
              );
        const overtime_pay = computeOvertimePay(
          isDaily ? monthlyEquivForDaily : basic_salary,
          overtimeHoursForPay
        );

        const unpaidForCompute =
          payCfg.salaryBasis === 'daily' && att.recordCount === 0
            ? bounds.daysInMonth
            : att.absentDays;
        const pr = computeEmploymentPaySumTotal(
          payCfg,
          basic_salary,
          overtime_pay,
          bonus,
          bounds.daysInMonth,
          att.daysWorked,
          att.recordCount,
          unpaidForCompute
        );
        const gross_salary = pr.sumTotal;

        const bodyOpts = (req.body || {}) as Record<string, unknown>;
        const statutoryApplicable = bodyOpts.statutory_india !== false;
        const rawPfCalc =
          (emp as any).pf_calc_mode ??
          (emp as any).get?.('pf_calc_mode') ??
          (emp as any).pf_cap_1800 ??
          (emp as any).get?.('pf_cap_1800') ??
          bodyOpts.pf_calc_mode ??
          bodyOpts.pf_cap_1800;
        const pfCalcMode = normalizeUserPfCalcMode(rawPfCalc);
        const estimateTds = bodyOpts.estimate_tds !== false;
        const pfMode: PfMode =
          bodyOpts.pf_mode === 'gross_6pct'
            ? 'gross_6pct'
            : bodyOpts.pf_mode === 'epf_12pct_half'
              ? 'epf_12pct_half'
              : 'basic_12pct';

        const packageForPf = isDaily ? monthlyEquivForDaily : basic_salary;
        const stat = computeIndianStatutoryPayroll(gross_salary, {
          statutoryApplicable,
          pfMode,
          pfCalcMode,
          pfCapAt1800: pfCalcMode === 'cap_1800',
          estimateTds,
          basicSalary: packageForPf,
          totalSalary: packageForPf,
          registeredStateCode,
          payrollMonth: payroll_period,
          ptEligible,
          esiEmployeeCount,
        });
        const statExtra = breakdownToExtraFields(stat);

        const birth = emp.birth_date ? String(emp.birth_date).split('T')[0] : '';
        const hire = emp.hire_date ? String(emp.hire_date).split('T')[0] : '';

        const bankAccount = emp.bank_account != null ? String(emp.bank_account).trim() : '';
        const bankIfsc = emp.bank_ifsc != null ? String(emp.bank_ifsc).trim() : '';
        const bankName = emp.bank_name != null ? String(emp.bank_name).trim() : '';

        /** 정규·서비스: 무급=결근 등. 일용직: 근무일=근태 실근무, 무급=월총일−근무일. */
        const unpaidForNonDaily =
          pr.unpaidLeave != null
            ? pr.unpaidLeave
            : att.absentDays;
        const daysWorkedVal = isFixedRest
          ? Math.max(0, bounds.daysInMonth - unpaidForNonDaily)
          : pr.effectiveDaysWorked;
        const unpaidLeaveVal = isDaily
          ? Math.max(0, bounds.daysInMonth - daysWorkedVal)
          : unpaidForNonDaily;

        const extra_fields = {
          emp_id: String((emp as any).employee_number || '').trim(),
          bank_account: bankAccount,
          ifsc: bankIfsc,
          bank_name: bankName,
          department: emp.department || '',
          employee_name: emp.username || '',
          position: emp.position || '',
          birth_date: birth,
          joining_date: hire,
          working_month: payroll_period,
          total_day_of_month: String(bounds.daysInMonth),
          unpaid_leave: String(unpaidLeaveVal),
          days_worked: String(daysWorkedVal),
          prorated_basic: String(pr.proratedBasic),
          ...(isFixedRest
            ? {
                fixed_rest_days: String(pr.fixedRestDays ?? payCfg.fixedRestDays),
                extra_working_days: String(pr.extraWorkingDays ?? 0),
                rest_day_extra_pay: String(pr.restDayExtraPay ?? 0),
                pay_days: String(pr.payDays ?? daysWorkedVal),
              }
            : {}),
          ...statExtra,
          account_cash: '',
          ...(isDaily ? { daily_wage: String(basic_salary) } : {}),
          salary_source: isDaily
            ? 'daily_wage'
            : isFixedRest
              ? 'fixed_rest_monthly'
              : useContractSalary
                ? 'employment_contract'
                : 'user_profile',
          employment_type: String((emp as any).employment_type || ''),
          employment_salary_basis: payCfg.salaryBasis,
          employment_no_attendance: payCfg.noAttendance,
          employment_prorate: String(payCfg.prorateByAttendance),
          employment_contract_id: contract ? contract.id : null,
          working_days_contract: contract?.working_days ?? '',
          attendance_records: String(att.recordCount),
          attendance_overtime_hours: String(overtimeHoursForPay),
          attendance_day_ot_hours: String(dayOtHours),
          attendance_night_ot_hours: String(nightOtHours),
          attendance_holiday_work_hours: String(att.holidayWorkHours),
          attendance_late_hours_deducted: String(att.lateHoursDeducted ?? 0),
          day_ot_hour: String(dayOtHours),
          night_ot_hour: String(nightOtHours),
          ot_eligible: String(otEligible),
          pt_eligible: String(ptEligible),
          pf_calc_mode: pfCalcMode,
          indian_pf_mode: statutoryApplicable ? pfMode : '',
          indian_statutory_version: 'sheet_ref_6pct_prorate_v2'
        };

        await (Payroll as any).create(
          {
            tenant_id,
            company_id,
            employee_id: emp.id,
            payroll_period,
            basic_salary,
            overtime_pay,
            bonus,
            allowances: 0,
            deductions: 0,
            gross_salary,
            net_salary: stat.net_payable,
            tax_amount: stat.tds,
            status: 'pending',
            created_by: user_id,
            is_active: true,
            extra_fields
          },
          { transaction }
        );
        createdCount += 1;
      }

      return { created: createdCount, deactivatedCount: Number(deactivated) || 0 };
    });

    const syncNote =
      heresnow_sync.attempted && heresnow_sync.ok
        ? ` HeresNow 근태 ${heresnow_sync.applied ?? 0}건을 반영했습니다.`
        : heresnow_sync.attempted && !heresnow_sync.ok
          ? ' HeresNow 동기화는 실패해 기존 근태로 생성했습니다.'
          : '';
    res.status(201).json({
      success: true,
      message:
        deactivatedCount > 0
          ? `기존 ${deactivatedCount}건을 비활성화한 뒤 급여 ${created}건을 다시 생성했습니다. 전자근로계약·근태를 반영했습니다.${syncNote}`
          : `급여 ${created}건이 생성되었습니다. 전자근로계약·근태를 반영했습니다.${syncNote}`,
      data: { created, replaced: deactivatedCount, heresnow_sync }
    });
  } catch (error) {
    console.error('급여 일괄 생성 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

/** 일괄 생성 전: 확정·중복 여부와 직원별 해당 월 출퇴근 건수 요약 */
export const previewBulkPayrollGeneration = async (req: RequestWithUser, res: Response) => {
  try {
    const scope = requirePayrollCompanyScope(req, res);
    if (!scope) return;
    const { tenant_id, company_id } = scope;
    const payroll_period = normalizePayrollPeriodInput(String(req.body?.payroll_period || '').trim());
    if (!payroll_period) {
      return res.status(400).json({
        success: false,
        message: '급여 기간(payroll_period)이 필요하며 YYYY-MM 형식이어야 합니다.'
      });
    }
    const bounds = parsePayrollPeriod(payroll_period);
    if (!bounds) {
      return res.status(400).json({
        success: false,
        message: '급여 기간은 YYYY-MM 형식이어야 합니다.'
      });
    }

    if (isPayrollPeriodAfterCurrentMonth(payroll_period)) {
      return res.status(400).json({
        success: false,
        message: '아직 도래하지 않은 급여 월은 생성할 수 없습니다.'
      });
    }

    if (await isPayrollPeriodLocked(tenant_id, company_id, payroll_period)) {
      return res.status(403).json({
        success: false,
        message: '해당 급여 월은 확정되어 일괄 생성할 수 없습니다.'
      });
    }

    const existingActive = await (Payroll as any).count({
      where: {
        tenant_id,
        company_id,
        is_active: true,
        ...sameMonthPayrollPeriodWhere(payroll_period)
      }
    });

    const employees = await (User as any).findAll({
      where: { tenant_id, company_id, status: 'active' },
      attributes: ['id', 'username', 'employment_type']
    });

    const previewCompany = await (Company as any).findOne({
      where: { id: company_id, tenant_id },
    });

    let heresnow_sync: {
      attempted: boolean;
      ok: boolean;
      applied?: number;
      total?: number;
      message?: string;
    } = { attempted: false, ok: false };
    if (previewCompany && getHeresnowSettings(previewCompany).enabled) {
      heresnow_sync.attempted = true;
      try {
        const syncResult = await pullHeresnowAttendance(previewCompany, {
          since: `${payroll_period}-01`,
        });
        heresnow_sync = {
          attempted: true,
          ok: true,
          applied: syncResult.applied,
          total: syncResult.total,
        };
      } catch (syncErr: any) {
        heresnow_sync = {
          attempted: true,
          ok: false,
          message: String(syncErr?.message || syncErr || 'HERESNOW_SYNC_FAILED'),
        };
      }
    }

    let with_attendance = 0;
    let without_attendance = 0;
    const without_attendance_usernames: string[] = [];
    const daily_without_records: { id: number; username: string }[] = [];

    for (const emp of employees) {
      const att = await aggregateAttendanceForPeriod(tenant_id, company_id, emp.id, bounds);
      const name = String((emp as any).username || '').trim() || `user#${(emp as any).id}`;
      const payCfg = resolveEmploymentTypePayConfig(
        previewCompany?.settings,
        (emp as any).employment_type
      );
      const isDailyZeroWithoutAtt =
        payCfg.salaryBasis === 'daily' && payCfg.noAttendance === 'zero';
      if (att.recordCount > 0) {
        with_attendance += 1;
      } else {
        without_attendance += 1;
        if (without_attendance_usernames.length < 25) {
          without_attendance_usernames.push(name);
        }
        if (isDailyZeroWithoutAtt && daily_without_records.length < 80) {
          daily_without_records.push({ id: (emp as any).id, username: name });
        }
      }
    }

    res.json({
      success: true,
      data: {
        payroll_period,
        can_generate: true,
        block_reason: null,
        will_replace: existingActive > 0,
        existing_active_count: existingActive,
        employee_total: employees.length,
        heresnow_sync,
        attendance: {
          with_attendance,
          without_attendance,
          without_attendance_usernames,
          daily_without_records
        }
      }
    });
  } catch (error) {
    console.error('급여 일괄 생성 미리보기 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 급여 수정
export const updatePayroll = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const scope = requirePayrollCompanyScope(req, res);
    if (!scope) return;
    const { tenant_id, company_id } = scope;

    const payroll = await (Payroll as any).findOne({
      where: { id, tenant_id, company_id, is_active: true }
    });

    if (!payroll) {
      return res.status(404).json({ success: false, message: '급여 정보를 찾을 수 없습니다.' });
    }

    const picked = pickPayrollBody(req.body as Record<string, unknown>);
    if (
      picked.extra_fields &&
      typeof picked.extra_fields === 'object' &&
      !Array.isArray(picked.extra_fields)
    ) {
      picked.extra_fields = picked.extra_fields as Record<string, unknown>;
    }

    const oldPeriod = String(payroll.payroll_period);
    const newPeriod =
      picked.payroll_period !== undefined ? String(picked.payroll_period).trim() : oldPeriod;
    if (!(await assertPayrollPeriodEditable(req, tenant_id, company_id, oldPeriod, res))) return;
    if (
      newPeriod !== oldPeriod &&
      !(await assertPayrollPeriodEditable(req, tenant_id, company_id, newPeriod, res))
    ) {
      return;
    }

    await payroll.update(picked);

    res.json({ success: true, data: payroll });
  } catch (error) {
    console.error('급여 수정 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 급여 삭제
export const deletePayroll = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const scope = requirePayrollCompanyScope(req, res);
    if (!scope) return;
    const { tenant_id, company_id } = scope;

    const payroll = await (Payroll as any).findOne({
      where: { id, tenant_id, company_id }
    });

    if (!payroll) {
      return res.status(404).json({ success: false, message: '급여 정보를 찾을 수 없습니다.' });
    }

    if (!(await assertPayrollPeriodEditable(req, tenant_id, company_id, String(payroll.payroll_period), res)))
      return;

    // 소프트 삭제: is_active를 false로 설정
    await payroll.update({ is_active: false });

    res.json({ success: true, message: '급여 정보가 비활성화되었습니다.' });
  } catch (error) {
    console.error('급여 삭제 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 급여 승인
export const approvePayroll = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const scope = requirePayrollCompanyScope(req, res);
    if (!scope) return;
    const { tenant_id, company_id } = scope;

    const payroll = await (Payroll as any).findOne({
      where: { id, tenant_id, company_id }
    });

    if (!payroll) {
      return res.status(404).json({ success: false, message: '급여 정보를 찾을 수 없습니다.' });
    }

    if (!(await assertPayrollPeriodEditable(req, tenant_id, company_id, String(payroll.payroll_period), res)))
      return;

    await payroll.update({ status: 'approved' });

    res.json({ success: true, data: payroll });
  } catch (error) {
    console.error('급여 승인 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 급여 지급
export const payPayroll = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const scope = requirePayrollCompanyScope(req, res);
    if (!scope) return;
    const { tenant_id, company_id } = scope;

    const payroll = await (Payroll as any).findOne({
      where: { id, tenant_id, company_id }
    });

    if (!payroll) {
      return res.status(404).json({ success: false, message: '급여 정보를 찾을 수 없습니다.' });
    }

    if (!(await assertPayrollPeriodEditable(req, tenant_id, company_id, String(payroll.payroll_period), res)))
      return;

    await payroll.update({ 
      status: 'paid',
      payment_date: new Date().toISOString().split('T')[0]
    });

    res.json({ success: true, data: payroll });
  } catch (error) {
    console.error('급여 지급 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

/** 회사별 확정(잠금)된 급여 근무월 목록 */
export const getPayrollPeriodLocks = async (req: RequestWithUser, res: Response) => {
  try {
    const scope = requirePayrollCompanyScope(req, res);
    if (!scope) return;
    const { tenant_id, company_id } = scope;
    const rows = await (PayrollPeriodLock as any).findAll({
      where: { tenant_id, company_id },
      attributes: ['payroll_period', 'locked_at'],
      order: [['payroll_period', 'DESC']]
    });
    res.json({
      success: true,
      data: { locked_periods: rows.map((r: { payroll_period: string }) => r.payroll_period) }
    });
  } catch (error) {
    console.error('급여 월 잠금 목록 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

function payrollApprovalDocumentId(companyId: number, period: string): string {
  return `PAYROLL-${companyId}-${period}`;
}

async function ensurePayrollApprovalType(tenantId: number, companyId: number) {
  const def = DEFAULT_APPROVAL_TYPES.find((d) => d.code === 'payroll');
  if (!def) return;
  const existing = await (ApprovalType as any).findOne({
    where: { tenant_id: tenantId, company_id: companyId, code: 'payroll' },
  });
  if (!existing) {
    await (ApprovalType as any).create({
      tenant_id: tenantId,
      company_id: companyId,
      code: def.code,
      name: def.name,
      sort_order: def.sort_order,
      is_system: true,
      is_active: true,
    });
    return;
  }
  if (!existing.is_active || !existing.is_system) {
    await existing.update({ is_active: true, is_system: true });
  }
}

async function findPayrollPeriodApproval(tenantId: number, companyId: number, period: string) {
  const documentId = payrollApprovalDocumentId(companyId, period);
  return (Approval as any).findOne({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      document_id: documentId,
      is_active: true,
    },
    include: [
      {
        model: User,
        as: 'requester',
        attributes: ['id', 'username', 'email', 'department', 'position'],
        required: false,
      },
      {
        model: User,
        as: 'currentApprover',
        attributes: ['id', 'username'],
        required: false,
      },
    ],
  });
}

/** 급여월 결재 상태 조회 */
export const getPayrollPeriodApproval = async (req: RequestWithUser, res: Response) => {
  try {
    const payroll_period = normalizePayrollPeriodInput(String(req.query?.payroll_period || '').trim());
    if (!payroll_period || !parsePayrollPeriod(payroll_period)) {
      return res.status(400).json({
        success: false,
        message: '급여 기간은 YYYY-MM 형식이어야 합니다.',
      });
    }
    const scope = requirePayrollCompanyScope(req, res);
    if (!scope) return;
    const { tenant_id, company_id } = scope;
    const approval = await findPayrollPeriodApproval(tenant_id, company_id, payroll_period);
    const locked = await isPayrollPeriodLocked(tenant_id, company_id, payroll_period);
    res.json({
      success: true,
      data: {
        payroll_period,
        document_id: payrollApprovalDocumentId(company_id, payroll_period),
        locked,
        approval: approval
          ? {
              id: approval.id,
              status: approval.status,
              title: approval.title,
              requester_id: approval.requester_id,
              current_approver_id: approval.current_approver_id,
              requester: approval.requester || null,
              currentApprover: approval.currentApprover || null,
              amount: approval.amount != null ? Number(approval.amount) : null,
              updated_at: approval.updated_at,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('급여 월 결재 상태 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

/** 급여월 결재 요청 (전자결재 제출) — 급여 생성 완료 전 필수 */
export const requestPayrollPeriodApproval = async (req: RequestWithUser, res: Response) => {
  try {
    const payroll_period = normalizePayrollPeriodInput(String(req.body?.payroll_period || '').trim());
    const approverId = Number(req.body?.approver_id);
    if (!payroll_period || !parsePayrollPeriod(payroll_period)) {
      return res.status(400).json({
        success: false,
        message: '급여 기간은 YYYY-MM 형식이어야 합니다.',
      });
    }
    if (!Number.isFinite(approverId) || approverId <= 0) {
      return res.status(400).json({ success: false, message: '승인자를 선택해주세요.' });
    }
    if (isPayrollPeriodAfterCurrentMonth(payroll_period)) {
      return res.status(400).json({
        success: false,
        message: '아직 도래하지 않은 급여 월은 결재 요청할 수 없습니다.',
      });
    }
    const scope = requirePayrollCompanyScope(req, res);
    if (!scope) return;
    const { tenant_id, company_id, user_id } = scope;

    if (Number(approverId) === Number(user_id)) {
      return res.status(400).json({
        success: false,
        message: '본인을 승인자로 지정할 수 없습니다.',
      });
    }

    if (await isPayrollPeriodLocked(tenant_id, company_id, payroll_period)) {
      return res.status(400).json({
        success: false,
        message: '이미 확정된 급여 월입니다.',
      });
    }

    const payrollCount = await (Payroll as any).count({
      where: {
        tenant_id,
        company_id,
        is_active: true,
        ...sameMonthPayrollPeriodWhere(payroll_period),
      },
    });
    if (!(payrollCount > 0)) {
      return res.status(400).json({
        success: false,
        message: '해당 급여월에 생성된 급여가 없습니다. 먼저 급여를 생성하세요.',
      });
    }

    const totalNet =
      (await (Payroll as any).sum('net_salary', {
        where: {
          tenant_id,
          company_id,
          is_active: true,
          ...sameMonthPayrollPeriodWhere(payroll_period),
        },
      })) || 0;

    const approver = await (User as any).findOne({
      where: {
        id: approverId,
        tenant_id,
        company_id,
        status: 'active',
      },
      attributes: ['id', 'username', 'department', 'position', 'email'],
    });
    if (!approver) {
      return res.status(400).json({
        success: false,
        message: '선택한 승인자를 찾을 수 없습니다.',
      });
    }

    await ensurePayrollApprovalType(tenant_id, company_id);

    const documentId = payrollApprovalDocumentId(company_id, payroll_period);
    const existing = await findPayrollPeriodApproval(tenant_id, company_id, payroll_period);
    if (existing && String(existing.status) === 'approved') {
      return res.status(400).json({
        success: false,
        message: '이미 결재 완료된 급여 월입니다.',
        data: { approval_id: existing.id, status: existing.status },
      });
    }
    if (existing && ['submitted', 'in_review'].includes(String(existing.status))) {
      return res.status(400).json({
        success: false,
        message: '이미 결재 진행 중인 급여 월입니다.',
        data: { approval_id: existing.id, status: existing.status },
      });
    }

    const title = `급여 확정 결재 (${payroll_period})`;
    const description = [
      `급여월: ${payroll_period}`,
      `대상 인원: ${payrollCount}명`,
      `실수령액 합계: INR ${Math.floor(Number(totalNet) || 0).toLocaleString('en-IN')}`,
      '',
      '급여 생성 완료(확정) 전 승인 요청입니다.',
      '첨부: 급여 리스트 엑셀',
    ].join('\n');

    const excelAttachment = await buildAndStorePayrollListExcelAttachment({
      tenantId: tenant_id,
      companyId: company_id,
      payrollPeriod: payroll_period,
    });
    const attachments = excelAttachment ? [excelAttachment] : null;

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

    let approval: any;
    if (existing) {
      await existing.update({
        title,
        type: 'payroll',
        category: 'payroll',
        amount: Math.floor(Number(totalNet) || 0),
        requester_id: user_id,
        description,
        attachments,
        status: 'submitted',
        priority: 'high',
        current_approver_id: Number(approver.id),
        approval_flow: approvalFlow,
        is_active: true,
      });
      approval = existing;
    } else {
      approval = await (Approval as any).create({
        tenant_id,
        company_id,
        document_id: documentId,
        title,
        type: 'payroll',
        category: 'payroll',
        amount: Math.floor(Number(totalNet) || 0),
        requester_id: user_id,
        description,
        attachments,
        status: 'submitted',
        priority: 'high',
        current_approver_id: Number(approver.id),
        approval_flow: approvalFlow,
        due_date: null,
        is_active: true,
      });
    }

    const socketService = (req as any).socketService as SocketService | undefined;
    const requesterName = req.user?.username || '요청자';
    pushNotification(
      {
        title: '급여 확정 결재 요청',
        message: `${requesterName}님이 "${title}" 결재를 요청했습니다.`,
        type: 'info',
        target_type: 'user',
        target_id: Number(approver.id),
        tenant_id,
        company_id,
        sender_user_id: user_id,
        data: {
          feature: 'approval',
          approval_id: approval.id,
          document_id: documentId,
          approval_title: title,
          href: '/work/approval',
        },
      },
      socketService
    );

    const refreshed = await findPayrollPeriodApproval(tenant_id, company_id, payroll_period);
    res.json({
      success: true,
      message: '급여 확정 결재를 요청했습니다.',
      data: {
        payroll_period,
        document_id: documentId,
        approval: refreshed
          ? {
              id: refreshed.id,
              status: refreshed.status,
              title: refreshed.title,
              requester_id: refreshed.requester_id,
              current_approver_id: refreshed.current_approver_id,
              requester: refreshed.requester || null,
              currentApprover: refreshed.currentApprover || null,
              amount: refreshed.amount != null ? Number(refreshed.amount) : null,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error('급여 월 결재 요청 오류:', error);
    if (error?.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: '이미 동일한 급여월 결재 문서가 있습니다.',
      });
    }
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

/** 선택한 근무월 급여 확정 — 결재 승인 후만 가능. 일반 사용자는 이후 해당 월 수정 불가 (root 제외) */
export const completePayrollPeriod = async (req: RequestWithUser, res: Response) => {
  try {
    const payroll_period = normalizePayrollPeriodInput(String(req.body?.payroll_period || '').trim());
    if (!payroll_period || !parsePayrollPeriod(payroll_period)) {
      return res.status(400).json({
        success: false,
        message: '급여 기간은 YYYY-MM 형식이어야 합니다.'
      });
    }
    if (isPayrollPeriodAfterCurrentMonth(payroll_period)) {
      return res.status(400).json({
        success: false,
        message: '아직 도래하지 않은 급여 월은 확정할 수 없습니다.'
      });
    }
    const scope = requirePayrollCompanyScope(req, res);
    if (!scope) return;
    const { tenant_id, company_id, user_id, userRole } = scope;

    if (userRole !== 'root') {
      const approval = await findPayrollPeriodApproval(tenant_id, company_id, payroll_period);
      if (!approval || String(approval.status) !== 'approved') {
        const status = approval ? String(approval.status) : 'none';
        return res.status(400).json({
          success: false,
          message:
            status === 'submitted' || status === 'in_review'
              ? '결재가 진행 중입니다. 승인 완료 후 급여 생성 완료를 진행하세요.'
              : '급여 생성 완료 전에 결재 승인이 필요합니다. 먼저 결재를 요청하세요.',
          data: {
            payroll_period,
            approval_status: status,
            approval_id: approval?.id ?? null,
          },
        });
      }
    }

    const [row, created] = await (PayrollPeriodLock as any).findOrCreate({
      where: { tenant_id, company_id, payroll_period },
      defaults: { locked_at: new Date(), locked_by: user_id }
    });
    res.json({
      success: true,
      message: created
        ? '해당 급여 월이 확정되었습니다. 일반 사용자는 더 이상 수정할 수 없습니다.'
        : '이미 확정된 급여 월입니다.',
      data: {
        payroll_period,
        locked_at: row.locked_at,
        created: !!created
      }
    });
  } catch (error) {
    console.error('급여 월 확정 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

/** 급여 행에서 실수령액 추정 — DB net이 수당 조각값으로 잘못된 경우 gross−공제로 복구 */
const parsePayrollExtraMoney = (raw: unknown): number => {
  const n = Number(String(raw ?? '').replace(/,/g, '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const resolvePayrollNetSalary = (payroll: any, preferredNet?: number | null): number | null => {
  if (preferredNet != null && Number.isFinite(Number(preferredNet))) {
    const n = Math.round(Number(preferredNet));
    if (n >= 0) return n;
  }
  const gross = Number(payroll?.gross_salary);
  const stored = Number(payroll?.net_salary);
  const extra =
    payroll?.extra_fields && typeof payroll.extra_fields === 'object'
      ? (payroll.extra_fields as Record<string, unknown>)
      : {};
  const pf = parsePayrollExtraMoney(extra.pf_employee);
  const esic = parsePayrollExtraMoney(extra.esic_employee);
  const pt = parsePayrollExtraMoney(extra.pt);
  const tds = Number(payroll?.tax_amount) || 0;
  const statutory = pf + esic + pt + tds;
  const deductField = Number(payroll?.deductions) || 0;
  // deductions 컬럼이 총공제면 그대로, 선공제(advance)만이면 statutory에 가산
  const totalDed =
    deductField >= statutory ? deductField : statutory + Math.max(0, deductField);
  if (Number.isFinite(gross) && gross > 0) {
    const recomputed = Math.round(gross - totalDed);
    if (recomputed > 0) {
      // 저장된 net이 총지급의 ~40% 미만이면 수당(HRA 등) 오저장으로 보고 재계산값 사용
      if (!Number.isFinite(stored) || stored < 0 || stored < gross * 0.4) {
        return recomputed;
      }
      return Math.round(stored);
    }
  }
  return Number.isFinite(stored) && stored >= 0 ? Math.round(stored) : null;
};

/** PDF 첨부 급여 명세서를 직원 이메일로 발송 (클라이언트 생성 PDF base64) */
export const sendPayrollPayslip = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    const pdf_base64 = String(req.body?.pdf_base64 || '');
    const scope = requirePayrollCompanyScope(req, res);
    if (!scope) return;
    const { tenant_id, company_id, user_id: senderId, userRole } = scope;

    if (!pdf_base64 || pdf_base64.length < 20) {
      return res.status(400).json({ success: false, message: 'PDF 데이터가 없습니다.' });
    }

    const companyWhere: any = { id: company_id };
    if (userRole !== 'root') {
      companyWhere.tenant_id = tenant_id;
    }
    const companyRow = await Company.findOne({
      where: companyWhere
    });

    const senderRow = await User.findOne({
      where:
        userRole === 'root'
          ? { id: senderId }
          : { id: senderId, tenant_id, company_id: req.user?.company_id },
      attributes: ['id', 'settings']
    });

    const mailOpts = getResolvedMailTransportOptions(companyRow, senderRow);
    if (!mailOpts) {
      return res.status(503).json({
        success: false,
        message:
          '메일 서버가 설정되지 않았습니다. 시스템 설정의 보내는 메일 서버를 입력하거나, 서버 환경변수(EMAIL_HOST, EMAIL_USER, EMAIL_PASS)를 설정하세요.'
      });
    }

    const payroll = await (Payroll as any).findOne({
      where: { id, tenant_id, company_id, is_active: true },
      include: [
        {
          model: User,
          as: 'employee',
          attributes: ['id', 'email', 'username', 'employee_number']
        }
      ]
    });

    if (!payroll) {
      return res.status(404).json({ success: false, message: '급여 정보를 찾을 수 없습니다.' });
    }

    const emp = (payroll as any).employee;
    const to = String(emp?.email || '').trim();
    if (!to) {
      return res.status(400).json({ success: false, message: '직원 이메일이 등록되어 있지 않습니다.' });
    }

    const b64 = pdf_base64.includes(',') ? pdf_base64.split(',')[1] : pdf_base64;
    const pdfBuffer = Buffer.from(b64, 'base64');
    const imageBase64Raw = String(req.body?.image_base64 || '').trim();
    const imageB64 = imageBase64Raw.includes(',')
      ? imageBase64Raw.split(',')[1]
      : imageBase64Raw;
    const imageBuffer =
      imageB64 && imageB64.length > 20 ? Buffer.from(imageB64, 'base64') : null;

    const transporter = nodemailer.createTransport(buildNodemailerTransportOptions(mailOpts));

    const period = String((payroll as any).payroll_period || '');
    const extra =
      (payroll as any).extra_fields && typeof (payroll as any).extra_fields === 'object'
        ? ((payroll as any).extra_fields as Record<string, unknown>)
        : {};
    const uname =
      String(extra.employee_name || '').trim() ||
      String(emp?.username || '').trim() ||
      'Employee';
    let empId =
      String(extra.emp_id || '').trim() ||
      String(emp?.employee_number || emp?.get?.('employee_number') || '').trim();
    if (!empId) {
      const empPk = Number(emp?.id || (payroll as any).employee_id);
      if (Number.isFinite(empPk) && empPk > 0) {
        const fresh = await (User as any).findByPk(empPk, {
          attributes: ['id', 'employee_number']
        });
        empId = String(fresh?.employee_number || fresh?.get?.('employee_number') || '').trim();
      }
    }
    const bodyNetRaw = req.body?.net_salary;
    const bodyNet =
      bodyNetRaw === undefined || bodyNetRaw === null || bodyNetRaw === ''
        ? null
        : Number(bodyNetRaw);
    const netSalary = resolvePayrollNetSalary(payroll, bodyNet);
    // 발송 시점에 DB net이 어긋나 있으면 급여 행도 맞춰 둔다
    if (
      netSalary != null &&
      Number.isFinite(netSalary) &&
      Math.round(Number((payroll as any).net_salary)) !== netSalary
    ) {
      try {
        await payroll.update({ net_salary: netSalary });
      } catch {
        /* 목록 보관이 우선 — payroll 갱신 실패는 무시 */
      }
    }
    const companyLabel = shortCompanyNameForMail((companyRow as any)?.name);
    const mailVars = { name: uname, company: companyLabel, period };
    const subject = fillPayslipMailTemplate(DEFAULT_PAYSLIP_MAIL_SUBJECT, mailVars);
    const bodyText = fillPayslipMailTemplate(DEFAULT_PAYSLIP_MAIL_BODY, mailVars);
    const bodyHtml = bodyText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />');
    const htmlBodyRaw = String(req.body?.html_body || '').trim();
    const htmlBody =
      htmlBodyRaw.length > 100 && htmlBodyRaw.length <= 1_500_000
        ? htmlBodyRaw
        : `
        <div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#111827;line-height:1.55;max-width:640px;">
          ${bodyHtml}
        </div>
      `;
    const safeFileBase = `Payslip (${period || 'Unknown'}) (${uname})`.replace(
      /[\\/:*?"<>|]/g,
      '_'
    );
    /** 메일: PNG(본문 인라인) + PDF 첨부. PDF는 내 명세서에도 보관 */
    const mailAttachments: Array<Record<string, unknown>> = [
      {
        filename: `${safeFileBase}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ];
    if (imageBuffer) {
      const isJpeg = imageBuffer.length > 2 && imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8;
      mailAttachments.unshift({
        filename: `${safeFileBase}.${isJpeg ? 'jpg' : 'png'}`,
        content: imageBuffer,
        contentType: isJpeg ? 'image/jpeg' : 'image/png',
        cid: 'payslip@mvs',
      });
    }

    await transporter.sendMail({
      from: mailOpts.from,
      to,
      subject,
      text: bodyText,
      html: htmlBody,
      attachments: mailAttachments
    });

    // 내 급여 명세서 목록 보관 (엑셀 발송 경로와 동일)
    const emailLower = to.toLowerCase();
    const recipientUserId =
      Number(emp?.id || (payroll as any).employee_id) > 0
        ? Number(emp?.id || (payroll as any).employee_id)
        : null;

    const dir = ensureUploadSubdir('payslips', String(tenant_id), String(company_id));
    const fileName = `payslip-${period || 'na'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
    const absPath = path.join(dir, fileName);
    await fs.promises.writeFile(absPath, pdfBuffer);
    if (pdfBuffer.length < 64 || pdfBuffer.subarray(0, 5).toString('utf8') !== '%PDF-') {
      try {
        await fs.promises.unlink(absPath);
      } catch {
        /* ignore */
      }
      return res.status(500).json({
        success: false,
        message: 'PDF 저장에 실패했습니다. 다시 발송해 주세요.'
      });
    }
    const pdfUrl = `/uploads/payslips/${tenant_id}/${company_id}/${fileName}`;

    const previousRows = await (PayslipDelivery as any).findAll({
      where: {
        tenant_id,
        company_id,
        payroll_period: period || '',
        is_active: true,
        [Op.and]: [
          Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('recipient_email')), emailLower)
        ]
      }
    });
    const oldPaths: string[] = [];
    for (const prev of previousRows) {
      const oldPath = String(prev.pdf_path || '');
      if (oldPath) oldPaths.push(oldPath);
      await prev.update({ is_active: false });
    }

    await (PayslipDelivery as any).create({
      tenant_id,
      company_id,
      user_id: recipientUserId,
      payroll_period: period || '',
      employee_name: uname,
      recipient_email: to,
      emp_id: empId || null,
      net_salary: Number.isFinite(netSalary as number) ? netSalary : null,
      pdf_path: absPath,
      pdf_url: pdfUrl,
      sent_by: senderId,
      sent_at: new Date(),
      is_active: true
    });

    for (const oldPath of oldPaths) {
      if (oldPath === absPath) continue;
      try {
        await fs.promises.unlink(oldPath);
      } catch {
        /* ignore */
      }
    }

    res.json({
      success: true,
      message: '메일을 발송했고, 내 급여 명세서에 저장했습니다.'
    });
  } catch (error) {
    console.error('급여 명세서 메일 오류:', error);
    res.status(500).json({ success: false, message: '메일 발송에 실패했습니다.' });
  }
};

/**
 * 엑셀 업로드 급여 리스트용 명세서 발송.
 * 엑셀 원본은 저장하지 않음. PDF는 메일로 보내고,
 * 수신 이메일이 MVS 사용자와 일치하면 내 급여 명세서에서 조회할 수 있게 보관한다.
 */
export const sendImportedPayslip = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenant_id, company_id, id: senderId, role } = req.user;
    const to = String(req.body?.to || '').trim();
    const employeeName = String(req.body?.employee_name || '').trim().slice(0, 120);
    const period = String(req.body?.payroll_period || '').trim().slice(0, 30);
    const empId = String(req.body?.emp_id || '').trim().slice(0, 50);
    const netSalaryRaw = req.body?.net_salary;
    const netSalary =
      netSalaryRaw === undefined || netSalaryRaw === null || netSalaryRaw === ''
        ? null
        : Number(netSalaryRaw);
    const subject = String(req.body?.subject || '').trim().replace(/[\r\n]+/g, ' ').slice(0, 200);
    const message = String(req.body?.message || '').trim().slice(0, 5000);
    const pdfBase64 = String(req.body?.pdf_base64 || '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ success: false, message: '유효한 수신 이메일 주소가 필요합니다.' });
    }
    if (!pdfBase64 || pdfBase64.length < 20 || pdfBase64.length > 20 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: '유효한 PDF 데이터가 필요합니다.' });
    }

    // root/audit: body.company_id로 발송 회사 지정 / 그 외: 로그인 회사 고정
    let effectiveCompanyId = Number(company_id);
    if (role === 'root' || role === 'audit') {
      const requested = Number(req.body?.company_id);
      if (Number.isFinite(requested) && requested > 0) {
        effectiveCompanyId = requested;
      }
    }
    if (!Number.isFinite(effectiveCompanyId) || effectiveCompanyId <= 0) {
      return res.status(400).json({ success: false, message: '발송 회사를 선택해주세요.' });
    }

    const companyWhere: any = { id: effectiveCompanyId };
    if (role !== 'root') {
      companyWhere.tenant_id = tenant_id;
    }
    const companyRow = await Company.findOne({ where: companyWhere });
    if (!companyRow) {
      return res.status(404).json({ success: false, message: '발송 회사를 찾을 수 없습니다.' });
    }
    const scopeTenantId = Number((companyRow as any).tenant_id || tenant_id);

    const senderRow = await User.findOne({
      where:
        role === 'root' || role === 'audit'
          ? { id: senderId }
          : { id: senderId, tenant_id, company_id },
      attributes: ['id', 'settings'],
    });
    const mailOpts = getResolvedMailTransportOptions(companyRow, senderRow);
    if (!mailOpts) {
      return res.status(503).json({
        success: false,
        message: '메일 서버가 설정되지 않았습니다. 시스템 설정에서 보내는 메일 서버를 입력하세요.'
      });
    }

    const safeMessage = message
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />');
    const b64 = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;
    const pdfBuffer = Buffer.from(b64, 'base64');
    const imageBase64Raw = String(req.body?.image_base64 || '').trim();
    const imageB64 = imageBase64Raw.includes(',')
      ? imageBase64Raw.split(',')[1]
      : imageBase64Raw;
    const imageBuffer =
      imageB64 && imageB64.length > 20 ? Buffer.from(imageB64, 'base64') : null;
    const filenamePart = `Payslip (${period || 'Unknown'}) (${employeeName || 'Employee'})`
      .replace(/[\\/:*?"<>|]/g, '_')
      .slice(0, 120);

    const mailVars = {
      name: employeeName || 'Employee',
      company: shortCompanyNameForMail((companyRow as any)?.name),
      period
    };
    const fallbackSubject = fillPayslipMailTemplate(DEFAULT_PAYSLIP_MAIL_SUBJECT, mailVars);
    const fallbackBody = fillPayslipMailTemplate(DEFAULT_PAYSLIP_MAIL_BODY, mailVars);
    const fallbackHtml = fallbackBody
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />');
    const htmlBodyRaw = String(req.body?.html_body || '').trim();
    const htmlBody =
      htmlBodyRaw.length > 100 && htmlBodyRaw.length <= 1_500_000
        ? htmlBodyRaw
        : `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.6;color:#111827;">${
            safeMessage || fallbackHtml
          }</div>`;

    const mailAttachments: Array<Record<string, unknown>> = [
      {
        filename: `${filenamePart}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ];
    if (imageBuffer) {
      const isJpeg = imageBuffer.length > 2 && imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8;
      mailAttachments.unshift({
        filename: `${filenamePart}.${isJpeg ? 'jpg' : 'png'}`,
        content: imageBuffer,
        contentType: isJpeg ? 'image/jpeg' : 'image/png',
        cid: 'payslip@mvs',
      });
    }

    const transporter = nodemailer.createTransport(buildNodemailerTransportOptions(mailOpts));
    await transporter.sendMail({
      from: mailOpts.from,
      to,
      subject: subject || fallbackSubject,
      text: message || fallbackBody,
      html: htmlBody,
      attachments: mailAttachments
    });

    // 저장 키 = 수신 메일 + 급여월. user_id는 있으면 보조 연결(필수 아님).
    const emailLower = to.toLowerCase();
    let matchedUser =
      (await (User as any).findOne({
        where: {
          tenant_id: scopeTenantId,
          company_id: effectiveCompanyId,
          status: 'active',
          [Op.and]: [Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('email')), emailLower)]
        },
        attributes: ['id', 'email', 'username', 'employee_number']
      })) || null;

    if (!matchedUser && empId) {
      matchedUser = await (User as any).findOne({
        where: {
          tenant_id: scopeTenantId,
          company_id: effectiveCompanyId,
          status: 'active',
          employee_number: empId
        },
        attributes: ['id', 'email', 'username', 'employee_number']
      });
    }

    const dir = ensureUploadSubdir('payslips', String(scopeTenantId), String(effectiveCompanyId));
    const fileName = `payslip-${period || 'na'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
    const absPath = path.join(dir, fileName);
    await fs.promises.writeFile(absPath, pdfBuffer);
    const pdfUrl = `/uploads/payslips/${scopeTenantId}/${effectiveCompanyId}/${fileName}`;

    // 같은 메일 + 같은 급여월 → 이전 활성 건 소프트 삭제 후 최신만 유지
    const previousRows = await (PayslipDelivery as any).findAll({
      where: {
        tenant_id: scopeTenantId,
        company_id: effectiveCompanyId,
        payroll_period: period || '',
        is_active: true,
        [Op.and]: [
          Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('recipient_email')), emailLower)
        ]
      }
    });
    const oldPaths: string[] = [];
    for (const prev of previousRows) {
      const oldPath = String(prev.pdf_path || '');
      if (oldPath) oldPaths.push(oldPath);
      await prev.update({ is_active: false });
    }

    await (PayslipDelivery as any).create({
      tenant_id: scopeTenantId,
      company_id: effectiveCompanyId,
      user_id: matchedUser?.id ?? null,
      payroll_period: period || '',
      employee_name: employeeName || matchedUser?.username || null,
      recipient_email: to,
      emp_id: empId || matchedUser?.employee_number || null,
      net_salary: Number.isFinite(netSalary as number) ? netSalary : null,
      pdf_path: absPath,
      pdf_url: pdfUrl,
      sent_by: senderId,
      sent_at: new Date(),
      is_active: true
    });

    for (const oldPath of oldPaths) {
      if (oldPath === absPath) continue;
      try {
        await fs.promises.unlink(oldPath);
      } catch {
        /* ignore */
      }
    }

    return res.json({
      success: true,
      message: '메일을 발송했고, 급여 명세서에 저장했습니다.',
      data: { saved_for_user: Boolean(matchedUser?.id), company_id: effectiveCompanyId }
    });
  } catch (error: any) {
    console.error('업로드 급여 명세서 메일 오류:', error);
    const smtp = typeof error?.message === 'string' ? error.message.trim() : '';
    return res.status(500).json({
      success: false,
      message: smtp
        ? `메일 발송에 실패했습니다. ${smtp}`.slice(0, 500)
        : '메일 발송에 실패했습니다.',
    });
  }
};

/** 로그인한 사용자 본인의 발송 급여 명세서 목록 (메일 또는 user_id) */
export const getMyPayslips = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenant_id, company_id, id: userId, email: userEmail } = req.user;
    const period = String(req.query?.period || '').trim();
    const q = String(req.query?.q || '').trim();
    const emailLower = String(userEmail || '').trim().toLowerCase();

    const ownerClause: any[] = [{ user_id: userId }];
    if (emailLower) {
      ownerClause.push(
        Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('recipient_email')), emailLower)
      );
    }

    const where: any = {
      tenant_id,
      company_id,
      is_active: true,
      [Op.or]: ownerClause
    };
    if (period) where.payroll_period = period;
    if (q) {
      where[Op.and] = [
        {
          [Op.or]: [
            { employee_name: { [Op.iLike]: `%${q}%` } },
            { payroll_period: { [Op.iLike]: `%${q}%` } },
            { emp_id: { [Op.iLike]: `%${q}%` } }
          ]
        }
      ];
    }

    const rows = await (PayslipDelivery as any).findAll({
      where,
      order: [
        ['payroll_period', 'DESC'],
        ['sent_at', 'DESC'],
        ['id', 'DESC']
      ],
      attributes: [
        'id',
        'payroll_period',
        'employee_name',
        'recipient_email',
        'emp_id',
        'net_salary',
        'sent_at',
        'created_at'
      ]
    });

    // 발송 당시 DB net이 수당값으로 잘못 저장된 경우 → 동일 월 급여 행으로 실수령액 보정
    const periodSet = new Set<string>();
    for (const r of rows) {
      const ym = normalizePayrollPeriodInput(String((r as any).payroll_period || ''));
      if (ym) periodSet.add(ym);
    }
    const periods = Array.from(periodSet);
    const payrollByPeriod = new Map<string, any>();
    if (periods.length > 0) {
      const payrollRows = await (Payroll as any).findAll({
        where: {
          tenant_id,
          company_id,
          employee_id: userId,
          is_active: true,
          [Op.or]: periods.map((ym: string) => sameMonthPayrollPeriodWhere(ym)),
        },
        attributes: [
          'id',
          'payroll_period',
          'gross_salary',
          'net_salary',
          'tax_amount',
          'deductions',
          'extra_fields',
        ],
      });
      for (const p of payrollRows) {
        const key = normalizePayrollPeriodInput(String(p.payroll_period || ''));
        if (!key) continue;
        if (!payrollByPeriod.has(key)) payrollByPeriod.set(key, p);
      }
    }

    const data = [];
    for (const r of rows) {
      const plain = typeof r.toJSON === 'function' ? r.toJSON() : { ...r };
      const key = normalizePayrollPeriodInput(String(plain.payroll_period || ''));
      const payroll = key ? payrollByPeriod.get(key) : null;
      if (payroll) {
        const fixed = resolvePayrollNetSalary(payroll, null);
        const stored = Number(plain.net_salary);
        if (
          fixed != null &&
          (!Number.isFinite(stored) || Math.round(stored) !== fixed)
        ) {
          plain.net_salary = fixed;
          // 목록이 즉시 맞도록 보관값도 수정 (soft sync)
          try {
            if (Math.round(stored) !== fixed) {
              await r.update({ net_salary: fixed });
            }
          } catch {
            /* ignore */
          }
        }
      }
      data.push(plain);
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('내 급여 명세서 목록 오류:', error);
    return res.status(500).json({ success: false, message: '급여 명세서 목록을 불러오지 못했습니다.' });
  }
};

/** 본인 급여 명세서 PDF 다운로드 */
export const downloadMyPayslip = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenant_id, company_id, id: userId, email: userEmail } = req.user;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: '잘못된 요청입니다.' });
    }

    const emailLower = String(userEmail || '').trim().toLowerCase();
    const ownerClause: any[] = [{ user_id: userId }];
    if (emailLower) {
      ownerClause.push(
        Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('recipient_email')), emailLower)
      );
    }

    const row = await (PayslipDelivery as any).findOne({
      where: {
        id,
        tenant_id,
        company_id,
        is_active: true,
        [Op.or]: ownerClause
      }
    });
    if (!row) {
      return res.status(404).json({ success: false, message: '급여 명세서를 찾을 수 없습니다.' });
    }

    const filePath = resolveStoredUploadFile(row.pdf_path, row.pdf_url);
    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: '명세서 파일이 없습니다. 급여 관리에서 명세서를 다시 발송해 주세요.'
      });
    }

    // 손상·빈 파일 방지
    try {
      const st = await fs.promises.stat(filePath);
      if (!st.isFile() || st.size < 64) {
        return res.status(404).json({
          success: false,
          message: '명세서 파일이 없습니다. 급여 관리에서 명세서를 다시 발송해 주세요.'
        });
      }
      const fd = await fs.promises.open(filePath, 'r');
      try {
        const header = Buffer.alloc(5);
        await fd.read(header, 0, 5, 0);
        if (header.toString('utf8') !== '%PDF-') {
          return res.status(404).json({
            success: false,
            message: '명세서 파일이 손상되었습니다. 급여 관리에서 명세서를 다시 발송해 주세요.'
          });
        }
      } finally {
        await fd.close();
      }
    } catch {
      return res.status(404).json({
        success: false,
        message: '명세서 파일이 없습니다. 급여 관리에서 명세서를 다시 발송해 주세요.'
      });
    }

    const downloadName = `Payslip (${row.payroll_period || 'Unknown'}) (${row.employee_name || 'Employee'})`
      .replace(/[\\/:*?"<>|]/g, '_')
      .slice(0, 120) + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${downloadName}"`);
    return fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('내 급여 명세서 다운로드 오류:', error);
    return res.status(500).json({ success: false, message: '다운로드에 실패했습니다.' });
  }
};

// 직원 목록 조회 (급여 생성용)
export const getEmployees = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenant_id, company_id } = req.user;

    const employees = await (User as any).findAll({
      where: { tenant_id, company_id, status: 'active' },
      attributes: ['id', 'username', 'email', 'department', 'position', 'employee_number']
    });

    res.json({ success: true, data: employees });
  } catch (error) {
    console.error('직원 목록 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 급여 통계 조회
export const getPayrollStats = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenant_id, company_id } = req.user;
    const { period = '' } = req.query;

    const whereClause: any = { tenant_id, company_id };
    
    if (period) {
      whereClause.payroll_period = period;
    }

    const stats = await (Payroll as any).findOne({
      where: whereClause,
      attributes: [
        [sequelize.fn('SUM', sequelize.col('gross_salary')), 'total_gross'],
        [sequelize.fn('SUM', sequelize.col('net_salary')), 'total_net'],
        [sequelize.fn('SUM', sequelize.col('tax_amount')), 'total_tax'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_count']
      ]
    });

    // 상태별 통계
    const statusStats = await (Payroll as any).findAll({
      where: whereClause,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status']
    });

    res.json({
      success: true,
      data: {
        summary: stats,
        statusBreakdown: statusStats
      }
    });
  } catch (error) {
    console.error('급여 통계 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

/** 급여 그리드 컬럼·상수 % — companies.settings.payroll.grid (회사 공유) */
export const getPayrollGridSettings = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId: effectiveCompanyId, userRole } = resolvePayrollScope(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '테넌트 정보가 없습니다.' });
    }
    if (effectiveCompanyId == null && userRole !== 'root') {
      return res.status(400).json({ success: false, message: '회사 정보가 없습니다.' });
    }
    if (effectiveCompanyId == null) {
      return res.json({ success: true, data: null });
    }

    const company = await (Company as any).findOne({
      where: { id: effectiveCompanyId, tenant_id: tenantId },
      attributes: ['id', 'settings'],
    });
    if (!company) {
      return res.status(404).json({ success: false, message: '회사를 찾을 수 없습니다.' });
    }

    const grid = readPayrollGridSettingsFromCompanySettings(company.settings);
    res.json({ success: true, data: grid });
  } catch (error) {
    console.error('급여 그리드 설정 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

export const updatePayrollGridSettings = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId: effectiveCompanyId, userRole } = resolvePayrollScope(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '테넌트 정보가 없습니다.' });
    }
    if (effectiveCompanyId == null && userRole !== 'root') {
      return res.status(400).json({ success: false, message: '회사 정보가 없습니다.' });
    }
    if (effectiveCompanyId == null) {
      return res.status(400).json({ success: false, message: '회사를 지정해 주세요.' });
    }

    const company = await (Company as any).findOne({
      where: { id: effectiveCompanyId, tenant_id: tenantId },
    });
    if (!company) {
      return res.status(404).json({ success: false, message: '회사를 찾을 수 없습니다.' });
    }

    const grid = buildPayrollGridSettingsPatch(req.body);
    const nextSettings = mergePayrollGridIntoCompanySettings(company.settings, grid);
    await company.update({ settings: nextSettings as any });

    res.json({ success: true, data: grid });
  } catch (error) {
    console.error('급여 그리드 설정 저장 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

/** 근무형태별 급여 계산 옵션 조회 */
export const getEmploymentTypePaySettings = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId: effectiveCompanyId, userRole } = resolvePayrollScope(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '테넌트 정보가 없습니다.' });
    }
    if (effectiveCompanyId == null && userRole !== 'root') {
      return res.status(400).json({ success: false, message: '회사 정보가 없습니다.' });
    }
    if (effectiveCompanyId == null) {
      return res.json({
        success: true,
        data: readEmploymentTypePayFromCompanySettings(null),
      });
    }

    const company = await (Company as any).findOne({
      where: { id: effectiveCompanyId, tenant_id: tenantId },
      attributes: ['id', 'settings'],
    });
    if (!company) {
      return res.status(404).json({ success: false, message: '회사를 찾을 수 없습니다.' });
    }

    res.json({
      success: true,
      data: readEmploymentTypePayFromCompanySettings(company.settings),
    });
  } catch (error) {
    console.error('근무형태 급여 설정 조회 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

/** 근무형태별 급여 계산 옵션 저장 */
export const updateEmploymentTypePaySettings = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId: effectiveCompanyId, userRole } = resolvePayrollScope(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '테넌트 정보가 없습니다.' });
    }
    if (effectiveCompanyId == null) {
      return res.status(400).json({ success: false, message: '회사를 지정해 주세요.' });
    }

    const company = await (Company as any).findOne({
      where: { id: effectiveCompanyId, tenant_id: tenantId },
    });
    if (!company) {
      return res.status(404).json({ success: false, message: '회사를 찾을 수 없습니다.' });
    }

    const pay = normalizeEmploymentTypePaySettings(req.body);
    const nextSettings = mergeEmploymentTypePayIntoCompanySettings(company.settings, pay);
    await company.update({ settings: nextSettings as any });

    res.json({
      success: true,
      data: readEmploymentTypePayFromCompanySettings(nextSettings),
    });
  } catch (error) {
    console.error('근무형태 급여 설정 저장 오류:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};
