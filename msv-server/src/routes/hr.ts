import { Router } from 'express';
import {
  getPayrolls,
  getPayroll,
  createPayroll,
  bulkGeneratePayrolls,
  previewBulkPayrollGeneration,
  updatePayroll,
  deletePayroll,
  approvePayroll,
  payPayroll,
  sendPayrollPayslip,
  sendImportedPayslip,
  getMyPayslips,
  downloadMyPayslip,
  getPayrollPeriodLocks,
  getPayrollPeriodApproval,
  requestPayrollPeriodApproval,
  completePayrollPeriod,
  getPayrollGridSettings,
  updatePayrollGridSettings,
  getEmploymentTypePaySettings,
  updateEmploymentTypePaySettings,
} from '../controllers/hrController';
import {
  downloadPayrollBonusStatement,
  getPayrollBonuses,
  registerPayrollBonuses,
  requestPayrollBonusApproval,
  sendPayrollBonusStatements,
  updatePayrollBonusLine,
} from '../controllers/payrollBonusController';
import {
  getAttendances,
  getCompanyAttendances,
  getAttendance,
  checkIn,
  checkOut,
  createAttendance,
  updateAttendance,
  deleteAttendance,
  getTodayAttendance,
} from '../controllers/attendanceController';
import {
  getHeresnowStatus,
  previewHeresnowAttendance,
  syncHeresnowAttendance,
  testHeresnowAttendanceConnection,
  updateHeresnowSettings
} from '../controllers/heresnowIntegrationController';
import {
  getVacations,
  getVacation,
  createVacation,
  updateVacation,
  deleteVacation,
  approveVacation,
  rejectVacation,
  getAnnualLeaveInfo,
  getLeaveBalances,
  getVacationPolicy,
  updateVacationPolicy,
  exportVacationsToExcel,
} from '../controllers/vacationController';
import {
  getPerformances,
  getPerformance,
  createPerformance,
  updatePerformance,
  deletePerformance,
} from '../controllers/performanceController';
import {
  getEmploymentContractTemplates,
  createEmploymentContractTemplate,
  updateEmploymentContractTemplate,
  deleteEmploymentContractTemplate,
  getEmploymentContracts,
  getEmploymentContract,
  createEmploymentContract,
  updateEmploymentContract,
  deleteEmploymentContract,
  signEmploymentContract,
  sendEmploymentContractToEmployee,
  getMyEmploymentContracts,
  getEmploymentContractAuditLogs,
  getPendingApprovalContracts,
  submitEmploymentContractForApproval,
  approveEmploymentContract,
  rejectEmploymentContractApproval,
  completeEmploymentContract,
  downloadEmploymentContractPdf,
  getAadhaarEsignConfig,
  initiateAadhaarEsign,
  completeAadhaarEsign,
} from '../controllers/employmentContractController';
import {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment
} from '../controllers/departmentController';
import {
  listPositions,
  createPosition,
  updatePosition,
  deletePosition
} from '../controllers/positionController';
import { authenticateToken, restrictAuditToReadOnly, requireRole } from '../middleware/auth';
import { requireAdminRootOrMenuPermissionAnyOf, VACATION_MENU_ROUTES } from '../middleware/menuPermission';
import { validateBody } from '../middleware/validate';

const router = Router();
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

// 부서 관리
router.get('/departments', listDepartments);
router.post(
  '/departments',
  restrictAuditToReadOnly,
  requireRole(['admin', 'root']),
  validateBody({
    name: { required: true, type: 'string', minLength: 1, maxLength: 200 }
  }),
  createDepartment
);
router.put('/departments/:id', restrictAuditToReadOnly, requireRole(['admin', 'root']), updateDepartment);
router.delete(
  '/departments/:id',
  restrictAuditToReadOnly,
  requireRole(['admin', 'root']),
  deleteDepartment
);

