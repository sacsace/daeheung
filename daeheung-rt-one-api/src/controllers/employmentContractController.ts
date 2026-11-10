import { Response } from 'express';
import fs from 'fs';
import { Op } from 'sequelize';
import { RequestWithUser } from '../types';
import { resolveStoredUploadFile } from '../utils/uploadPath';
import {
  Company,
  EmploymentContract,
  EmploymentContractAuditLog,
  EmploymentContractEsignSession,
  EmploymentContractSignature,
  EmploymentContractTemplate,
  User
} from '../models';
import { pushNotification } from './notificationController';
import SocketService from '../services/socketService';
import { createEmploymentContractPdfFile } from '../utils/employmentContractPdf';
import { canSelectOtherCompany } from '../utils/companyScope';
import {
  buildDocumentHash,
  completeAspEsign,
  createSessionToken,
  getAadhaarEsignMode,
  getAadhaarEsignProviderName,
  initiateAspEsign,
} from '../services/aadhaarEsignService';

const HR_CONTRACT_MANAGER_ROLES = new Set(['root', 'admin']);
const IMMUTABLE_SIGN_STATUSES = new Set(['awaiting_company_sign', 'awaiting_employee_sign', 'signed']);
/** 직원이「내 계약서」에서 볼 수 있는 상태 (승인자 승인 이후) */
const EMPLOYEE_VISIBLE_STATUSES = [
  'awaiting_employee_sign',
  'awaiting_company_sign',
  'signed',
  'active',
  'expired',
  'terminated',
];
const CONTRACT_STATUS_FLOW: Record<string, string[]> = {
  draft: ['draft', 'pending_approval', 'in_review', 'terminated'],
  pending_approval: ['pending_approval', 'awaiting_employee_sign', 'rejected', 'draft', 'terminated'],
  in_review: ['in_review', 'pending_approval', 'awaiting_company_sign', 'awaiting_employee_sign', 'rejected', 'terminated'],
  rejected: ['rejected', 'draft', 'terminated'],
  awaiting_company_sign: ['awaiting_company_sign', 'awaiting_employee_sign', 'terminated'],
  awaiting_employee_sign: ['awaiting_employee_sign', 'signed', 'terminated'],
  signed: ['signed', 'active', 'terminated'],
  active: ['active', 'expired', 'terminated'],
  expired: ['expired'],
  terminated: ['terminated'],
};

const normalizeStatus = (status?: unknown): string => String(status || '').trim().toLowerCase();

const canManageEmploymentContracts = (req: RequestWithUser): boolean =>
  HR_CONTRACT_MANAGER_ROLES.has(String(req.user?.role || '').toLowerCase());

const sanitizeAuditValue = (value: any): any => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (typeof value === 'object') {
    const clone: Record<string, any> = {};
    Object.entries(value).forEach(([key, nestedValue]) => {
      if (['signature_data', 'aadhaar_last4', 'hash_sha256'].includes(key)) {
        clone[key] = '[masked]';
      } else {
        clone[key] = sanitizeAuditValue(nestedValue);
      }
    });
    return clone;
  }
  if (typeof value === 'string' && value.length > 1000) {
    return `${value.slice(0, 1000)}...(truncated)`;
  }
  return value;
};

const buildContractAuditSnapshot = (contractLike: any) => {
  if (!contractLike) return null;
  const source = typeof contractLike.toJSON === 'function' ? contractLike.toJSON() : contractLike;
  return sanitizeAuditValue({
    id: source.id,
    tenant_id: source.tenant_id,
    company_id: source.company_id,
    employee_id: source.employee_id,
    approver_id: source.approver_id,
    template_id: source.template_id,
    title: source.title,
    contract_type: source.contract_type,
    status: source.status,
    start_date: source.start_date,
    end_date: source.end_date,
    salary: source.salary,
    bonus_type: source.bonus_type,
    bonus_value: source.bonus_value,
    work_location: source.work_location,
    working_days: source.working_days,
    working_hours: source.working_hours,
    probation_months: source.probation_months,
    pdf_url: source.pdf_url,
    company_signed_at: source.company_signed_at,
    employee_signed_at: source.employee_signed_at,
    approved_at: source.approved_at,
    rejection_reason: source.rejection_reason,
    is_active: source.is_active,
  });
};

const extractChangedFields = (beforeValue: Record<string, any> | null, afterValue: Record<string, any> | null): string[] => {
  if (!beforeValue || !afterValue) return [];
  const keys = new Set([...Object.keys(beforeValue), ...Object.keys(afterValue)]);
  return Array.from(keys).filter((key) => JSON.stringify(beforeValue[key]) !== JSON.stringify(afterValue[key]));
};

const assertManagerPermission = (req: RequestWithUser, res: Response, actionLabel: string): boolean => {
  if (canManageEmploymentContracts(req)) return true;
  res.status(403).json({ success: false, message: `${actionLabel} 권한이 없습니다.` });
  return false;
};

const assertRootPermission = (req: RequestWithUser, res: Response, actionLabel: string): boolean => {
  if (String(req.user?.role || '').toLowerCase() === 'root') return true;
  res.status(403).json({ success: false, message: `${actionLabel} 권한이 없습니다.` });
  return false;
};

const renderTemplate = (templateHtml: string, variables: Record<string, string | number | null | undefined>) =>
  templateHtml.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_matched, key) => {
    const value = variables[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });

const buildTemplateVariables = (contract: any) => ({
  contract_id: contract.id ?? '',
  title: contract.title ?? '',
  contract_type: contract.contract_type ?? '',
  start_date: contract.start_date ?? '',
  end_date: contract.end_date ?? '',
  salary: contract.salary ?? '',
  annual_ctc: contract.salary ?? '',
  monthly_gross_salary: contract.salary ? Number(contract.salary) / 12 : '',
  net_pay: contract.salary ? Math.round((Number(contract.salary) / 12) * 0.9) : '',
  bonus_type: contract.bonus_type ?? '',
  bonus_value: contract.bonus_value ?? '',
  work_location: contract.work_location ?? '',
  working_days: contract.working_days ?? '',
  working_hours: contract.working_hours ?? '',
  probation_months: contract.probation_months ?? '',
  issue_date: new Date().toISOString().slice(0, 10),
  employee_name: contract.employee?.username ?? '',
  employee_address: '',
  company_name: contract.company?.name ?? '',
  company_signer_name: '',
  company_signer_title: ''
});

const loadContractSignaturesForPdf = async (contractId: number) => {
  const rows = await (EmploymentContractSignature as any).findAll({
    where: { contract_id: contractId },
    include: [
      {
        model: User,
        as: 'signer',
        attributes: ['id', 'userid', 'username'],
        required: false,
      },
    ],
    order: [['signed_at', 'ASC']],
  });
  return rows.map((row: any) => (row.toJSON ? row.toJSON() : row));
};

const createEmploymentContractPdf = async (
  contract: any,
  signerType: 'company' | 'employee',
  signerId: number,
  signatures?: any[]
): Promise<{ pdfUrl: string; hashSha256: string }> =>
  createEmploymentContractPdfFile({
    contract,
    signerType,
    signerId,
    signatures,
  });

const buildContractPdfSnapshot = async (contractId: number, statusOverride?: string) => {
  const fullContract = await (EmploymentContract as any).findOne({
    where: { id: contractId, is_active: true },
    include: [
      { model: Company, as: 'company', attributes: ['id', 'name'] },
      { model: User, as: 'employee', attributes: ['id', 'userid', 'username', 'department', 'position'] },
      {
        model: User,
        as: 'approver',
        attributes: ['id', 'userid', 'username', 'department', 'position'],
        required: false,
      },
      {
        model: EmploymentContractTemplate,
        as: 'template',
        attributes: ['id', 'name', 'version', 'language', 'contract_type', 'content_html'],
      },
    ],
  });
  if (!fullContract) return null;
  const fullContractJson = fullContract.toJSON ? fullContract.toJSON() : fullContract;
  const renderedContentHtml = fullContractJson.template?.content_html
    ? renderTemplate(fullContractJson.template.content_html, buildTemplateVariables(fullContractJson))
    : '';
  const signatures = await loadContractSignaturesForPdf(contractId);
  return {
    snapshot: {
      ...fullContractJson,
      ...(statusOverride ? { status: statusOverride } : {}),
      rendered_content_html: renderedContentHtml,
    },
    signatures,
    contract: fullContract,
  };
};