// 직책 관리
router.get('/positions', listPositions);
router.post(
  '/positions',
  restrictAuditToReadOnly,
  requireRole(['admin', 'root']),
  validateBody({
    name: { required: true, type: 'string', minLength: 1, maxLength: 200 }
  }),
  createPosition
);
router.put('/positions/:id', restrictAuditToReadOnly, requireRole(['admin', 'root']), updatePosition);
router.delete(
  '/positions/:id',
  restrictAuditToReadOnly,
  requireRole(['admin', 'root']),
  deletePosition
);

router.get('/payroll-period-locks', getPayrollPeriodLocks);
router.get('/payroll-period-approval', getPayrollPeriodApproval);
router.post(
  '/payroll-period-approval/request',
  restrictAuditToReadOnly,
  validateBody({
    payroll_period: { required: true, type: 'string', minLength: 7, maxLength: 20 },
    approver_id: { required: true, type: 'number' },
    company_id: { type: 'number' },
  }),
  requestPayrollPeriodApproval
);
router.get('/payroll-grid-settings', getPayrollGridSettings);
router.put('/payroll-grid-settings', restrictAuditToReadOnly, updatePayrollGridSettings);
router.get('/employment-type-pay-settings', getEmploymentTypePaySettings);
router.put(
  '/employment-type-pay-settings',
  restrictAuditToReadOnly,
  updateEmploymentTypePaySettings
);
router.post(
  '/payroll-periods/complete',
  restrictAuditToReadOnly,
  validateBody({
    payroll_period: { required: true, type: 'string', minLength: 7, maxLength: 20 },
    company_id: { type: 'number' } // root 회사 선택
  }),
  completePayrollPeriod
);

router.get('/payroll-bonuses', getPayrollBonuses);
router.post(
  '/payroll-bonuses',
  restrictAuditToReadOnly,
  validateBody({
    fiscal_year: { required: true, type: 'string', minLength: 9, maxLength: 9 },
    installments_per_year: { required: true, type: 'number' },
    installment: { type: 'number' },
    company_id: { type: 'number' },
    employee_ids: { type: 'array' },
    generate_all: { type: 'boolean' },
    mark_paid: { type: 'boolean' },
  }),
  registerPayrollBonuses
);
router.put(
  '/payroll-bonuses/line',
  restrictAuditToReadOnly,
  validateBody({
    fiscal_year: { required: true, type: 'string', minLength: 9, maxLength: 9 },
    installments_per_year: { required: true, type: 'number' },
    installment: { type: 'number' },
    company_id: { type: 'number' },
    employee_id: { required: true, type: 'number' },
    rate_percent: { required: true, type: 'number' },
    amount: { required: true, type: 'number' },
  }),
  updatePayrollBonusLine
);
router.post(
  '/payroll-bonuses/approval',
  restrictAuditToReadOnly,
  validateBody({
    fiscal_year: { required: true, type: 'string', minLength: 9, maxLength: 9 },
    installments_per_year: { required: true, type: 'number' },
    installment: { type: 'number' },
    company_id: { type: 'number' },
    approver_id: { required: true, type: 'number' },
  }),
  requestPayrollBonusApproval
);
router.post(
  '/payroll-bonuses/statement',
  restrictAuditToReadOnly,
  validateBody({
    fiscal_year: { required: true, type: 'string', minLength: 9, maxLength: 9 },
    installments_per_year: { required: true, type: 'number' },
    installment: { type: 'number' },
    company_id: { type: 'number' },
    employee_ids: { required: true, type: 'array' },
  }),
  downloadPayrollBonusStatement
);
router.post(
  '/payroll-bonuses/send',
  restrictAuditToReadOnly,
  validateBody({
    fiscal_year: { required: true, type: 'string', minLength: 9, maxLength: 9 },
    installments_per_year: { required: true, type: 'number' },
    installment: { type: 'number' },
    company_id: { type: 'number' },
    employee_ids: { required: true, type: 'array' },
    statements: { type: 'array' },
  }),
  sendPayrollBonusStatements
);