const ensureEmploymentContractPdfStored = async (
  contract: any,
  actorId: number,
  signerType: 'company' | 'employee' = 'employee',
  forceRegenerate = false
): Promise<{ pdfUrl: string; hashSha256: string; regenerated: boolean }> => {
  if (!forceRegenerate) {
    const existingPath = resolveStoredUploadFile(null, contract.pdf_url);
    if (existingPath && contract.pdf_url && contract.hash_sha256) {
      try {
        const st = await fs.promises.stat(existingPath);
        if (st.isFile() && st.size >= 64) {
          return {
            pdfUrl: String(contract.pdf_url),
            hashSha256: String(contract.hash_sha256),
            regenerated: false,
          };
        }
      } catch {
        // regenerate below
      }
    }
  }

  const built = await buildContractPdfSnapshot(Number(contract.id), normalizeStatus(contract.status));
  if (!built) {
    throw new Error('전자근로계약을 찾을 수 없습니다.');
  }
  const generated = await createEmploymentContractPdf(
    built.snapshot,
    signerType,
    actorId,
    built.signatures
  );
  await contract.update({
    pdf_url: generated.pdfUrl,
    hash_sha256: generated.hashSha256,
    updated_by: actorId,
  });
  return { ...generated, regenerated: true };
};

const toIntOrNull = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
};

const writeAuditLog = async (
  req: RequestWithUser,
  action: string,
  params: { contractId?: number | null; companyId?: number | null; details?: Record<string, any> } = {}
) => {
  try {
    const tenantId = req.user?.tenant_id || 0;
    if (!tenantId) return;
    await (EmploymentContractAuditLog as any).create({
      contract_id: params.contractId ?? null,
      tenant_id: tenantId,
      company_id: params.companyId ?? req.user?.company_id ?? null,
      actor_id: req.user?.id ?? null,
      actor_role: req.user?.role ?? null,
      action,
      details: params.details ? sanitizeAuditValue(params.details) : null
    });
  } catch (error) {
    console.error('전자근로계약 감사로그 기록 오류:', error);
  }
};

const canViewEmploymentContracts = (req: RequestWithUser): boolean =>
  canManageEmploymentContracts(req) || canSelectOtherCompany(req.user?.role);

const getScopedCompany = async (req: RequestWithUser, requestedCompanyId?: number | null) => {
  if (!canSelectOtherCompany(req.user.role)) {
    return {
      tenant_id: req.user.tenant_id,
      company_id: req.user.company_id
    };
  }

  if (!requestedCompanyId) {
    if (req.user.role === 'audit') {
      return {
        tenant_id: req.user.tenant_id,
        company_id: req.user.company_id
      };
    }
    return { tenant_id: null, company_id: null };
  }
  const company = await (Company as any).findByPk(requestedCompanyId, {
    attributes: ['id', 'tenant_id']
  });
  if (!company) return null;
  if (Number(company.tenant_id) !== Number(req.user.tenant_id) && req.user.role !== 'root') {
    return null;
  }
  return { tenant_id: company.tenant_id, company_id: company.id };
};

const applyCompanyListScope = async (
  req: RequestWithUser,
  whereClause: Record<string, unknown>,
  requestedCompanyId?: number | null
) => {
  if (!canSelectOtherCompany(req.user.role)) {
    whereClause.tenant_id = req.user.tenant_id;
    whereClause.company_id = req.user.company_id;
    return true;
  }
  if (requestedCompanyId) {
    const scope = await getScopedCompany(req, requestedCompanyId);
    if (!scope) return false;
    if (scope.tenant_id) whereClause.tenant_id = scope.tenant_id;
    if (scope.company_id) whereClause.company_id = scope.company_id;
    return true;
  }
  if (req.user.role === 'audit') {
    whereClause.tenant_id = req.user.tenant_id;
    whereClause.company_id = req.user.company_id;
  } else {
    whereClause.tenant_id = req.user.tenant_id;
  }
  return true;
};

const requireValidEmployee = async (employeeId: number, companyId?: number | null) => {
  const whereClause: any = { id: employeeId, status: 'active' };
  if (companyId) whereClause.company_id = companyId;
  return (User as any).findOne({ where: whereClause, attributes: ['id', 'tenant_id', 'company_id'] });
};

export const getEmploymentContractTemplates = async (req: RequestWithUser, res: Response) => {
  try {
    const requestedCompanyId = toIntOrNull(req.query.company_id);
    const whereClause: any = { is_active: true };
    const scoped = await applyCompanyListScope(req, whereClause, requestedCompanyId);
    if (!scoped) {
      return res.status(404).json({ success: false, message: '회사를 찾을 수 없습니다.' });
    }

    const rows = await (EmploymentContractTemplate as any).findAll({
      where: whereClause,
      order: [['updated_at', 'DESC']]
    });

    await writeAuditLog(req, 'template_list_view', {
      details: { requestedCompanyId: requestedCompanyId || null, count: rows.length }
    });

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('전자근로계약 템플릿 조회 오류:', error);
    return res.status(500).json({ success: false, message: '템플릿 조회 중 오류가 발생했습니다.' });
  }
};

export const createEmploymentContractTemplate = async (req: RequestWithUser, res: Response) => {
  try {
    if (!assertManagerPermission(req, res, '템플릿 생성')) return;

    const { name, contract_type = 'regular', content_html } = req.body || {};
    if (!name || !String(name).trim() || !content_html || !String(content_html).trim()) {
      return res.status(400).json({ success: false, message: '템플릿명과 본문은 필수입니다.' });
    }

    const requestedCompanyId = toIntOrNull(req.body?.company_id);
    const scope = await getScopedCompany(req, requestedCompanyId);
    if (!scope) {
      return res.status(404).json({ success: false, message: '회사를 찾을 수 없습니다.' });
    }
    if (req.user.role === 'root' && !scope.company_id) {
      return res.status(400).json({ success: false, message: 'root는 company_id를 지정해야 합니다.' });
    }

    const created = await (EmploymentContractTemplate as any).create({
      tenant_id: scope.tenant_id,
      company_id: scope.company_id,
      name: String(name).trim(),
      contract_type: String(contract_type || 'regular'),
      language: 'en',
      content_html: String(content_html),
      version: 1,
      is_active: true,
      created_by: req.user.id,
      updated_by: req.user.id
    });

    await writeAuditLog(req, 'template_create', {
      companyId: created.company_id,
      details: { templateId: created.id, name: created.name }
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('전자근로계약 템플릿 생성 오류:', error);
    return res.status(500).json({ success: false, message: '템플릿 생성 중 오류가 발생했습니다.' });
  }
};

export const updateEmploymentContractTemplate = async (req: RequestWithUser, res: Response) => {
  try {
    if (!assertManagerPermission(req, res, '템플릿 수정')) return;

    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: '유효하지 않은 템플릿 ID입니다.' });

    const whereClause: any = { id, is_active: true };
    if (req.user.role !== 'root') {
      whereClause.tenant_id = req.user.tenant_id;
      whereClause.company_id = req.user.company_id;
    }

    const template = await (EmploymentContractTemplate as any).findOne({ where: whereClause });
    if (!template) return res.status(404).json({ success: false, message: '템플릿을 찾을 수 없습니다.' });

    const nextVersion = Number(template.version || 1) + 1;
    const payload: any = {
      updated_by: req.user.id
    };
    if (req.body?.name) payload.name = String(req.body.name).trim();
    if (req.body?.contract_type) payload.contract_type = String(req.body.contract_type);
    if (req.body?.language) payload.language = 'en';
    if (typeof req.body?.content_html === 'string') {
      payload.content_html = req.body.content_html;
      payload.version = nextVersion;
    }
    if (typeof req.body?.is_active === 'boolean') payload.is_active = req.body.is_active;

    await template.update(payload);

    await writeAuditLog(req, 'template_update', {
      companyId: template.company_id,
      details: { templateId: template.id, version: template.version }
    });

    return res.json({ success: true, data: template });
  } catch (error) {
    console.error('전자근로계약 템플릿 수정 오류:', error);
    return res.status(500).json({ success: false, message: '템플릿 수정 중 오류가 발생했습니다.' });
  }
};

export const deleteEmploymentContractTemplate = async (req: RequestWithUser, res: Response) => {
  try {
    if (!assertRootPermission(req, res, '템플릿 삭제')) return;

    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: '유효하지 않은 템플릿 ID입니다.' });

    const whereClause: any = { id, is_active: true };
    if (req.user.role !== 'root') {
      whereClause.tenant_id = req.user.tenant_id;
      whereClause.company_id = req.user.company_id;
    }

    const template = await (EmploymentContractTemplate as any).findOne({ where: whereClause });
    if (!template) {
      return res.status(404).json({ success: false, message: '삭제할 템플릿을 찾을 수 없습니다.' });
    }

    await template.update({
      is_active: false,
      updated_by: req.user.id
    });

    await writeAuditLog(req, 'template_delete', {
      companyId: template.company_id,
      details: { templateId: template.id, name: template.name }
    });

    return res.json({ success: true, message: '템플릿이 삭제되었습니다.' });
  } catch (error) {
    console.error('전자근로계약 템플릿 삭제 오류:', error);
    return res.status(500).json({ success: false, message: '템플릿 삭제 중 오류가 발생했습니다.' });
  }
};

export const getEmploymentContracts = async (req: RequestWithUser, res: Response) => {
  try {
    if (!canViewEmploymentContracts(req)) {
      return res.status(403).json({ success: false, message: '계약 목록 조회 권한이 없습니다.' });
    }

    const requestedCompanyId = toIntOrNull(req.query.company_id);
    const employeeId = toIntOrNull(req.query.employee_id);
    const status = req.query.status ? String(req.query.status) : '';
    const whereClause: any = { is_active: true };
    const scoped = await applyCompanyListScope(req, whereClause, requestedCompanyId);
    if (!scoped) return res.status(404).json({ success: false, message: '회사를 찾을 수 없습니다.' });

    if (employeeId) whereClause.employee_id = employeeId;
    if (status) whereClause.status = status;

    const contracts = await (EmploymentContract as any).findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'employee',
          attributes: ['id', 'userid', 'username', 'department', 'position']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'userid', 'username', 'department', 'position'],
          required: false,
        },
        {
          model: EmploymentContractTemplate,
          as: 'template',
          attributes: ['id', 'name', 'version', 'language']
        }
      ],
      order: [['updated_at', 'DESC']]
    });

    await writeAuditLog(req, 'contract_list_view', {
      details: { requestedCompanyId: requestedCompanyId || null, employeeId: employeeId || null, count: contracts.length }
    });

    return res.json({ success: true, data: contracts });
  } catch (error) {
    console.error('전자근로계약 목록 조회 오류:', error);
    return res.status(500).json({ success: false, message: '전자근로계약 목록 조회 중 오류가 발생했습니다.' });
  }
};

export const getEmploymentContract = async (req: RequestWithUser, res: Response) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: '유효하지 않은 계약 ID입니다.' });

    const whereClause: any = { id, is_active: true };
    if (!canSelectOtherCompany(req.user.role)) {
      whereClause.tenant_id = req.user.tenant_id;
      whereClause.company_id = req.user.company_id;
    } else {
      whereClause.tenant_id = req.user.tenant_id;
    }

    const contract = await (EmploymentContract as any).findOne({
      where: whereClause,
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name']
        },
        {
          model: User,
          as: 'employee',
          attributes: ['id', 'userid', 'username', 'department', 'position']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'userid', 'username', 'department', 'position'],
          required: false,
        },
        {
          model: EmploymentContractTemplate,
          as: 'template',
          attributes: ['id', 'name', 'version', 'language', 'contract_type', 'content_html']
        },
        {
          model: EmploymentContractSignature,
          as: 'signatures',
          attributes: ['id', 'signer_type', 'signer_id', 'signed_at', 'sign_method']
        }
      ]
    });

    if (!contract) return res.status(404).json({ success: false, message: '전자근로계약을 찾을 수 없습니다.' });

    const isEmployee = Number(contract.employee_id) === Number(req.user.id);
    const isApprover = Number(contract.approver_id) === Number(req.user.id);
    if (!canViewEmploymentContracts(req) && !isEmployee && !isApprover) {
      return res.status(403).json({ success: false, message: '해당 계약을 조회할 권한이 없습니다.' });
    }
    if (
      isEmployee &&
      !canManageEmploymentContracts(req) &&
      !EMPLOYEE_VISIBLE_STATUSES.includes(normalizeStatus(contract.status))
    ) {
      return res.status(403).json({
        success: false,
        message: '승인 완료 후 계약서를 확인할 수 있습니다.',
      });
    }

    await writeAuditLog(req, 'contract_detail_view', {
      contractId: contract.id,
      companyId: contract.company_id
    });

    const contractJson = contract.toJSON();
    const renderedContentHtml = contractJson.template?.content_html
      ? renderTemplate(contractJson.template.content_html, buildTemplateVariables(contractJson))
      : null;

    return res.json({
      success: true,
      data: {
        ...contractJson,
        rendered_content_html: renderedContentHtml
      }
    });
  } catch (error) {
    console.error('전자근로계약 조회 오류:', error);
    return res.status(500).json({ success: false, message: '전자근로계약 조회 중 오류가 발생했습니다.' });
  }
};

export const createEmploymentContract = async (req: RequestWithUser, res: Response) => {
  try {
    if (!assertManagerPermission(req, res, '계약 생성')) return;

    const {
      employee_id,
      approver_id,
      template_id,
      title,
      contract_type = 'regular',
      start_date,
      end_date,
      salary,
      bonus_type,
      bonus_value,
      work_location,
      working_days,
      working_hours,
      probation_months,
      pdf_url,
      hash_sha256
    } = req.body || {};

    if (!employee_id || !title || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'employee_id, title, start_date, end_date는 필수입니다.' });
    }

    const requestedCompanyId = toIntOrNull(req.body?.company_id);
    const scope = await getScopedCompany(req, requestedCompanyId);
    if (!scope) return res.status(404).json({ success: false, message: '회사를 찾을 수 없습니다.' });
    if (req.user.role === 'root' && !scope.company_id) {
      return res.status(400).json({ success: false, message: 'root는 company_id를 지정해야 합니다.' });
    }

    const employee = await requireValidEmployee(Number(employee_id), scope.company_id);
    if (!employee) return res.status(404).json({ success: false, message: '해당 회사의 직원을 찾을 수 없습니다.' });

    let resolvedApproverId: number | null = toIntOrNull(approver_id);
    if (resolvedApproverId) {
      const approver = await requireValidEmployee(resolvedApproverId, scope.company_id);
      if (!approver) {
        return res.status(404).json({ success: false, message: '선택한 승인자를 찾을 수 없습니다.' });
      }
      if (resolvedApproverId === Number(employee_id)) {
        return res.status(400).json({ success: false, message: '근로 대상과 승인자는 달라야 합니다.' });
      }
    }

    if (template_id) {
      const template = await (EmploymentContractTemplate as any).findOne({
        where: {
          id: Number(template_id),
          tenant_id: scope.tenant_id,
          company_id: scope.company_id,
          is_active: true
        }
      });
      if (!template) {
        return res.status(404).json({ success: false, message: '선택한 템플릿을 찾을 수 없습니다.' });
      }
    }

    const created = await (EmploymentContract as any).create({
      tenant_id: scope.tenant_id,
      company_id: scope.company_id,
      employee_id: Number(employee_id),
      approver_id: resolvedApproverId,
      template_id: template_id ? Number(template_id) : null,
      title: String(title).trim(),
      contract_type: String(contract_type || 'regular'),
      status: 'draft',
      start_date: String(start_date),
      end_date: String(end_date),
      salary: salary !== undefined && salary !== null && salary !== '' ? Number(salary) : null,
      bonus_type: bonus_type ? String(bonus_type) : null,
      bonus_value: bonus_value !== undefined && bonus_value !== null && bonus_value !== '' ? Number(bonus_value) : null,
      work_location: work_location ? String(work_location) : null,
      working_days: working_days ? String(working_days) : null,
      working_hours: working_hours ? String(working_hours) : null,
      probation_months: probation_months ? Number(probation_months) : null,
      pdf_url: pdf_url ? String(pdf_url) : null,
      hash_sha256: hash_sha256 ? String(hash_sha256) : null,
      is_active: true,
      created_by: req.user.id,
      updated_by: req.user.id
    });

    await writeAuditLog(req, 'contract_create', {
      contractId: created.id,
      companyId: created.company_id,
      details: {
        employeeId: created.employee_id,
        templateId: created.template_id || null,
        after: buildContractAuditSnapshot(created)
      }
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('전자근로계약 생성 오류:', error);
    return res.status(500).json({ success: false, message: '전자근로계약 생성 중 오류가 발생했습니다.' });
  }
};