// 급여 관련 라우트
router.get('/payrolls', getPayrolls);
router.post(
  '/payrolls/bulk-generate/preview',
  restrictAuditToReadOnly,
  validateBody({
    payroll_period: { required: true, type: 'string', minLength: 1, maxLength: 20 },
    company_id: { type: 'number' } // root 회사 선택
  }),
  previewBulkPayrollGeneration
);
router.post(
  '/payrolls/bulk-generate',
  restrictAuditToReadOnly,
  validateBody({
    payroll_period: { required: true, type: 'string', minLength: 1, maxLength: 20 },
    company_id: { type: 'number' } // root 회사 선택
  }),
  bulkGeneratePayrolls
);
router.get('/payrolls/:id', getPayroll);
router.post(
  '/payrolls/:id/send-payslip',
  restrictAuditToReadOnly,
  validateBody({
    pdf_base64: { required: true, type: 'string', minLength: 20 },
    company_id: { type: 'number' }, // root 회사 선택
    /** 그리드 재계산 실수령액 — DB payroll.net_salary 보다 우선 (목록·내 명세서 표시용) */
    net_salary: { type: 'number' },
  }),
  sendPayrollPayslip
);
router.post(
  '/payslips/send-imported',
  restrictAuditToReadOnly,
  validateBody({
    to: { required: true, type: 'string', minLength: 3, maxLength: 254 },
    employee_name: { type: 'string', maxLength: 120 },
    payroll_period: { type: 'string', maxLength: 30 },
    emp_id: { type: 'string', maxLength: 50 },
    net_salary: { type: 'number' },
    subject: { type: 'string', maxLength: 200 },
    message: { type: 'string', maxLength: 5000 },
    pdf_base64: { required: true, type: 'string', minLength: 20, maxLength: 20 * 1024 * 1024 }
  }),
  sendImportedPayslip
);
router.get('/my/payslips', getMyPayslips);
router.get('/my/payslips/:id/download', downloadMyPayslip);
router.post(
  '/payrolls',
  restrictAuditToReadOnly,
  validateBody({
    employee_id: { required: true, type: 'number' },
    payroll_period: { required: true, type: 'string', minLength: 1, maxLength: 20 },
    basic_salary: { type: 'number' },
    overtime_pay: { type: 'number' },
    bonus: { type: 'number' },
    allowances: { type: 'number' },
    deductions: { type: 'number' },
    gross_salary: { type: 'number' },
    net_salary: { type: 'number' },
    tax_amount: { type: 'number' },
    status: { type: 'string', maxLength: 20 },
    payment_date: { type: 'string', pattern: datePattern }
  }),
  createPayroll
);
router.put(
  '/payrolls/:id',
  restrictAuditToReadOnly,
  validateBody({
    employee_id: { type: 'number' },
    payroll_period: { type: 'string', minLength: 1, maxLength: 20 },
    basic_salary: { type: 'number' },
    overtime_pay: { type: 'number' },
    bonus: { type: 'number' },
    allowances: { type: 'number' },
    deductions: { type: 'number' },
    gross_salary: { type: 'number' },
    net_salary: { type: 'number' },
    tax_amount: { type: 'number' },
    status: { type: 'string', maxLength: 20 },
    payment_date: { type: 'string', pattern: datePattern },
    company_id: { type: 'number' } // root 회사 선택
  }),
  updatePayroll
);
router.delete('/payrolls/:id', restrictAuditToReadOnly, deletePayroll);
router.post('/payrolls/:id/approve', restrictAuditToReadOnly, approvePayroll);
router.post('/payrolls/:id/pay', restrictAuditToReadOnly, payPayroll);