export const updateEmploymentContract = async (req: RequestWithUser, res: Response) => {
  try {
    if (!assertManagerPermission(req, res, '계약 수정')) return;

    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: '유효하지 않은 계약 ID입니다.' });

    const whereClause: any = { id, is_active: true };
    if (req.user.role !== 'root') {
      whereClause.tenant_id = req.user.tenant_id;
      whereClause.company_id = req.user.company_id;
    }

    const contract = await (EmploymentContract as any).findOne({ where: whereClause });
    if (!contract) return res.status(404).json({ success: false, message: '전자근로계약을 찾을 수 없습니다.' });
    const beforeSnapshot = buildContractAuditSnapshot(contract);

    const payload: any = { updated_by: req.user.id };
    const allowedFields = [
      'employee_id',
      'approver_id',
      'template_id',
      'title',
      'contract_type',
      'status',
      'start_date',
      'end_date',
      'salary',
      'bonus_type',
      'bonus_value',
      'work_location',
      'working_days',
      'working_hours',
      'probation_months',
      'pdf_url',
      'hash_sha256'
    ];
    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        payload[key] = req.body[key];
      }
    }

    const editableStatuses = new Set(['draft', 'rejected']);
    if (!editableStatuses.has(normalizeStatus(contract.status))) {
      const onlyStatus = Object.keys(payload).filter((k) => k !== 'updated_by');
      if (onlyStatus.some((k) => k !== 'status')) {
        return res.status(400).json({
          success: false,
          message: '초안/반려 상태에서만 계약 내용을 수정할 수 있습니다.',
        });
      }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'employee_id')) {
      const nextEmployeeId = toIntOrNull(payload.employee_id);
      if (!nextEmployeeId) {
        return res.status(400).json({ success: false, message: '유효하지 않은 직원입니다.' });
      }
      const employee = await requireValidEmployee(nextEmployeeId, contract.company_id);
      if (!employee) return res.status(404).json({ success: false, message: '해당 회사의 직원을 찾을 수 없습니다.' });
      payload.employee_id = nextEmployeeId;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'approver_id')) {
      const nextApproverId = toIntOrNull(payload.approver_id);
      if (nextApproverId) {
        const approver = await requireValidEmployee(nextApproverId, contract.company_id);
        if (!approver) {
          return res.status(404).json({ success: false, message: '선택한 승인자를 찾을 수 없습니다.' });
        }
        const employeeId = Object.prototype.hasOwnProperty.call(payload, 'employee_id')
          ? Number(payload.employee_id)
          : Number(contract.employee_id);
        if (nextApproverId === employeeId) {
          return res.status(400).json({ success: false, message: '근로 대상과 승인자는 달라야 합니다.' });
        }
        payload.approver_id = nextApproverId;
      } else {
        payload.approver_id = null;
      }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'salary')) {
      payload.salary = payload.salary === null || payload.salary === '' ? null : Number(payload.salary);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'bonus_value')) {
      payload.bonus_value = payload.bonus_value === null || payload.bonus_value === '' ? null : Number(payload.bonus_value);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'bonus_type')) {
      const normalizedBonusType =
        payload.bonus_type === null || payload.bonus_type === '' ? null : String(payload.bonus_type);
      if (normalizedBonusType && !['percent', 'fixed'].includes(normalizedBonusType)) {
        return res.status(400).json({ success: false, message: 'bonus_type은 percent 또는 fixed만 가능합니다.' });
      }
      payload.bonus_type = normalizedBonusType;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'probation_months')) {
      payload.probation_months =
        payload.probation_months === null || payload.probation_months === ''
          ? null
          : Number(payload.probation_months);
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'template_id')) {
      payload.template_id =
        payload.template_id === null || payload.template_id === '' ? null : Number(payload.template_id);
      if (payload.template_id) {
        const template = await (EmploymentContractTemplate as any).findOne({
          where: {
            id: payload.template_id,
            tenant_id: contract.tenant_id,
            company_id: contract.company_id,
            is_active: true
          }
        });
        if (!template) {
          return res.status(404).json({ success: false, message: '선택한 템플릿을 찾을 수 없습니다.' });
        }
      }
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
      const currentStatus = normalizeStatus(contract.status);
      const nextStatus = normalizeStatus(payload.status);
      const allowedNext = CONTRACT_STATUS_FLOW[currentStatus] || [currentStatus];
      if (!allowedNext.includes(nextStatus)) {
        return res.status(400).json({
          success: false,
          message: `상태 전이가 허용되지 않습니다. (${currentStatus} -> ${nextStatus})`
        });
      }
      if (IMMUTABLE_SIGN_STATUSES.has(nextStatus)) {
        return res.status(400).json({
          success: false,
          message: '서명 관련 상태 변경은 서명 API를 통해서만 가능합니다.'
        });
      }
      payload.status = nextStatus;
    }

    await contract.update(payload);

    const currentStatus = normalizeStatus(beforeSnapshot?.status);
    const nextStatus = normalizeStatus(contract.status);
    if (currentStatus !== nextStatus && nextStatus === 'active' && !contract.pdf_url) {
      const generated = await ensureEmploymentContractPdfStored(contract, req.user.id, 'company');
      await writeAuditLog(req, 'contract_auto_pdf_generate_on_active', {
        contractId: contract.id,
        companyId: contract.company_id,
        details: { pdf_url: generated.pdfUrl },
      });
    }
    const afterSnapshot = buildContractAuditSnapshot(contract);

    await writeAuditLog(req, 'contract_update', {
      contractId: contract.id,
      companyId: contract.company_id,
      details: {
        before: beforeSnapshot,
        after: afterSnapshot,
        changed_fields: extractChangedFields(beforeSnapshot, afterSnapshot),
        status_transition:
          normalizeStatus(beforeSnapshot?.status) !== normalizeStatus(afterSnapshot?.status)
            ? {
                from: normalizeStatus(beforeSnapshot?.status),
                to: normalizeStatus(afterSnapshot?.status)
              }
            : null
      }
    });

    return res.json({ success: true, data: contract });
  } catch (error) {
    console.error('전자근로계약 수정 오류:', error);
    return res.status(500).json({ success: false, message: '전자근로계약 수정 중 오류가 발생했습니다.' });
  }
};

export const deleteEmploymentContract = async (req: RequestWithUser, res: Response) => {
  try {
    if (!assertManagerPermission(req, res, '계약 삭제')) return;

    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: '유효하지 않은 계약 ID입니다.' });

    const whereClause: any = { id, is_active: true };
    if (req.user.role !== 'root') {
      whereClause.tenant_id = req.user.tenant_id;
      whereClause.company_id = req.user.company_id;
    }

    const contract = await (EmploymentContract as any).findOne({ where: whereClause });
    if (!contract) {
      return res.status(404).json({ success: false, message: '삭제할 계약을 찾을 수 없습니다.' });
    }

    const status = normalizeStatus(contract.status);
    if (!['draft', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '초안 또는 반려(승인 전) 상태의 계약만 삭제할 수 있습니다.',
      });
    }

    const deletedSnapshot = {
      id: contract.id,
      title: contract.title,
      employee_id: contract.employee_id,
      status: contract.status,
    };

    await contract.update({ is_active: false, updated_by: req.user.id });

    await writeAuditLog(req, 'contract_delete', {
      companyId: contract.company_id,
      details: deletedSnapshot,
    });

    return res.json({ success: true, message: '계약이 삭제되었습니다.' });
  } catch (error) {
    console.error('전자근로계약 삭제 오류:', error);
    return res.status(500).json({ success: false, message: '전자근로계약 삭제 중 오류가 발생했습니다.' });
  }
};

export const signEmploymentContract = async (req: RequestWithUser, res: Response) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: '유효하지 않은 계약 ID입니다.' });

    const whereClause: any = { id, is_active: true };
    if (req.user.role !== 'root') {
      whereClause.tenant_id = req.user.tenant_id;
      whereClause.company_id = req.user.company_id;
    }

    const contract = await (EmploymentContract as any).findOne({ where: whereClause });
    if (!contract) return res.status(404).json({ success: false, message: '전자근로계약을 찾을 수 없습니다.' });

    const signerType = req.body?.signer_type === 'company' ? 'company' : 'employee';
    if (signerType === 'employee' && req.user.role !== 'root' && Number(contract.employee_id) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: '본인 계약서만 직원 서명할 수 있습니다.' });
    }
    if (signerType === 'company' && req.user.role !== 'root' && !['admin'].includes(String(req.user.role))) {
      return res.status(403).json({ success: false, message: '회사 서명 권한이 없습니다.' });
    }

    const contractStatus = normalizeStatus(contract.status);
    if (['terminated', 'expired', 'active'].includes(contractStatus)) {
      return res.status(400).json({ success: false, message: `현재 상태(${contract.status})에서는 서명할 수 없습니다.` });
    }
    if (signerType === 'company' && !['in_review', 'awaiting_company_sign'].includes(contractStatus)) {
      return res.status(400).json({
        success: false,
        message: '회사 서명은 in_review 또는 awaiting_company_sign 상태에서만 가능합니다.'
      });
    }
    if (signerType === 'employee' && contractStatus !== 'awaiting_employee_sign') {
      return res.status(400).json({
        success: false,
        message: '직원 서명은 awaiting_employee_sign 상태에서만 가능합니다.'
      });
    }

    const existing = await (EmploymentContractSignature as any).findOne({
      where: {
        contract_id: contract.id,
        signer_type: signerType,
      }
    });
    if (existing) {
      return res.status(409).json({ success: false, message: `${signerType === 'company' ? '회사' : '직원'} 서명이 이미 완료되었습니다.` });
    }

    const requestedSignMethod = String(req.body?.sign_method || 'aadhaar_esign');
    const signMethod = requestedSignMethod === 'internal_ack' ? 'internal_ack' : 'aadhaar_esign';

    if (signMethod === 'aadhaar_esign') {
      return res.status(400).json({
        success: false,
        message:
          'Aadhaar eSign은 /aadhaar-esign/initiate → complete 흐름을 사용하세요. (ASP mock/live 연동)',
      });
    }

    let signatureData: string | null = req.body?.signature_data ? String(req.body.signature_data) : null;

    const signature = await (EmploymentContractSignature as any).create({
      contract_id: contract.id,
      signer_type: signerType,
      signer_id: req.user.id,
      signed_at: new Date(),
      sign_ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').slice(0, 64) || null,
      sign_method: signMethod,
      signature_data: signatureData
    });

    const updates: any = { updated_by: req.user.id };
    if (signerType === 'company') updates.company_signed_at = new Date();
    if (signerType === 'employee') updates.employee_signed_at = new Date();

    const allSigns = await (EmploymentContractSignature as any).findAll({
      where: { contract_id: contract.id },
      attributes: ['signer_type']
    });
    const hasCompanySign = allSigns.some((row: any) => row.signer_type === 'company') || signerType === 'company';
    const hasEmployeeSign = allSigns.some((row: any) => row.signer_type === 'employee') || signerType === 'employee';
    if (hasCompanySign && hasEmployeeSign) {
      updates.status = 'signed';
    } else if (signerType === 'company') {
      updates.status = 'awaiting_employee_sign';
    } else {
      updates.status = 'awaiting_company_sign';
    }

    if (hasCompanySign && hasEmployeeSign) {
      const built = await buildContractPdfSnapshot(contract.id, 'signed');
      if (built) {
        const nextContractSnapshot = {
          ...built.snapshot,
          ...updates,
          status: 'signed',
        };
        const generated = await createEmploymentContractPdf(
          nextContractSnapshot,
          signerType,
          req.user.id,
          built.signatures
        );
        updates.pdf_url = generated.pdfUrl;
        updates.hash_sha256 = generated.hashSha256;
      }
    }

    await contract.update(updates);

    await writeAuditLog(req, 'contract_sign', {
      contractId: contract.id,
      companyId: contract.company_id,
      details: {
        signerType,
        signerId: req.user.id,
        signMethod,
        status_after: contract.status
      }
    });

    return res.json({
      success: true,
      data: {
        contract,
        signature
      }
    });
  } catch (error) {
    console.error('전자근로계약 서명 오류:', error);
    return res.status(500).json({ success: false, message: '전자근로계약 서명 중 오류가 발생했습니다.' });
  }
};

export const sendEmploymentContractToEmployee = async (req: RequestWithUser, res: Response) => {
  try {
    if (!assertManagerPermission(req, res, '계약 발송')) return;

    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: '유효하지 않은 계약 ID입니다.' });

    const whereClause: any = { id };
    if (req.user.role !== 'root') {
      whereClause.tenant_id = req.user.tenant_id;
      whereClause.company_id = req.user.company_id;
    }

    const contract = await (EmploymentContract as any).findOne({ where: whereClause });
    if (!contract) return res.status(404).json({ success: false, message: '전자근로계약을 찾을 수 없습니다.' });

    const contractStatus = normalizeStatus(contract.status);
    if (!['draft', 'in_review'].includes(contractStatus)) {
      return res.status(400).json({
        success: false,
        message: '초안 또는 검토중 상태의 계약만 직원에게 보낼 수 있습니다.'
      });
    }

    const existingCompanySign = await (EmploymentContractSignature as any).findOne({
      where: { contract_id: contract.id, signer_type: 'company' }
    });
    if (!existingCompanySign) {
      await (EmploymentContractSignature as any).create({
        contract_id: contract.id,
        signer_type: 'company',
        signer_id: req.user.id,
        signed_at: new Date(),
        sign_ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').slice(0, 64) || null,
        sign_method: 'internal_ack',
        signature_data: JSON.stringify({
          provider: 'company_send',
          sent_by: req.user.id,
          sent_at: new Date().toISOString()
        })
      });
    }

    await contract.update({
      status: 'awaiting_employee_sign',
      company_signed_at: contract.company_signed_at || new Date(),
      updated_by: req.user.id
    });

    await writeAuditLog(req, 'contract_send_to_employee', {
      contractId: contract.id,
      companyId: contract.company_id,
      details: {
        employee_id: contract.employee_id,
        status_after: 'awaiting_employee_sign'
      }
    });

    return res.json({
      success: true,
      message: '직원에게 계약서가 발송되었습니다.',
      data: contract
    });
  } catch (error) {
    console.error('전자근로계약 발송 오류:', error);
    return res.status(500).json({ success: false, message: '계약 발송 중 오류가 발생했습니다.' });
  }
};

export const getMyEmploymentContracts = async (req: RequestWithUser, res: Response) => {
  try {
    const status = req.query.status ? String(req.query.status) : '';
    const whereClause: any = {
      employee_id: req.user.id,
      is_active: true,
      status: status || EMPLOYEE_VISIBLE_STATUSES,
    };

    if (req.user.role !== 'root') {
      whereClause.tenant_id = req.user.tenant_id;
      whereClause.company_id = req.user.company_id;
    }
    if (status) {
      if (!EMPLOYEE_VISIBLE_STATUSES.includes(normalizeStatus(status))) {
        return res.json({ success: true, data: [] });
      }
      whereClause.status = status;
    }

    const contracts = await (EmploymentContract as any).findAll({
      where: whereClause,
      include: [
        {
          model: EmploymentContractTemplate,
          as: 'template',
          attributes: ['id', 'name', 'version', 'language']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'userid', 'username'],
          required: false,
        },
      ],
      order: [['updated_at', 'DESC']]
    });

    await writeAuditLog(req, 'my_contract_list_view', {
      details: { count: contracts.length, status: status || null }
    });

    return res.json({ success: true, data: contracts });
  } catch (error) {
    console.error('내 전자근로계약 조회 오류:', error);
    return res.status(500).json({ success: false, message: '내 전자근로계약 조회 중 오류가 발생했습니다.' });
  }
};

/** GET /api/hr/employment-contracts/pending-approvals */
export const getPendingApprovalContracts = async (req: RequestWithUser, res: Response) => {
  try {
    const whereClause: any = {
      approver_id: req.user.id,
      status: ['pending_approval', 'in_review'],
      is_active: true,
    };
    if (req.user.role !== 'root') {
      whereClause.tenant_id = req.user.tenant_id;
      whereClause.company_id = req.user.company_id;
    }

    const contracts = await (EmploymentContract as any).findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'employee',
          attributes: ['id', 'userid', 'username', 'department', 'position'],
        },
        {
          model: EmploymentContractTemplate,
          as: 'template',
          attributes: ['id', 'name', 'version', 'language'],
        },
      ],
      order: [['updated_at', 'DESC']],
    });

    return res.json({ success: true, data: contracts });
  } catch (error) {
    console.error('승인 대기 계약 목록 오류:', error);
    return res.status(500).json({ success: false, message: '승인 대기 목록 조회 중 오류가 발생했습니다.' });
  }
};