// 근태 관련 라우트 (`/company`는 `:id`보다 먼저 등록)
router.get('/attendances/heresnow/status', getHeresnowStatus);
router.post('/attendances/heresnow/test', restrictAuditToReadOnly, requireRole(['admin', 'root']), testHeresnowAttendanceConnection);
router.post('/attendances/heresnow/preview', restrictAuditToReadOnly, requireRole(['admin', 'root']), previewHeresnowAttendance);
router.post('/attendances/heresnow/sync', restrictAuditToReadOnly, requireRole(['admin', 'root']), syncHeresnowAttendance);
router.put('/attendances/heresnow/settings', restrictAuditToReadOnly, requireRole(['admin', 'root']), updateHeresnowSettings);
router.get('/attendances/company', getCompanyAttendances);
router.get('/attendances', getAttendances);
router.get('/attendances/today', getTodayAttendance);
router.get('/attendances/:id', getAttendance);
router.post('/attendances/check-in', restrictAuditToReadOnly, checkIn);
router.post('/attendances/check-out', restrictAuditToReadOnly, checkOut);
router.post(
  '/attendances',
  restrictAuditToReadOnly,
  validateBody({
    user_id: { required: true, type: 'number' },
    date: { required: true, type: 'string', pattern: datePattern },
    status: { type: 'string', oneOf: ['normal', 'late', 'early', 'overtime', 'absent'] },
    notes: { type: 'string' }
  }),
  createAttendance
);
router.put(
  '/attendances/:id',
  restrictAuditToReadOnly,
  validateBody({
    user_id: { type: 'number' },
    date: { type: 'string', pattern: datePattern },
    status: { type: 'string', oneOf: ['normal', 'late', 'early', 'overtime', 'absent'] },
    notes: { type: 'string' }
  }),
  updateAttendance
);
router.delete('/attendances/:id', restrictAuditToReadOnly, deleteAttendance);

// 휴가 관련 라우트 — 메뉴 `/hr/leave` 권한과 정합 (조회/등록/수정/삭제)
const vacationMenuPerm = (flags: ('can_view' | 'can_create' | 'can_edit' | 'can_delete')[]) =>
  requireAdminRootOrMenuPermissionAnyOf(VACATION_MENU_ROUTES, flags);

router.get('/vacations', vacationMenuPerm(['can_view', 'can_create']), getVacations);
router.get('/vacations/excel/export', vacationMenuPerm(['can_view', 'can_edit']), exportVacationsToExcel);
router.get('/vacations/annual-leave', vacationMenuPerm(['can_view', 'can_create']), getAnnualLeaveInfo);
router.get('/vacations/leave-balances', requireRole(['admin', 'root']), getLeaveBalances);
router.get('/vacations/policy', vacationMenuPerm(['can_view', 'can_create']), getVacationPolicy);
router.put(
  '/vacations/policy',
  restrictAuditToReadOnly,
  requireRole(['admin', 'root']),
  validateBody({
    annualLeaveStartDays: { required: true },
    annualLeaveEarnDays: { required: false },
    forceFixedAnnualForTenure: { required: false },
    forceFixedAnnualDays: { required: false, type: 'number' },
    forceFixedAnnualMinYears: { required: false, type: 'number' },
  }),
  updateVacationPolicy
);
// 상세는 목록(조회) + 신청 폼(등록) + 수정 화면(수정) 모두 사용
router.get('/vacations/:id', vacationMenuPerm(['can_view', 'can_create', 'can_edit']), getVacation);
router.post(
  '/vacations',
  restrictAuditToReadOnly,
  vacationMenuPerm(['can_create']),
  validateBody({
    user_id: { required: false, type: 'number' }, // 미제공 시 본인(req.user.id)으로 처리
    vacation_type: {
      required: true,
      type: 'string',
      oneOf: ['annual', 'sick', 'personal', 'study', 'maternity', 'paternity', 'marriage', 'bereavement'],
    },
    start_date: { required: true, type: 'string', pattern: datePattern },
    end_date: { required: true, type: 'string', pattern: datePattern },
    days: { required: true, type: 'number' },
    is_half_day: { required: false, type: 'boolean' },
    reason: { required: true, type: 'string', minLength: 1 },
    status: { type: 'string', oneOf: ['pending', 'approved', 'rejected', 'cancelled'] },
    applied_date: { type: 'string', pattern: datePattern },
    attachments: { type: 'string' }
  }),
  createVacation
);
router.put(
  '/vacations/:id',
  restrictAuditToReadOnly,
  vacationMenuPerm(['can_edit']),
  validateBody({
    user_id: { type: 'number' },
    vacation_type: {
      type: 'string',
      oneOf: ['annual', 'sick', 'personal', 'study', 'maternity', 'paternity', 'marriage', 'bereavement'],
    },
    start_date: { type: 'string', pattern: datePattern },
    end_date: { type: 'string', pattern: datePattern },
    days: { type: 'number' },
    is_half_day: { type: 'boolean' },
    reason: { type: 'string', minLength: 1 },
    status: { type: 'string', oneOf: ['pending', 'approved', 'rejected', 'cancelled'] },
    applied_date: { type: 'string', pattern: datePattern },
    attachments: { type: 'string' }
  }),
  updateVacation
);
router.delete('/vacations/:id', restrictAuditToReadOnly, vacationMenuPerm(['can_delete']), deleteVacation);
router.post('/vacations/:id/approve', restrictAuditToReadOnly, approveVacation);
router.post('/vacations/:id/reject', restrictAuditToReadOnly, rejectVacation);