const findScopedActiveContract = async (req: RequestWithUser, id: number) => {
  const whereClause: any = { id, is_active: true };
  if (!canSelectOtherCompany(req.user.role)) {
    whereClause.tenant_id = req.user.tenant_id;
    whereClause.company_id = req.user.company_id;
  } else {
    whereClause.tenant_id = req.user.tenant_id;
  }
  return (EmploymentContract as any).findOne({ where: whereClause });
};

export const submitEmploymentContractForApproval = async (req: RequestWithUser, res: Response) => {
  try {
    if (!assertManagerPermission(req, res, '승인 제출')) return;
    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: '유효하지 않은 계약 ID입니다.' });

    const contract = await findScopedActiveContract(req, id);
    if (!contract) return res.status(404).json({ success: false, message: '전자근로계약을 찾을 수 없습니다.' });

    const status = normalizeStatus(contract.status);
    if (!['draft', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: '초안 또는 반려 상태의 계약만 승인 요청할 수 있습니다.' });
    }
    if (!contract.approver_id) {
      return res.status(400).json({ success: false, message: '승인자를 먼저 지정해 주세요.' });
    }
    if (!contract.employee_id || !contract.template_id || !contract.title || !contract.start_date || !contract.end_date) {
      return res.status(400).json({ success: false, message: '근로 대상·템플릿·기본 정보가 필요합니다.' });
    }

    await contract.update({
      status: 'pending_approval',
      rejection_reason: null,
      updated_by: req.user.id,
    });

    await writeAuditLog(req, 'contract_submit_approval', {
      contractId: contract.id,
      companyId: contract.company_id,
      details: { approver_id: contract.approver_id, status_after: 'pending_approval' },
    });

    const socketService = (req as any).socketService as SocketService | undefined;
    const approverId = Number(contract.approver_id);
    if (Number.isFinite(approverId) && approverId > 0 && approverId !== Number(req.user.id)) {
      const titleKo = String(contract.title || '전자근로계약');
      pushNotification(
        {
          title: '전자근로계약 승인 요청',
          message: `${titleKo} 승인 요청이 있습니다.`,
          type: 'warning',
          target_type: 'user',
          target_id: approverId,
          tenant_id: contract.tenant_id,
          company_id: contract.company_id,
          sender_user_id: req.user.id,
          data: {
            feature: 'employment_contract',
            contract_id: contract.id,
            href: '/hr/employment-contracts',
            title_en: 'Employment contract approval requested',
            message_en: `Approval requested for ${titleKo}.`,
          },
        },
        socketService
      );
    }

    return res.json({
      success: true,
      message: '승인자에게 제출했습니다.',
      data: contract,
    });
  } catch (error) {
    console.error('전자근로계약 승인 제출 오류:', error);
    return res.status(500).json({ success: false, message: '승인 제출 중 오류가 발생했습니다.' });
  }
};

export const approveEmploymentContract = async (req: RequestWithUser, res: Response) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: '유효하지 않은 계약 ID입니다.' });

    const contract = await findScopedActiveContract(req, id);
    if (!contract) return res.status(404).json({ success: false, message: '전자근로계약을 찾을 수 없습니다.' });

    const isApprover = Number(contract.approver_id) === Number(req.user.id);
    if (!isApprover) {
      return res.status(403).json({ success: false, message: '지정된 승인자만 승인할 수 있습니다.' });
    }

    const status = normalizeStatus(contract.status);
    if (!['pending_approval', 'in_review'].includes(status)) {
      return res.status(400).json({ success: false, message: '승인 대기 상태의 계약만 승인할 수 있습니다.' });
    }

    const existingCompanySign = await (EmploymentContractSignature as any).findOne({
      where: { contract_id: contract.id, signer_type: 'company' },
    });
    if (!existingCompanySign) {
      await (EmploymentContractSignature as any).create({
        contract_id: contract.id,
        signer_type: 'company',
        signer_id: req.user.id,
        signed_at: new Date(),
        sign_ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').slice(0, 64) || null,
        sign_method: 'internal_ack',
        signature_data: JSON.stringify({
          provider: 'approver_approve',
          approved_by: req.user.id,
          approved_at: new Date().toISOString(),
        }),
      });
    }

    await contract.update({
      status: 'awaiting_employee_sign',
      approved_at: new Date(),
      company_signed_at: contract.company_signed_at || new Date(),
      rejection_reason: null,
      updated_by: req.user.id,
    });

    await writeAuditLog(req, 'contract_approve', {
      contractId: contract.id,
      companyId: contract.company_id,
      details: { status_after: 'awaiting_employee_sign' },
    });

    const socketService = (req as any).socketService as SocketService | undefined;
    const employeeId = Number(contract.employee_id);
    if (Number.isFinite(employeeId) && employeeId > 0 && employeeId !== Number(req.user.id)) {
      const titleKo = String(contract.title || '전자근로계약');
      pushNotification(
        {
          title: '전자근로계약 서명 요청',
          message: `${titleKo} 서명이 필요합니다.`,
          type: 'warning',
          target_type: 'user',
          target_id: employeeId,
          tenant_id: contract.tenant_id,
          company_id: contract.company_id,
          sender_user_id: req.user.id,
          data: {
            feature: 'employment_contract',
            contract_id: contract.id,
            href: '/my/contracts',
            title_en: 'Employment contract signature requested',
            message_en: `Your signature is required for ${titleKo}.`,
          },
        },
        socketService
      );
    }

    return res.json({
      success: true,
      message: '승인되었습니다. 근로자 내 계약서에 표시됩니다.',
      data: contract,
    });
  } catch (error) {
    console.error('전자근로계약 승인 오류:', error);
    return res.status(500).json({ success: false, message: '승인 처리 중 오류가 발생했습니다.' });
  }
};

export const rejectEmploymentContractApproval = async (req: RequestWithUser, res: Response) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: '유효하지 않은 계약 ID입니다.' });

    const contract = await findScopedActiveContract(req, id);
    if (!contract) return res.status(404).json({ success: false, message: '전자근로계약을 찾을 수 없습니다.' });

    const isApprover = Number(contract.approver_id) === Number(req.user.id);
    if (!isApprover) {
      return res.status(403).json({ success: false, message: '지정된 승인자만 반려할 수 있습니다.' });
    }

    const status = normalizeStatus(contract.status);
    if (!['pending_approval', 'in_review'].includes(status)) {
      return res.status(400).json({ success: false, message: '승인 대기 상태의 계약만 반려할 수 있습니다.' });
    }

    const reason = String(req.body?.rejection_reason || '').trim().slice(0, 500);
    const notifyTargetId = Number(contract.created_by || contract.updated_by);
    await contract.update({
      status: 'rejected',
      rejection_reason: reason || null,
      updated_by: req.user.id,
    });

    await writeAuditLog(req, 'contract_reject_approval', {
      contractId: contract.id,
      companyId: contract.company_id,
      details: { rejection_reason: reason || null },
    });

    const socketService = (req as any).socketService as SocketService | undefined;
    if (Number.isFinite(notifyTargetId) && notifyTargetId > 0 && notifyTargetId !== Number(req.user.id)) {
      const titleKo = String(contract.title || '전자근로계약');
      pushNotification(
        {
          title: '전자근로계약 반려',
          message: reason
            ? `${titleKo}이(가) 반려되었습니다. 사유: ${reason}`
            : `${titleKo}이(가) 반려되었습니다.`,
          type: 'error',
          target_type: 'user',
          target_id: notifyTargetId,
          tenant_id: contract.tenant_id,
          company_id: contract.company_id,
          sender_user_id: req.user.id,
          data: {
            feature: 'employment_contract',
            contract_id: contract.id,
            href: '/hr/employment-contracts',
            title_en: 'Employment contract rejected',
            message_en: reason
              ? `${titleKo} was rejected. Reason: ${reason}`
              : `${titleKo} was rejected.`,
          },
        },
        socketService
      );
    }

    return res.json({
      success: true,
      message: '계약이 반려되었습니다.',
      data: contract,
    });
  } catch (error) {
    console.error('전자근로계약 반려 오류:', error);
    return res.status(500).json({ success: false, message: '반려 처리 중 오류가 발생했습니다.' });
  }
};