// 성과 관련 라우트
router.get('/performances', getPerformances);
router.get('/performances/:id', getPerformance);
router.post(
  '/performances',
  restrictAuditToReadOnly,
  validateBody({
    user_id: { required: true, type: 'number' },
    review_period: { required: true, type: 'string', minLength: 1, maxLength: 50 },
    overall_rating: { type: 'number' },
    manager_comment: { required: true, type: 'string', minLength: 1 },
    employee_comment: { type: 'string' },
    status: { type: 'string', oneOf: ['draft', 'submitted', 'reviewed', 'approved', 'finalized'] },
    reviewed_by: { type: 'number' }
  }),
  createPerformance
);
router.put(
  '/performances/:id',
  restrictAuditToReadOnly,
  validateBody({
    user_id: { type: 'number' },
    review_period: { type: 'string', minLength: 1, maxLength: 50 },
    overall_rating: { type: 'number' },
    manager_comment: { type: 'string', minLength: 1 },
    employee_comment: { type: 'string' },
    status: { type: 'string', oneOf: ['draft', 'submitted', 'reviewed', 'approved', 'finalized'] },
    reviewed_by: { type: 'number' }
  }),
  updatePerformance
);
router.delete('/performances/:id', restrictAuditToReadOnly, deletePerformance);

// 전자근로계약 템플릿
router.get('/employment-contract-templates', getEmploymentContractTemplates);
router.post(
  '/employment-contract-templates',
  restrictAuditToReadOnly,
  validateBody({
    company_id: { type: 'number' }, // root 전용
    name: { required: true, type: 'string', minLength: 1, maxLength: 150 },
    contract_type: { type: 'string', maxLength: 50 },
    language: { type: 'string', oneOf: ['ko', 'en'] },
    content_html: { required: true, type: 'string', minLength: 1 }
  }),
  createEmploymentContractTemplate
);
router.put(
  '/employment-contract-templates/:id',
  restrictAuditToReadOnly,
  validateBody({
    name: { type: 'string', minLength: 1, maxLength: 150 },
    contract_type: { type: 'string', maxLength: 50 },
    language: { type: 'string', oneOf: ['ko', 'en'] },
    content_html: { type: 'string', minLength: 1 },
    is_active: { type: 'boolean' }
  }),
  updateEmploymentContractTemplate
);
router.delete(
  '/employment-contract-templates/:id',
  restrictAuditToReadOnly,
  deleteEmploymentContractTemplate
);