export const completeEmploymentContract = async (req: RequestWithUser, res: Response) => {
  try {
    if (!assertManagerPermission(req, res, '계약 완료')) return;
    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: '유효하지 않은 계약 ID입니다.' });

    const contract = await findScopedActiveContract(req, id);
    if (!contract) return res.status(404).json({ success: false, message: '전자근로계약을 찾을 수 없습니다.' });

    if (normalizeStatus(contract.status) !== 'signed') {
      return res.status(400).json({ success: false, message: '서명 완료 상태의 계약만 완료 처리할 수 있습니다.' });
    }

    const updates: any = { status: 'active', updated_by: req.user.id };
    const pdfInfo = await ensureEmploymentContractPdfStored(contract, req.user.id, 'company');
    updates.pdf_url = pdfInfo.pdfUrl;
    updates.hash_sha256 = pdfInfo.hashSha256;
    await contract.update(updates);

    await writeAuditLog(req, 'contract_complete', {
      contractId: contract.id,
      companyId: contract.company_id,
      details: { status_after: 'active' },
    });

    return res.json({ success: true, message: '계약이 완료(활성) 처리되었습니다.', data: contract });
  } catch (error) {
    console.error('전자근로계약 완료 오류:', error);
    return res.status(500).json({ success: false, message: '완료 처리 중 오류가 발생했습니다.' });
  }
};

export const getEmploymentContractAuditLogs = async (req: RequestWithUser, res: Response) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: '유효하지 않은 계약 ID입니다.' });

    const whereClause: any = { id };
    if (!canSelectOtherCompany(req.user.role)) {
      whereClause.tenant_id = req.user.tenant_id;
      whereClause.company_id = req.user.company_id;
    } else {
      whereClause.tenant_id = req.user.tenant_id;
    }

    const contract = await (EmploymentContract as any).findOne({ where: whereClause, attributes: ['id', 'employee_id', 'company_id'] });
    if (!contract) return res.status(404).json({ success: false, message: '전자근로계약을 찾을 수 없습니다.' });

    if (!canViewEmploymentContracts(req) && Number(contract.employee_id) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: '감사로그 조회 권한이 없습니다.' });
    }

    const rawLimit = toIntOrNull(req.query.limit);
    const limit = rawLimit ? Math.min(Math.max(rawLimit, 1), 200) : 100;
    const rows = await (EmploymentContractAuditLog as any).findAll({
      where: { contract_id: contract.id },
      include: [
        {
          model: User,
          as: 'actor',
          attributes: ['id', 'userid', 'username', 'role'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']],
      limit
    });

    await writeAuditLog(req, 'contract_audit_log_view', {
      contractId: contract.id,
      companyId: contract.company_id,
      details: { count: rows.length }
    });

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('전자근로계약 감사로그 조회 오류:', error);
    return res.status(500).json({ success: false, message: '감사로그 조회 중 오류가 발생했습니다.' });
  }
};

/** GET /api/hr/employment-contracts/:id/pdf — 서명 포함 PDF 다운로드(없으면 생성 후 저장) */
export const downloadEmploymentContractPdf = async (req: RequestWithUser, res: Response) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: '유효하지 않은 계약 ID입니다.' });

    const whereClause: any = { id, is_active: true };
    if (!canSelectOtherCompany(req.user.role)) {
      whereClause.tenant_id = req.user.tenant_id;
      whereClause.company_id = req.user.company_id;
    } else {
      whereClause.tenant_id = req.user.tenant_id;
    }

    const contract = await (EmploymentContract as any).findOne({ where: whereClause });
    if (!contract) return res.status(404).json({ success: false, message: '전자근로계약을 찾을 수 없습니다.' });

    const isEmployee = Number(contract.employee_id) === Number(req.user.id);
    const isApprover = Number(contract.approver_id) === Number(req.user.id);
    if (!canViewEmploymentContracts(req) && !isEmployee && !isApprover) {
      return res.status(403).json({ success: false, message: 'PDF 다운로드 권한이 없습니다.' });
    }

    const status = normalizeStatus(contract.status);
    if (!['signed', 'active', 'expired'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '서명 완료된 계약만 PDF로 다운로드할 수 있습니다.',
      });
    }

    // 서명 블록이 포함된 PDF를 생성·저장한 뒤 다운로드
    await ensureEmploymentContractPdfStored(contract, req.user.id, isEmployee ? 'employee' : 'company', true);
    await contract.reload();

    const filePath = resolveStoredUploadFile(null, contract.pdf_url);
    if (!filePath) {
      return res.status(404).json({ success: false, message: 'PDF 파일을 찾을 수 없습니다.' });
    }

    try {
      const st = await fs.promises.stat(filePath);
      if (!st.isFile() || st.size < 64) {
        return res.status(404).json({ success: false, message: 'PDF 파일이 손상되었거나 비어 있습니다.' });
      }
      const fd = await fs.promises.open(filePath, 'r');
      try {
        const header = Buffer.alloc(5);
        await fd.read(header, 0, 5, 0);
        if (header.toString('utf8') !== '%PDF-') {
          return res.status(404).json({ success: false, message: 'PDF 파일이 손상되었습니다.' });
        }
      } finally {
        await fd.close();
      }
    } catch {
      return res.status(404).json({ success: false, message: 'PDF 파일을 읽을 수 없습니다.' });
    }

    const rawTitle = String(contract.title || `contract-${contract.id}`)
      .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
      .trim()
      .slice(0, 80);
    const asciiTitle =
      rawTitle
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '') || `contract-${contract.id}`;
    const downloadNameAscii = `EmploymentContract-${contract.id}-${asciiTitle}.pdf`;
    const downloadNameUtf8 = `EmploymentContract-${contract.id}-${rawTitle || asciiTitle}.pdf`;

    await writeAuditLog(req, 'contract_pdf_download', {
      contractId: contract.id,
      companyId: contract.company_id,
      details: { pdf_url: contract.pdf_url, hash_sha256: contract.hash_sha256 },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${downloadNameAscii}"; filename*=UTF-8''${encodeURIComponent(downloadNameUtf8)}`
    );
    return fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('전자근로계약 PDF 다운로드 오류:', error);
    return res.status(500).json({ success: false, message: 'PDF 다운로드 중 오류가 발생했습니다.' });
  }
};

const applyContractSignatureAndMaybePdf = async (
  req: RequestWithUser,
  contract: any,
  params: {
    signerType: 'company' | 'employee';
    signMethod: string;
    signatureData: string | null;
  }
) => {
  const existing = await (EmploymentContractSignature as any).findOne({
    where: { contract_id: contract.id, signer_type: params.signerType },
  });
  if (existing) {
    return { conflict: true as const, message: `${params.signerType === 'company' ? '회사' : '직원'} 서명이 이미 완료되었습니다.` };
  }

  const signature = await (EmploymentContractSignature as any).create({
    contract_id: contract.id,
    signer_type: params.signerType,
    signer_id: req.user.id,
    signed_at: new Date(),
    sign_ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').slice(0, 64) || null,
    sign_method: params.signMethod,
    signature_data: params.signatureData,
  });

  const updates: any = { updated_by: req.user.id };
  if (params.signerType === 'company') updates.company_signed_at = new Date();
  if (params.signerType === 'employee') updates.employee_signed_at = new Date();

  const allSigns = await (EmploymentContractSignature as any).findAll({
    where: { contract_id: contract.id },
    attributes: ['signer_type'],
  });
  const hasCompanySign =
    allSigns.some((row: any) => row.signer_type === 'company') || params.signerType === 'company';
  const hasEmployeeSign =
    allSigns.some((row: any) => row.signer_type === 'employee') || params.signerType === 'employee';
  if (hasCompanySign && hasEmployeeSign) {
    updates.status = 'signed';
  } else if (params.signerType === 'company') {
    updates.status = 'awaiting_employee_sign';
  } else {
    updates.status = 'awaiting_company_sign';
  }

  if (hasCompanySign && hasEmployeeSign) {
    const built = await buildContractPdfSnapshot(contract.id, 'signed');
    if (built) {
      const generated = await createEmploymentContractPdf(
        { ...built.snapshot, ...updates, status: 'signed' },
        params.signerType,
        req.user.id,
        built.signatures
      );
      updates.pdf_url = generated.pdfUrl;
      updates.hash_sha256 = generated.hashSha256;
    }
  }

  await contract.update(updates);
  await writeAuditLog(req, 'contract_sign', {
    contractId: contract.id,
    companyId: contract.company_id,
    details: {
      signerType: params.signerType,
      signerId: req.user.id,
      signMethod: params.signMethod,
      status_after: updates.status,
    },
  });

  return { conflict: false as const, signature, contract, status_after: updates.status };
};

/** GET /api/hr/employment-contracts/aadhaar-esign/config */
export const getAadhaarEsignConfig = async (_req: RequestWithUser, res: Response) => {
  const mode = getAadhaarEsignMode();
  return res.json({
    success: true,
    data: {
      mode,
      provider: getAadhaarEsignProviderName(),
      live_ready: mode === 'live',
      mock_otp_required: mode === 'mock',
      note:
        mode === 'mock'
          ? 'Development mock ASP. Enter any 6-digit OTP after initiate.'
          : 'Live ASP mode. User will be redirected to the ASP authentication page.',
    },
  });
};

/** POST /api/hr/employment-contracts/:id/aadhaar-esign/initiate */
export const initiateAadhaarEsign = async (req: RequestWithUser, res: Response) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: '유효하지 않은 계약 ID입니다.' });

    const whereClause: any = { id, is_active: true };
    if (req.user.role !== 'root') {
      whereClause.tenant_id = req.user.tenant_id;
      whereClause.company_id = req.user.company_id;
    }
    const contract = await (EmploymentContract as any).findOne({
      where: whereClause,
      include: [{ model: User, as: 'employee', attributes: ['id', 'username'], required: false }],
    });
    if (!contract) return res.status(404).json({ success: false, message: '전자근로계약을 찾을 수 없습니다.' });

    const signerType = req.body?.signer_type === 'company' ? 'company' : 'employee';
    if (signerType === 'employee' && req.user.role !== 'root' && Number(contract.employee_id) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: '본인 계약서만 직원 서명할 수 있습니다.' });
    }
    if (normalizeStatus(contract.status) !== 'awaiting_employee_sign' && signerType === 'employee') {
      return res.status(400).json({ success: false, message: '직원 서명은 awaiting_employee_sign 상태에서만 가능합니다.' });
    }

    const consent = req.body?.aadhaar_consent === true || String(req.body?.aadhaar_consent || '') === 'true';
    const aadhaarLast4 = String(req.body?.aadhaar_last4 || '').trim();
    if (!consent) return res.status(400).json({ success: false, message: 'Aadhaar eSign 동의가 필요합니다.' });
    if (!/^\d{4}$/.test(aadhaarLast4)) {
      return res.status(400).json({ success: false, message: 'Aadhaar 마지막 4자리를 정확히 입력해 주세요.' });
    }

    const existingSign = await (EmploymentContractSignature as any).findOne({
      where: { contract_id: contract.id, signer_type: signerType },
    });
    if (existingSign) {
      return res.status(409).json({ success: false, message: '이미 서명이 완료된 계약입니다.' });
    }

    await (EmploymentContractEsignSession as any).update(
      { status: 'cancelled', updated_at: new Date() },
      {
        where: {
          contract_id: contract.id,
          signer_id: req.user.id,
          status: { [Op.in]: ['initiated', 'pending'] },
        },
      }
    );

    const sessionToken = createSessionToken();
    const documentHash = buildDocumentHash([
      contract.id,
      contract.title,
      contract.start_date,
      contract.end_date,
      contract.salary,
      contract.employee_id,
      contract.updated_at,
    ]);
    const returnUrl =
      String(req.body?.return_url || '').trim() ||
      `${String(req.headers.origin || '').replace(/\/$/, '')}/hr/employment-contracts`;

    const asp = await initiateAspEsign({
      contractId: contract.id,
      sessionToken,
      documentHash,
      signerName: String((contract as any).employee?.username || req.user.username || req.user.id),
      aadhaarLast4,
      returnUrl,
      companyId: contract.company_id,
    });

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const session = await (EmploymentContractEsignSession as any).create({
      contract_id: contract.id,
      tenant_id: contract.tenant_id,
      company_id: contract.company_id,
      signer_type: signerType,
      signer_id: req.user.id,
      provider: asp.provider,
      mode: getAadhaarEsignMode(),
      session_token: sessionToken,
      asp_txn_id: asp.aspTxnId,
      status: 'pending',
      document_hash: documentHash,
      aadhaar_last4: aadhaarLast4,
      consent_at: new Date(),
      redirect_url: asp.redirectUrl,
      return_url: returnUrl,
      expires_at: expiresAt,
      created_by: req.user.id,
    });

    await writeAuditLog(req, 'contract_aadhaar_esign_initiate', {
      contractId: contract.id,
      companyId: contract.company_id,
      details: {
        session_id: session.id,
        provider: asp.provider,
        mode: getAadhaarEsignMode(),
        asp_txn_id: asp.aspTxnId,
      },
    });

    return res.json({
      success: true,
      data: {
        session_id: session.id,
        session_token: sessionToken,
        asp_txn_id: asp.aspTxnId,
        mode: getAadhaarEsignMode(),
        provider: asp.provider,
        redirect_url: asp.redirectUrl,
        requires_mock_otp: asp.requiresMockOtp,
        expires_at: expiresAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Aadhaar eSign initiate 오류:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Aadhaar eSign 시작 중 오류가 발생했습니다.',
    });
  }
};

/** POST /api/hr/employment-contracts/aadhaar-esign/complete */
export const completeAadhaarEsign = async (req: RequestWithUser, res: Response) => {
  try {
    const sessionToken = String(req.body?.session_token || '').trim();
    if (!sessionToken) {
      return res.status(400).json({ success: false, message: 'session_token이 필요합니다.' });
    }

    const session = await (EmploymentContractEsignSession as any).findOne({
      where: { session_token: sessionToken },
    });
    if (!session) return res.status(404).json({ success: false, message: 'eSign 세션을 찾을 수 없습니다.' });
    if (Number(session.signer_id) !== Number(req.user.id) && req.user.role !== 'root') {
      return res.status(403).json({ success: false, message: '본인 세션만 완료할 수 있습니다.' });
    }
    if (['completed', 'cancelled'].includes(String(session.status))) {
      return res.status(409).json({ success: false, message: '이미 처리된 세션입니다.' });
    }
    if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
      await session.update({ status: 'expired' });
      return res.status(400).json({ success: false, message: '세션이 만료되었습니다. 다시 시작해 주세요.' });
    }

    const whereClause: any = { id: session.contract_id, is_active: true };
    if (req.user.role !== 'root') {
      whereClause.tenant_id = req.user.tenant_id;
      whereClause.company_id = req.user.company_id;
    }
    const contract = await (EmploymentContract as any).findOne({ where: whereClause });
    if (!contract) return res.status(404).json({ success: false, message: '전자근로계약을 찾을 수 없습니다.' });

    const aspResult = await completeAspEsign({
      aspTxnId: String(session.asp_txn_id || ''),
      sessionToken,
      mockOtp: String(req.body?.mock_otp || '').trim() || undefined,
      callbackPayload: req.body?.callback_payload && typeof req.body.callback_payload === 'object'
        ? req.body.callback_payload
        : undefined,
    });

    if (!aspResult.success) {
      await session.update({
        status: 'failed',
        error_code: aspResult.errorCode || 'ASP_FAILED',
        error_message: aspResult.errorMessage || 'ASP 서명 실패',
        callback_payload: JSON.stringify(aspResult.raw || {}),
      });
      return res.status(400).json({
        success: false,
        message: aspResult.errorMessage || 'Aadhaar eSign 인증에 실패했습니다.',
        data: { error_code: aspResult.errorCode },
      });
    }

    const signatureData = JSON.stringify({
      provider: session.provider || 'aadhaar_esign',
      mode: session.mode,
      consent: true,
      aadhaar_last4: session.aadhaar_last4,
      auth_reference: session.asp_txn_id,
      certificate_ref: aspResult.certificateRef || null,
      signed_hash: aspResult.signedHash || session.document_hash,
      verified_at: new Date().toISOString(),
      asp_raw: aspResult.raw || null,
    });

    const applied = await applyContractSignatureAndMaybePdf(req, contract, {
      signerType: session.signer_type === 'company' ? 'company' : 'employee',
      signMethod: 'aadhaar_esign',
      signatureData,
    });
    if (applied.conflict) {
      await session.update({ status: 'completed', completed_at: new Date() });
      return res.status(409).json({ success: false, message: applied.message });
    }

    await session.update({
      status: 'completed',
      completed_at: new Date(),
      callback_payload: JSON.stringify(aspResult.raw || {}),
      error_code: null,
      error_message: null,
    });

    return res.json({
      success: true,
      message: 'Aadhaar eSign 서명이 완료되었습니다.',
      data: {
        session_id: session.id,
        contract: applied.contract,
        signature: applied.signature,
        status_after: applied.status_after,
      },
    });
  } catch (error: any) {
    console.error('Aadhaar eSign complete 오류:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Aadhaar eSign 완료 중 오류가 발생했습니다.',
    });
  }
};