// 전자근로계약
router.get('/employment-contracts', getEmploymentContracts);
router.get('/my/employment-contracts', getMyEmploymentContracts);
router.get('/employment-contracts/pending-approvals', getPendingApprovalContracts);
router.get('/employment-contracts/aadhaar-esign/config', getAadhaarEsignConfig);
router.post(
  '/employment-contracts/aadhaar-esign/complete',
  restrictAuditToReadOnly,
  validateBody({
    session_token: { required: true, type: 'string', minLength: 16, maxLength: 128 },
    mock_otp: { type: 'string', minLength: 6, maxLength: 6 },
  }),
  completeAadhaarEsign
);
router.get('/employment-contracts/:id', getEmploymentContract);
router.get('/employment-contracts/:id/pdf', downloadEmploymentContractPdf);
router.get('/employment-contracts/:id/audit-logs', getEmploymentContractAuditLogs);
router.post(
  '/employment-contracts',
  restrictAuditToReadOnly,
  validateBody({
    company_id: { type: 'number' }, // root 전용
    employee_id: { required: true, type: 'number' },
    approver_id: { type: 'number' },
    template_id: { type: 'number' },
    title: { required: true, type: 'string', minLength: 1, maxLength: 200 },
    contract_type: { type: 'string', maxLength: 50 },
    start_date: { required: true, type: 'string', pattern: datePattern },
    end_date: { required: true, type: 'string', pattern: datePattern },
    salary: { type: 'number' },
    bonus_type: { type: 'string', oneOf: ['percent', 'fixed'] },
    bonus_value: { type: 'number' },
    work_location: { type: 'string', maxLength: 200 },
    working_days: { type: 'string', maxLength: 120 },
    working_hours: { type: 'string', maxLength: 100 },
    probation_months: { type: 'number' },
    pdf_url: { type: 'string' },
    hash_sha256: { type: 'string', maxLength: 128 }
  }),
  createEmploymentContract
);
router.put(
  '/employment-contracts/:id',
  restrictAuditToReadOnly,
  validateBody({
    employee_id: { type: 'number' },
    approver_id: { type: 'number' },
    template_id: { type: 'number' },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    contract_type: { type: 'string', maxLength: 50 },
    status: {
      type: 'string',
      oneOf: [
        'draft',
        'pending_approval',
        'in_review',
        'rejected',
        'awaiting_company_sign',
        'awaiting_employee_sign',
        'signed',
        'active',
        'expired',
        'terminated'
      ]
    },
    start_date: { type: 'string', pattern: datePattern },
    end_date: { type: 'string', pattern: datePattern },
    salary: { type: 'number' },
    bonus_type: { type: 'string', oneOf: ['percent', 'fixed'] },
    bonus_value: { type: 'number' },
    work_location: { type: 'string', maxLength: 200 },
    working_days: { type: 'string', maxLength: 120 },
    working_hours: { type: 'string', maxLength: 100 },
    probation_months: { type: 'number' },
    pdf_url: { type: 'string' },
    hash_sha256: { type: 'string', maxLength: 128 }
  }),
  updateEmploymentContract
);
router.delete(
  '/employment-contracts/:id',
  restrictAuditToReadOnly,
  deleteEmploymentContract
);
router.post(
  '/employment-contracts/:id/submit-approval',
  restrictAuditToReadOnly,
  submitEmploymentContractForApproval
);
router.post(
  '/employment-contracts/:id/approve',
  restrictAuditToReadOnly,
  approveEmploymentContract
);
router.post(
  '/employment-contracts/:id/reject-approval',
  restrictAuditToReadOnly,
  rejectEmploymentContractApproval
);
router.post(
  '/employment-contracts/:id/complete',
  restrictAuditToReadOnly,
  completeEmploymentContract
);
router.post(
  '/employment-contracts/:id/send',
  restrictAuditToReadOnly,
  sendEmploymentContractToEmployee
);
router.post(
  '/employment-contracts/:id/aadhaar-esign/initiate',
  restrictAuditToReadOnly,
  validateBody({
    signer_type: { type: 'string', oneOf: ['company', 'employee'] },
    aadhaar_consent: { required: true, type: 'boolean' },
    aadhaar_last4: { required: true, type: 'string', minLength: 4, maxLength: 4 },
    return_url: { type: 'string', maxLength: 500 },
  }),
  initiateAadhaarEsign
);
router.post(
  '/employment-contracts/:id/sign',
  restrictAuditToReadOnly,
  validateBody({
    signer_type: { type: 'string', oneOf: ['company', 'employee'] },
    sign_method: { type: 'string', oneOf: ['internal_ack', 'aadhaar_esign'] },
    signature_data: { type: 'string' },
    aadhaar_consent: { type: 'boolean' },
    aadhaar_last4: { type: 'string', minLength: 4, maxLength: 4 },
    aadhaar_auth_ref: { type: 'string', maxLength: 100 }
  }),
  signEmploymentContract
);

export default router;
