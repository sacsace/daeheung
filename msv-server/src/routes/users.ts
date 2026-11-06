import express from 'express';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import bcrypt from 'bcrypt';
import { User, Company, Tenant } from '../models';
import {
  decideSalaryChange,
  isEligibleSalaryApprover,
  listPendingSalaryChanges,
  listSalaryApprovers,
  listSalaryHistory,
  queueSalaryChange,
  recordApprovedSalaryChange,
  recordInitialSalary,
  salariesEqual,
} from '../controllers/salaryChangeController';
import { resolveDepartmentFieldsForUser, resolveDepartmentFieldsByName } from '../controllers/departmentController';
import { resolvePositionFieldsForUser, resolvePositionFieldsByName } from '../controllers/positionController';
import { authenticateToken } from '../middleware/auth';
import { requireAdminRootOrUserMenuPermission } from '../middleware/menuPermission';
import { getUserUiPreferences, patchUserUiPreferences } from '../controllers/userUiPreferencesController';
import {
  getMyMailServer,
  patchMyMailServer,
  testMyMailServer,
} from '../controllers/userMailServerController';
import { validateBody } from '../middleware/validate';
import { invalidateAuthUser } from '../utils/authCache';
import multer from 'multer';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';
import { ensureUploadSubdir } from '../utils/uploadPath';
import { grantEmployeeSelfServicePermissions } from '../utils/employeeSelfServicePermissions';
import { parseExcelDateOnlyField } from '../utils/parseExcelDateOnly';

let userListHrFieldsAvailable: boolean | null = null;

/** user < admin < audit < root. audit/root 부여는 root만. */
const ROLE_RANK: Record<string, number> = {
  user: 1,
  admin: 2,
  audit: 3,
  root: 4,
};

function isPurgedUser(user: { settings?: unknown }): boolean {
  const settings = user?.settings;
  if (!settings || typeof settings !== 'object') return false;
  return Boolean((settings as { purged_at?: unknown }).purged_at);
}

/** 영구 삭제된 계정은 목록·보내기에서 제외. 행은 급여·근태 FK를 위해 남긴다. */
function excludePurgedUsers(whereClause: any) {
  const existing = whereClause[Op.and];
  const parts = Array.isArray(existing) ? existing : existing ? [existing] : [];
  whereClause[Op.and] = [
    ...parts,
    sequelize.literal(`COALESCE("User"."settings"->>'purged_at', '') = ''`),
  ];
}

function releasedLoginIdentity(userId: number) {
  const stamp = Date.now().toString(36);
  return {
    userid: `p${userId}x${stamp}`.slice(0, 50),
    email: `purged.${userId}.${stamp}@example.com`,
  };
}

function canAssignRole(actorRole: string | undefined, targetRole: string | undefined): boolean {
  if (!targetRole) return true;
  const actor = String(actorRole || '').toLowerCase();
  const target = String(targetRole).toLowerCase();
  if (target === 'root' || target === 'audit') return actor === 'root';
  return (ROLE_RANK[actor] || 0) >= (ROLE_RANK[target] || 0);
}

/** 사용자 Excel 내보내기 컬럼 순서 (json_to_sheet와 동일) */
const USER_EXCEL_EXPORT_COLUMNS = [
  '사원번호',
  '사용자ID',
  '이름',
  '이메일',
  '비밀번호',
  '역할 (root/admin/user/audit)',
  '부서',
  '직책',
  '생년월일 (YYYY-MM-DD)',
  '성별 (male/female/other)',
  '전화번호',
  '주소',
  '비상연락처',
  '비상연락처 전화번호',
  '입사일 (YYYY-MM-DD)',
  '고용형태 (fulltime/contract/parttime/intern/daily/service)',
  '급여',
  '은행명',
  '계좌번호',
  'IFSC 코드',
  '상태 (active/inactive/suspended)'
] as const;

const USER_EXCEL_EXPORT_COL_WIDTHS = [
  12, 12, 12, 25, 15, 20, 12, 12, 18, 15, 15, 30, 15, 20, 18, 25, 12, 18, 18, 14, 20
];

function normalizeExcelBankAccount(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\s/g, '').replace(/\D/g, '');
  return digits || null;
}

function normalizeExcelBankIfsc(raw: unknown): string | null {
  const value = String(raw ?? '')
    .replace(/\s/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 11);
  return value || null;
}

function normalizeExcelBankName(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  return value || null;
}

/** 사원번호(사번) — 항상 대문자로 저장 */
function normalizeEmployeeNumber(raw: unknown): string {
  return String(raw ?? '').trim().toUpperCase();
}

// bcrypt를 사용한 비밀번호 해싱 함수 (authController와 동일)
const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10);
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Multer 설정 (메모리 스토리지)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (allowedMimes.includes(file.mimetype) && allowedExtensions.includes(extension)) {
      cb(null, true);
    } else {
      cb(new Error('Excel 파일(.xlsx, .xls) 또는 CSV 파일만 업로드 가능합니다.'));
    }
  }
});

const userAvatarDir = ensureUploadSubdir('user-avatars');
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, userAvatarDir),
    filename: (req, file, cb) => {
      const userId =
        String(req.params.id || (req as any).user?.id || 'user').replace(/\D/g, '') || 'user';
      const originalExt = path.extname(file.originalname || '').toLowerCase();
      const extByMime: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif'
      };
      const ext = extByMime[file.mimetype] || originalExt || '.jpg';
      cb(null, `user_${userId}_${Date.now()}_${randomBytes(6).toString('hex')}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    if (allowed.has(file.mimetype)) return cb(null, true);
    cb(new Error('JPG, PNG, WEBP 또는 GIF 이미지 파일만 업로드할 수 있습니다.'));
  }
});

const careerCertificateDir = ensureUploadSubdir('career-certificates');
const careerCertificateUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, careerCertificateDir),
    filename: (req, file, cb) => {
      const userId = String(req.params.id || 'user').replace(/\D/g, '') || 'user';
      const ext = path.extname(file.originalname || '').toLowerCase() || '.pdf';
      cb(null, `career_${userId}_${Date.now()}_${randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowed = new Set(['.pdf', '.jpg', '.jpeg', '.png']);
    if (allowed.has(ext)) return cb(null, true);
    cb(new Error('경력증명서는 PDF, JPG 또는 PNG 파일만 업로드할 수 있습니다.'));
  },
});

const certificateCopyDir = ensureUploadSubdir('certificate-copies');
const certificateCopyUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, certificateCopyDir),
    filename: (req, file, cb) => {
      const userId = String(req.params.id || 'user').replace(/\D/g, '') || 'user';
      const ext = path.extname(file.originalname || '').toLowerCase() || '.pdf';
      cb(null, `cert_${userId}_${Date.now()}_${randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowed = new Set(['.pdf', '.jpg', '.jpeg', '.png']);
    if (allowed.has(ext)) return cb(null, true);
    cb(new Error('자격증 사본은 PDF, JPG 또는 PNG 파일만 업로드할 수 있습니다.'));
  },
});

// 회사명에서 약자 추출 함수
const getCompanyAbbreviation = (companyName: string): string => {
  if (!companyName) return 'COMP';
  
  // 공백 제거
  const cleaned = companyName.trim();
  
  // 한글과 영문이 혼합된 경우 처리
  const koreanRegex = /[가-힣]/g;
  const englishRegex = /[A-Za-z]/g;
  
  const koreanChars = cleaned.match(koreanRegex) || [];
  const englishChars = cleaned.match(englishRegex) || [];
  
  let abbreviation = '';
  
  // 한글이 있으면 각 단어의 첫 글자 추출
  if (koreanChars.length > 0) {
    // 공백이나 특수문자로 구분된 단어 추출
    const words = cleaned.split(/[\s_.-]+/).filter(w => w.length > 0);
    
    for (const word of words) {
      const firstChar = word.match(/[가-힣]/)?.[0] || word.match(/[A-Za-z]/)?.[0];
      if (firstChar) {
        abbreviation += firstChar.toUpperCase();
      }
    }
    
    // 최대 4글자로 제한
    if (abbreviation.length > 4) {
      abbreviation = abbreviation.substring(0, 4);
    }
  } else if (englishChars.length > 0) {
    // 영문만 있는 경우 대문자만 추출하거나 앞 3-4글자
    const upperChars = cleaned.match(/[A-Z]/g) || [];
    if (upperChars.length >= 2) {
      abbreviation = upperChars.join('').substring(0, 4);
    } else {
      // 대문자가 적으면 앞 3-4글자를 대문자로
      abbreviation = cleaned.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '');
    }
  }
  
  // 약자가 없으면 기본값
  if (!abbreviation || abbreviation.length === 0) {
    abbreviation = 'COMP';
  }
  
  return abbreviation;
};

// 사원번호 자동 생성 함수
const generateEmployeeNumber = async (companyId: number, companyName: string): Promise<string> => {
  try {
    // 회사 약자 추출
    const abbreviation = getCompanyAbbreviation(companyName);
    
    // 해당 회사의 기존 사원번호 중 가장 큰 번호 찾기
    const existingUsers = await (User as any).findAll({
      where: {
        company_id: companyId,
        employee_number: {
          [Op.like]: `${abbreviation}-%`
        }
      },
      attributes: ['employee_number'],
      order: [['employee_number', 'DESC']],
      limit: 1
    });
    
    let nextNumber = 1;
    
    if (existingUsers.length > 0 && existingUsers[0].employee_number) {
      // 기존 사원번호에서 숫자 부분 추출
      const lastNumber = existingUsers[0].employee_number.match(/\d+$/);
      if (lastNumber) {
        nextNumber = parseInt(lastNumber[0], 10) + 1;
      }
    }
    
    // 3자리 숫자로 포맷팅 (001, 002, ...)
    const formattedNumber = nextNumber.toString().padStart(3, '0');
    
    return normalizeEmployeeNumber(`${abbreviation}-${formattedNumber}`);
  } catch (error: any) {
    console.error('사원번호 생성 오류:', error);
    // 오류 발생 시 기본값 반환
    const abbreviation = getCompanyAbbreviation(companyName);
    return normalizeEmployeeNumber(`${abbreviation}-001`);
  }
};

const router = express.Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

const SELF_PROFILE_ATTRIBUTES = [
  'id', 'userid', 'username', 'email', 'role', 'department', 'position',
  'employee_number', 'birth_date', 'gender', 'phone', 'address',
  'emergency_contact', 'emergency_phone', 'avatar_url', 'company_id', 'session_version',
  'hire_date', 'employment_type', 'salary', 'bank_name', 'bank_account', 'bank_ifsc',
  'ot_eligible', 'pt_eligible', 'pf_calc_mode', 'is_payment_officer', 'career_history', 'education_history', 'certificate_history', 'created_at', 'tenant_id',
];

const maskSalaryInUserPayload = (raw: any) => {
  if (!raw) return raw;
  const data = typeof raw.toJSON === 'function' ? raw.toJSON() : { ...raw };
  const hasSalary = data.salary != null && data.salary !== '';
  delete data.salary;
  delete data.password_hash;
  data.has_salary = Boolean(hasSalary);
  return data;
};

const parseSalaryInput = (salary: unknown): number | null => {
  if (salary === undefined || salary === null || salary === '') return null;
  const n = typeof salary === 'number' ? salary : parseFloat(String(salary).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** PF 계산 방식: cap_1800 | basic_12pct | total_12pct | none (레거시 pf_cap_1800 boolean 호환) */
const normalizePfCalcMode = (raw: unknown): 'cap_1800' | 'basic_12pct' | 'total_12pct' | 'none' => {
  if (raw === false || raw === 0 || raw === '0' || raw === 'false') return 'basic_12pct';
  const s = String(raw ?? '').trim();
  if (s === 'basic_12pct' || s === 'total_12pct' || s === 'cap_1800' || s === 'none') return s;
  return 'cap_1800';
};

/** 경력 배열 정규화 — 회사명이 있는 항목만 저장 */
const sanitizeCareerHistory = (raw: unknown): Array<{
  company_name: string;
  position: string;
  start_date: string;
  end_date: string;
  description: string;
  certificate_url: string;
}> => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row: any) => ({
      company_name: String(row?.company_name ?? '').trim(),
      position: String(row?.position ?? '').trim(),
      start_date: String(row?.start_date ?? '').trim(),
      end_date: String(row?.end_date ?? '').trim(),
      description: String(row?.description ?? '').trim(),
      certificate_url: String(row?.certificate_url ?? '').trim(),
    }))
    .filter((row) => row.company_name.length > 0);
};

const sanitizeCertificateHistory = (raw: unknown): Array<{
  name: string;
  issuer: string;
  certificate_number: string;
  issue_date: string;
  expiry_date: string;
  file_url: string;
}> => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row: any) => ({
      name: String(row?.name ?? '').trim(),
      issuer: String(row?.issuer ?? '').trim(),
      certificate_number: String(row?.certificate_number ?? '').trim(),
      issue_date: String(row?.issue_date ?? '').trim(),
      expiry_date: String(row?.expiry_date ?? '').trim(),
      file_url: String(row?.file_url ?? '').trim(),
    }))
    .filter((row) => row.name.length > 0);
};

/** 학력 배열 정규화 — 학교명이 있는 항목만 저장 */
const sanitizeEducationHistory = (raw: unknown): Array<{
  school_name: string;
  degree: string;
  major: string;
  start_date: string;
  end_date: string;
  description: string;
}> => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row: any) => ({
      school_name: String(row?.school_name ?? '').trim(),
      degree: String(row?.degree ?? '').trim(),
      major: String(row?.major ?? '').trim(),
      start_date: String(row?.start_date ?? '').trim(),
      end_date: String(row?.end_date ?? '').trim(),
      description: String(row?.description ?? '').trim(),
    }))
    .filter((row) => row.school_name.length > 0);
};

const verifyCurrentUserPassword = async (req: express.Request, password: unknown) => {
  if (!password || typeof password !== 'string') {
    return { ok: false as const, status: 400, message: '로그인 비밀번호를 입력해주세요.' };
  }
  const self = await findCurrentUser(req, true);
  if (!self) {
    return { ok: false as const, status: 404, message: '사용자를 찾을 수 없습니다.' };
  }
  const matches = await bcrypt.compare(String(password), self.password_hash);
  if (!matches) {
    return { ok: false as const, status: 400, message: '비밀번호가 일치하지 않습니다.' };
  }
  return { ok: true as const, self };
};

const findCurrentUser = async (req: express.Request, includePassword = false) => {
  const authUser = (req as any).user;
  return await (User as any).findOne({
    where: {
      id: authUser.id,
      tenant_id: authUser.tenant_id,
      company_id: authUser.company_id
    },
    attributes: includePassword
      ? [...SELF_PROFILE_ATTRIBUTES, 'password_hash', 'tenant_id']
      : SELF_PROFILE_ATTRIBUTES
  });
};

// 내 개인정보 조회 — 회사/인사 관리 필드는 읽기 전용으로만 반환
router.get('/me/profile', async (req, res) => {
  try {
    const user = await findCurrentUser(req);
    if (!user) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }
    return res.json({ success: true, data: maskSalaryInUserPayload(user) });
  } catch (error: any) {
    console.error('내 개인정보 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '개인정보를 불러오지 못했습니다.'
    });
  }
});

/** 내 급여 조회 — 로그인 비밀번호 확인 필수 */
router.post('/me/salary/reveal', async (req, res) => {
  try {
    const verified = await verifyCurrentUserPassword(req, req.body?.password);
    if (!verified.ok) {
      return res.status(verified.status).json({ success: false, message: verified.message });
    }
    const salary = (verified.self as any).salary;
    return res.json({
      success: true,
      data: { salary: salary == null || salary === '' ? null : salary },
    });
  } catch (error: any) {
    console.error('내 급여 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '급여 정보를 불러오지 못했습니다.',
    });
  }
});

/** 타인 급여 조회(인사) — 사용자관리 조회 권한 + 비밀번호 */
router.post(
  '/:id/salary/reveal',
  requireAdminRootOrUserMenuPermission('can_view'),
  async (req, res) => {
  try {
    const verified = await verifyCurrentUserPassword(req, req.body?.password);
    if (!verified.ok) {
      return res.status(verified.status).json({ success: false, message: verified.message });
    }
    const targetId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(targetId)) {
      return res.status(400).json({ success: false, message: '잘못된 사용자 ID입니다.' });
    }
    const authUser = (req as any).user;
    const where: Record<string, unknown> = { id: targetId, tenant_id: authUser.tenant_id };
    if (authUser.role !== 'root' && authUser.role !== 'audit') {
      where.company_id = authUser.company_id;
    }
    const target = await (User as any).findOne({
      where,
      attributes: ['id', 'salary', 'company_id'],
    });
    if (!target) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }
    const salary = target.salary;
    return res.json({
      success: true,
      data: { salary: salary == null || salary === '' ? null : salary },
    });
  } catch (error: any) {
    console.error('급여 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '급여 정보를 불러오지 못했습니다.',
    });
  }
});

// 내 개인정보 수정 — 회사가 관리하는 소속/권한/인사 필드는 수정 대상에서 제외
router.patch('/me/profile', async (req, res) => {
  try {
    const user = await findCurrentUser(req);
    if (!user) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }

    const {
      username,
      email,
      birth_date,
      gender,
      phone,
      address,
      emergency_contact,
      emergency_phone
    } = req.body || {};

    const updateData: Record<string, unknown> = {};

    if (username !== undefined) {
      const value = String(username).trim();
      if (!value || value.length > 100) {
        return res.status(400).json({ success: false, message: '이름을 올바르게 입력해주세요.' });
      }
      updateData.username = value;
    }

    if (email !== undefined) {
      const value = String(email).trim().toLowerCase();
      if (!emailPattern.test(value) || value.length > 255) {
        return res.status(400).json({ success: false, message: '이메일 형식이 올바르지 않습니다.' });
      }
      if (value !== user.email) {
        const duplicate = await (User as any).findOne({
          where: { email: value, id: { [Op.ne]: user.id } },
          attributes: ['id']
        });
        if (duplicate) {
          return res.status(409).json({ success: false, message: '이미 사용 중인 이메일입니다.' });
        }
      }
      updateData.email = value;
    }

    if (birth_date !== undefined) updateData.birth_date = birth_date || null;
    if (gender !== undefined) {
      if (gender && !['male', 'female', 'other'].includes(String(gender))) {
        return res.status(400).json({ success: false, message: '성별 값이 올바르지 않습니다.' });
      }
      updateData.gender = gender || null;
    }
    if (phone !== undefined) updateData.phone = String(phone || '').trim() || null;
    if (address !== undefined) updateData.address = String(address || '').trim() || null;
    if (emergency_contact !== undefined) {
      updateData.emergency_contact = String(emergency_contact || '').trim() || null;
    }
    if (emergency_phone !== undefined) {
      updateData.emergency_phone = String(emergency_phone || '').trim() || null;
    }

    await user.update(updateData);
    const updated = await findCurrentUser(req);
    return res.json({
      success: true,
      message: '개인정보가 저장되었습니다.',
      data: maskSalaryInUserPayload(updated)
    });
  } catch (error: any) {
    console.error('내 개인정보 수정 오류:', error);
    return res.status(500).json({
      success: false,
      message: '개인정보 저장 중 오류가 발생했습니다.'
    });
  }
});

// 내 비밀번호 변경 — 현재 비밀번호 확인 필수
router.post('/me/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.'
      });
    }
    if (String(newPassword).length < 8 || String(newPassword).length > 128) {
      return res.status(400).json({
        success: false,
        message: '새 비밀번호는 8자 이상 128자 이하여야 합니다.'
      });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: '새 비밀번호는 현재 비밀번호와 달라야 합니다.'
      });
    }

    const user = await findCurrentUser(req, true);
    if (!user) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }
    const matches = await bcrypt.compare(String(currentPassword), user.password_hash);
    if (!matches) {
      return res.status(400).json({ success: false, message: '현재 비밀번호가 일치하지 않습니다.' });
    }

    const { validatePassword } = await import('../utils/passwordValidator');
    const validation = await validatePassword(
      String(newPassword),
      user.tenant_id,
      user.company_id
    );
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message || '비밀번호가 정책에 맞지 않습니다.'
      });
    }

    await user.update({
      password_hash: await hashPassword(String(newPassword)),
      session_version: Number(user.session_version ?? 0) + 1
    });
    invalidateAuthUser(user.id);
    return res.json({ success: true, message: '비밀번호가 변경되었습니다.' });
  } catch (error: any) {
    console.error('내 비밀번호 변경 오류:', error);
    return res.status(500).json({
      success: false,
      message: '비밀번호 변경 중 오류가 발생했습니다.'
    });
  }
});

// 내 프로필 사진 업로드
router.post('/me/avatar', avatarUpload.single('avatar'), async (req, res) => {
  const uploadedPath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '사진 파일을 선택해주세요.' });
    }

    const user = await findCurrentUser(req);
    if (!user) {
      await fs.promises.unlink(req.file.path).catch(() => undefined);
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }

    const previousAvatar = String(user.avatar_url || '');
    const avatarUrl = `/uploads/user-avatars/${req.file.filename}`;
    await user.update({ avatar_url: avatarUrl });
    invalidateAuthUser(user.id);

    if (previousAvatar.startsWith('/uploads/user-avatars/')) {
      const previousFile = path.join(userAvatarDir, path.basename(previousAvatar));
      if (path.resolve(previousFile) !== path.resolve(req.file.path)) {
        await fs.promises.unlink(previousFile).catch(() => undefined);
      }
    }

    return res.json({
      success: true,
      data: { avatar_url: avatarUrl },
      message: '프로필 사진이 저장되었습니다.'
    });
  } catch (error: any) {
    if (uploadedPath) await fs.promises.unlink(uploadedPath).catch(() => undefined);
    console.error('내 프로필 사진 업로드 오류:', error);
    return res.status(500).json({
      success: false,
      message: '프로필 사진 저장 중 오류가 발생했습니다.'
    });
  }
});

// 사용자 목록 조회
router.get('/', async (req, res) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const companyId = (req as any).user.company_id;
    const userRole = (req as any).user.role;
    const { search, company_id, status, count_only } = req.query;

    // root나 audit 권한이면 모든 사용자 조회 가능, 아니면 자신의 회사 사용자만
    const whereClause: any = {};
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    } else if (userRole === 'root' && company_id) {
      // root가 특정 회사 필터링
      whereClause.company_id = parseInt(company_id as string, 10);
    } else if (userRole === 'audit' && company_id) {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = parseInt(String(company_id), 10);
    }

    // 일반 사용자(user)는 메뉴 권한이 있어도 비활성 사용자를 볼 수 없음
    if (userRole === 'user') {
      whereClause[Op.and] = [
        ...(Array.isArray(whereClause[Op.and]) ? whereClause[Op.and] : []),
        { status: { [Op.ne]: 'inactive' } }
      ];
    }

    if (status && typeof status === 'string') {
      whereClause.status = status;
    }

    excludePurgedUsers(whereClause);

    if (count_only === 'true' || count_only === '1') {
      const count = await (User as any).count({ where: whereClause });
      return res.json({ success: true, data: count });
    }

    // 검색 기능 (이름, 이메일, 사용자 ID, 회사명 — 대소문자 무시)
    const includeOptions: any[] = [];
    let companyIdsForSearch: number[] = [];
    
    if (typeof search === 'string' && search.trim()) {
      const searchText = search.trim();
      // 회사명으로 검색하여 회사 ID 찾기
      const matchingCompanies = await (Company as any).findAll({
        where: {
          name: { [Op.iLike]: `%${searchText}%` }
        },
        attributes: ['id']
      });
      companyIdsForSearch = matchingCompanies.map((c: any) => c.id);
      
      // 사용자 이름·이메일·사용자 ID·사원번호 또는 회사 ID로 검색
      const searchConditions: any[] = [
        { username: { [Op.iLike]: `%${searchText}%` } },
        { email: { [Op.iLike]: `%${searchText}%` } },
        { userid: { [Op.iLike]: `%${searchText}%` } },
        { employee_number: { [Op.iLike]: `%${searchText}%` } },
      ];
      
      // 회사명으로 검색된 회사 ID가 있으면 추가
      if (companyIdsForSearch.length > 0) {
        searchConditions.push({ company_id: { [Op.in]: companyIdsForSearch } });
      }
      
      whereClause[Op.or] = searchConditions;
    }
    
    // 회사 정보를 항상 포함 (검색 결과에 회사명 표시용)
    includeOptions.push({
      model: Company,
      as: 'company',
      attributes: ['id', 'name'],
      required: false
    });

    const baseAttributes = [
      'id', 'userid', 'username', 'email', 'role', 'department', 'department_id', 'position', 'position_id', 'status', 'last_login', 'created_at',
      'tenant_id', 'company_id', 'is_payment_officer', 'avatar_url'
    ];
    const hrAttributes = [
      ...baseAttributes,
      'employee_number', 'birth_date', 'gender', 'phone', 'address',
      'emergency_contact', 'emergency_phone', 'hire_date', 'employment_type', 'salary',
      'bank_name', 'bank_account', 'bank_ifsc', 'ot_eligible', 'pt_eligible', 'pf_calc_mode', 'career_history', 'education_history', 'certificate_history'
    ];

    let users: any[];
    const buildFindOptions = (attributes: string[]) => {
      const findOptions: any = {
        where: whereClause,
        attributes,
        order: [['created_at', 'DESC']]
      };
      if (includeOptions.length > 0) {
        findOptions.include = includeOptions;
      }
      return findOptions;
    };

    try {
      if (userListHrFieldsAvailable === false) {
        users = await (User as any).findAll(buildFindOptions(baseAttributes));
      } else {
        try {
          users = await (User as any).findAll(buildFindOptions(hrAttributes));
          userListHrFieldsAvailable = true;
        } catch (hrError: any) {
          if (
            hrError.name === 'SequelizeDatabaseError' &&
            (hrError.message?.includes('칼럼') || hrError.message?.includes('column'))
          ) {
            userListHrFieldsAvailable = false;
            users = await (User as any).findAll(buildFindOptions(baseAttributes));
          } else {
            throw hrError;
          }
        }
      }
    } catch (error: any) {
      console.warn('⚠️ 기본 컬럼 조회 실패, 최소 컬럼만 조회:', error.message);
      try {
        users = await (User as any).findAll({
          where: whereClause,
          attributes: ['id', 'userid', 'username', 'email', 'role', 'status', 'created_at'],
          order: [['created_at', 'DESC']]
        });
      } catch (minError: any) {
        console.error('❌ 최소 컬럼 조회도 실패:', minError.message);
        throw minError;
      }
    }

    const usersData = users.map((user: any) => maskSalaryInUserPayload(user.toJSON ? user.toJSON() : user));

    res.json({
      success: true,
      data: usersData
    });
  } catch (error) {
    console.error('❌ 사용자 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 다음 사원번호 미리보기 (등록 폼 표시용)
router.get('/next-employee-number', async (req, res) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const companyId = (req as any).user.company_id;
    const userRole = (req as any).user.role;
    const { company_id } = req.query;

    let targetCompanyId = companyId;
    if (userRole === 'root' && company_id) {
      targetCompanyId = parseInt(company_id as string, 10);
    }

    if (!targetCompanyId || Number.isNaN(targetCompanyId)) {
      return res.status(400).json({
        success: false,
        message: '회사를 선택해주세요.'
      });
    }

    const companyWhere: Record<string, unknown> = { id: targetCompanyId };
    if (userRole !== 'root') {
      companyWhere.tenant_id = tenantId;
    }

    const company = await (Company as any).findOne({
      where: companyWhere,
      attributes: ['id', 'name']
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: '회사 정보를 찾을 수 없습니다.'
      });
    }

    const employeeNumber = await generateEmployeeNumber(company.id, company.name);

    return res.json({
      success: true,
      data: { employee_number: employeeNumber }
    });
  } catch (error: any) {
    console.error('사원번호 미리보기 오류:', error);
    return res.status(500).json({
      success: false,
      message: '사원번호 미리보기 중 오류가 발생했습니다.'
    });
  }
});

// 사용자 프로필 사진 업로드 (admin/root 또는 사용자관리 메뉴 can_edit)
router.post(
  '/:id/avatar',
  requireAdminRootOrUserMenuPermission('can_edit'),
  avatarUpload.single('avatar'),
  async (req, res) => {
    const uploadedPath = req.file?.path;
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: '사진 파일을 선택해주세요.' });
      }

      const authUser = (req as any).user;
      const whereClause: any = { id: req.params.id };
      if (authUser.role !== 'root' && authUser.role !== 'audit') {
        whereClause.tenant_id = authUser.tenant_id;
        whereClause.company_id = authUser.company_id;
      }

      const targetUser = await (User as any).findOne({
        where: whereClause,
        attributes: ['id', 'avatar_url']
      });
      if (!targetUser) {
        await fs.promises.unlink(req.file.path).catch(() => undefined);
        return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
      }

      const previousAvatar = String(targetUser.avatar_url || '');
      const avatarUrl = `/uploads/user-avatars/${req.file.filename}`;
      await targetUser.update({ avatar_url: avatarUrl });
      invalidateAuthUser(targetUser.id);

      if (previousAvatar.startsWith('/uploads/user-avatars/')) {
        const previousFile = path.join(userAvatarDir, path.basename(previousAvatar));
        if (path.resolve(previousFile) !== path.resolve(req.file.path)) {
          await fs.promises.unlink(previousFile).catch(() => undefined);
        }
      }

      return res.json({
        success: true,
        data: { avatar_url: avatarUrl },
        message: '사용자 사진이 저장되었습니다.'
      });
    } catch (error: any) {
      if (uploadedPath) await fs.promises.unlink(uploadedPath).catch(() => undefined);
      console.error('사용자 사진 업로드 오류:', error);
      return res.status(500).json({
        success: false,
        message: '사용자 사진 저장 중 오류가 발생했습니다.'
      });
    }
  }
);

/** 경력증명서 파일 업로드 */
router.post(
  '/:id/career-certificate',
  requireAdminRootOrUserMenuPermission('can_edit'),
  careerCertificateUpload.single('certificate'),
  async (req, res) => {
    const uploadedPath = req.file?.path;
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: '첨부할 경력증명서 파일을 선택해주세요.' });
      }
      const targetUser = await (User as any).findOne({
        where: { id: req.params.id, tenant_id: (req as any).user.tenant_id },
        attributes: ['id'],
      });
      if (!targetUser) {
        return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
      }
      return res.json({
        success: true,
        data: {
          certificate_url: `/uploads/career-certificates/${req.file.filename}`,
          original_name: req.file.originalname,
        },
      });
    } catch (error: any) {
      if (uploadedPath) await fs.promises.unlink(uploadedPath).catch(() => undefined);
      return res.status(500).json({ success: false, message: error.message || '경력증명서 업로드에 실패했습니다.' });
    }
  }
);

/** 자격증 사본 파일 업로드 */
router.post(
  '/:id/certificate-copy',
  requireAdminRootOrUserMenuPermission('can_edit'),
  certificateCopyUpload.single('certificate'),
  async (req, res) => {
    const uploadedPath = req.file?.path;
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: '첨부할 자격증 사본 파일을 선택해주세요.' });
      }
      const targetUser = await (User as any).findOne({
        where: { id: req.params.id, tenant_id: (req as any).user.tenant_id },
        attributes: ['id'],
      });
      if (!targetUser) {
        return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
      }
      return res.json({
        success: true,
        data: {
          file_url: `/uploads/certificate-copies/${req.file.filename}`,
          original_name: req.file.originalname,
        },
      });
    } catch (error: any) {
      if (uploadedPath) await fs.promises.unlink(uploadedPath).catch(() => undefined);
      return res.status(500).json({ success: false, message: error.message || '자격증 사본 업로드에 실패했습니다.' });
    }
  }
);

router.get(
  '/salary-approvers',
  requireAdminRootOrUserMenuPermission('can_edit'),
  async (req, res) => {
    try {
      const authUser = (req as any).user;
      const companyId = Number(req.query.company_id || authUser.company_id);
      if (!Number.isFinite(companyId) || companyId <= 0) {
        return res.status(400).json({ success: false, message: '회사를 선택해주세요.' });
      }
      if (authUser.role !== 'root' && authUser.role !== 'audit' && Number(authUser.company_id) !== companyId) {
        return res.status(403).json({ success: false, message: '다른 회사의 담당자는 조회할 수 없습니다.' });
      }
      const data = await listSalaryApprovers(companyId, Number(authUser.tenant_id), Number(authUser.id));
      return res.json({ success: true, data });
    } catch (error: any) {
      console.error('급여 승인 담당자 조회 오류:', error);
      return res.status(500).json({ success: false, message: '급여 승인 담당자를 불러오지 못했습니다.' });
    }
  }
);

router.get('/salary-changes/pending', async (req, res) => {
  try {
    const authUser = (req as any).user;
    const data = await listPendingSalaryChanges({
      id: Number(authUser.id),
      role: String(authUser.role || ''),
      tenant_id: Number(authUser.tenant_id),
      company_id: Number(authUser.company_id),
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('급여 변경 승인 목록 오류:', error);
    return res.status(500).json({ success: false, message: '급여 변경 승인 목록을 불러오지 못했습니다.' });
  }
});

router.post('/salary-changes/:changeId/decision', async (req, res) => {
  try {
    const action = String(req.body?.action || '');
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ success: false, message: '승인 또는 반려만 처리할 수 있습니다.' });
    }
    const authUser = (req as any).user;
    const result = await decideSalaryChange({
      changeId: Number(req.params.changeId),
      actor: {
        id: Number(authUser.id),
        role: String(authUser.role || ''),
        tenant_id: Number(authUser.tenant_id),
      },
      action,
      reason: req.body?.reason,
    });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    return res.json({
      success: true,
      data: result.data,
      message: action === 'approve' ? '급여 변경을 승인했습니다.' : '급여 변경을 반려했습니다.',
    });
  } catch (error: any) {
    console.error('급여 변경 승인 처리 오류:', error);
    return res.status(500).json({ success: false, message: '급여 변경 승인 처리에 실패했습니다.' });
  }
});

router.post(
  '/:id/salary/history',
  requireAdminRootOrUserMenuPermission('can_view'),
  async (req, res) => {
    try {
      const verified = await verifyCurrentUserPassword(req, req.body?.password);
      if (!verified.ok) {
        return res.status(verified.status).json({ success: false, message: verified.message });
      }
      const targetId = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(targetId)) {
        return res.status(400).json({ success: false, message: '잘못된 사용자 ID입니다.' });
      }
      const authUser = (req as any).user;
      const where: Record<string, unknown> = { id: targetId, tenant_id: authUser.tenant_id };
      if (authUser.role !== 'root' && authUser.role !== 'audit') {
        where.company_id = authUser.company_id;
      }
      const target = await (User as any).findOne({ where, attributes: ['id', 'company_id'] });
      if (!target) {
        return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
      }
      const data = await listSalaryHistory(
        targetId,
        Number(authUser.tenant_id),
        authUser.role === 'root' || authUser.role === 'audit' ? undefined : Number(authUser.company_id)
      );
      return res.json({ success: true, data });
    } catch (error: any) {
      console.error('급여 변경 기록 조회 오류:', error);
      return res.status(500).json({ success: false, message: '급여 변경 기록을 불러오지 못했습니다.' });
    }
  }
);

// 사용자 상세 조회
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = (req as any).user.role;
    const tenantId = (req as any).user.tenant_id;
    const companyId = (req as any).user.company_id;
    const baseAttributes = [
      'id', 'userid', 'username', 'email', 'role', 'department', 'department_id', 'position', 'position_id', 'status', 'last_login', 'created_at',
      'is_payment_officer', 'avatar_url'
    ];
    
    // root나 audit 권한이면 모든 사용자 조회 가능, 아니면 자신의 회사 사용자만
    const whereClause: any = { id };
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    }
    if (userRole === 'user') {
      whereClause.status = { [Op.ne]: 'inactive' };
    }
    
    let user: any;
    try {
      // 먼저 기본 필드만 조회
      user = await (User as any).findOne({
        where: whereClause,
        attributes: baseAttributes
      });
      
      // HR 필드가 있는지 확인하고 추가 조회 시도
      try {
        const userWithHrFields = await (User as any).findOne({
          where: whereClause,
          attributes: [
            ...baseAttributes,
            'employee_number', 'birth_date', 'gender', 'phone', 'address', 
            'emergency_contact', 'emergency_phone', 'hire_date', 'employment_type', 'salary',
            'bank_name', 'bank_account', 'bank_ifsc', 'ot_eligible', 'pt_eligible', 'pf_calc_mode', 'career_history', 'education_history', 'certificate_history'
          ]
        });
        if (userWithHrFields) {
          user = userWithHrFields;
        }
      } catch (hrError: any) {
        // HR 필드가 없으면 기본 필드만 사용
        if (hrError.name === 'SequelizeDatabaseError' && 
            (hrError.message?.includes('칼럼') || hrError.message?.includes('column'))) {
          // HR 필드가 아직 추가되지 않은 경우 기본 필드만 사용
          // 경고 메시지는 제거 (스크립트로 필드 추가 후에는 발생하지 않음)
        } else {
          throw hrError;
        }
      }
    } catch (error: any) {
      // 기본 필드 조회 실패 시 최소 필드만 조회
      if (error.name === 'SequelizeDatabaseError' && 
          (error.message?.includes('칼럼') || error.message?.includes('column'))) {
        console.warn('⚠️ 기본 필드 조회 실패, 최소 필드만 조회:', error.message);
        user = await (User as any).findOne({
          where: whereClause,
          attributes: ['id', 'userid', 'username', 'email', 'role', 'status']
        });
      } else {
        throw error;
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    const userData = maskSalaryInUserPayload(user.toJSON ? user.toJSON() : user);
    res.json({
      success: true,
      data: userData
    });
  } catch (error: any) {
    console.error('❌ 사용자 상세 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 사용자 생성 (admin/root 또는 사용자관리 메뉴 can_create)
router.post(
  '/',
  requireAdminRootOrUserMenuPermission('can_create'),
  validateBody({
    userid: { required: true, type: 'string', minLength: 2, maxLength: 50 },
    username: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    email: { required: true, type: 'string', maxLength: 255, pattern: emailPattern },
    password: { required: true, type: 'string', minLength: 8, maxLength: 128 },
    role: { type: 'string', maxLength: 50 },
    department: { type: 'string', maxLength: 100 },
    position: { type: 'string', maxLength: 100 },
    status: { type: 'string', maxLength: 50 },
    is_payment_officer: { type: 'boolean' },
    ot_eligible: { type: 'boolean' },
    pt_eligible: { type: 'boolean' },
    pf_calc_mode: { type: 'string', maxLength: 32 }
  }),
  async (req, res) => {
  try {
    const {
      userid, username, email, password, role, department, position, status,
      employee_number, birth_date, gender, phone, address,
      emergency_contact, emergency_phone, hire_date, employment_type, salary,
      bank_name, bank_account, bank_ifsc,
      is_payment_officer,
      ot_eligible,
      pt_eligible,
      pf_calc_mode,
      pf_cap_1800,
      career_history,
      education_history,
      certificate_history
    } = req.body;

    // 필수 필드 검증
    if (!userid || !username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: '필수 필드(사용자 ID, 이름, 이메일, 비밀번호)를 입력해주세요.'
      });
    }

    // 사용자 ID는 소문자로만 저장
    const normalizedUserid = String(userid).trim().toLowerCase();
    if (!normalizedUserid) {
      return res.status(400).json({
        success: false,
        message: '사용자 ID를 입력해주세요.'
      });
    }

    // root 역할 부여 권한 체크 (root만 root 역할을 부여할 수 있음)
    const currentUserRole = (req as any).user.role;
    if (role === 'root' && currentUserRole !== 'root') {
      return res.status(403).json({
        success: false,
        message: 'root 역할은 root 권한을 가진 사용자만 부여할 수 있습니다.'
      });
    }
    if (role === 'audit' && currentUserRole !== 'root') {
      return res.status(403).json({
        success: false,
        message: 'audit 역할은 root 권한을 가진 사용자만 부여할 수 있습니다.'
      });
    }
    if (role && !canAssignRole(currentUserRole, role)) {
      return res.status(403).json({
        success: false,
        message: '본인보다 상위 역할은 부여할 수 없습니다.'
      });
    }

    // 중복 확인
    const existingUser = await (User as any).findOne({
      where: { userid: normalizedUserid }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: '이미 존재하는 사용자 ID입니다.'
      });
    }

    // 이메일 중복 확인
    const existingEmail = await (User as any).findOne({
      where: { email }
    });

    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: '이미 사용 중인 이메일입니다.'
      });
    }

    // root는 다른 회사에 사용자를 등록할 수 있음
    let targetCompanyId = (req as any).user.company_id;
    let targetTenantId = (req as any).user.tenant_id;
    
    if ((req as any).user.role === 'root' && req.body.company_id) {
      // root가 다른 회사 선택 시
      targetCompanyId = parseInt(req.body.company_id);
      const selectedCompany = await (Company as any).findOne({
        where: { id: targetCompanyId },
        attributes: ['id', 'name', 'tenant_id']
      });
      
      if (!selectedCompany) {
        return res.status(404).json({
          success: false,
          message: '선택한 회사를 찾을 수 없습니다.'
        });
      }
      
      targetTenantId = selectedCompany.tenant_id;
    }

    const tenant = await (Tenant as any).findByPk(targetTenantId, { attributes: ['id', 'max_users'] });
    if (tenant?.max_users != null) {
      const userCount = await (User as any).count({
        where: {
          tenant_id: targetTenantId,
          status: { [Op.ne]: 'inactive' }
        }
      });
      if (userCount >= tenant.max_users) {
        return res.status(400).json({
          success: false,
          message: `현재 요금제는 최대 ${tenant.max_users}명까지만 등록할 수 있습니다.`
        });
      }
    }

    // 비밀번호 검증
    const { validatePassword } = await import('../utils/passwordValidator');
    const passwordValidation = await validatePassword(password, targetTenantId, targetCompanyId);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        message: passwordValidation.message || '비밀번호가 정책에 맞지 않습니다.'
      });
    }

    // 비밀번호 해싱
    const password_hash = await hashPassword(password);

    // 회사 정보 조회 (사원번호 자동 생성용)
    const company = await (Company as any).findOne({
      where: {
        id: targetCompanyId,
        tenant_id: targetTenantId
      },
      attributes: ['id', 'name']
    });

    // 사원번호 자동 생성 (employee_number가 없거나 빈 문자열인 경우)
    let finalEmployeeNumber = normalizeEmployeeNumber(employee_number);
    if (!finalEmployeeNumber) {
      if (company) {
        finalEmployeeNumber = await generateEmployeeNumber(company.id, company.name);
      } else {
        // 회사 정보를 찾을 수 없는 경우 기본값
        finalEmployeeNumber = await generateEmployeeNumber(targetCompanyId, 'Company');
      }
      finalEmployeeNumber = normalizeEmployeeNumber(finalEmployeeNumber);
    } else if ((req as any).user.role === 'root') {
      // root가 직접 입력한 경우 같은 회사 내 중복 방지 (대소문자 무시)
      const duplicateEmp = await (User as any).findOne({
        where: {
          company_id: targetCompanyId,
          employee_number: { [Op.iLike]: finalEmployeeNumber },
          status: { [Op.ne]: 'inactive' },
        },
        attributes: ['id'],
      });
      if (duplicateEmp) {
        return res.status(409).json({
          success: false,
          message: '같은 회사에 이미 사용 중인 사원번호입니다.',
        });
      }
    }

    // 날짜 필드 처리
    const userData: any = {
      tenant_id: targetTenantId,
      company_id: targetCompanyId,
      userid: normalizedUserid,
      username,
      email,
      password_hash,
      role: role || 'user',
      status: status || 'active',
      employee_number: finalEmployeeNumber
    };

    // 부서: department_id 우선, 없으면 기존 department 문자열 (회사 스코프)
    const createDeptRes = await resolveDepartmentFieldsForUser(
      targetTenantId,
      (req.body as any).department_id,
      targetCompanyId
    );
    if (createDeptRes.kind === 'err') {
      return res.status(400).json({ success: false, message: createDeptRes.message });
    }
    if (createDeptRes.kind === 'ok') {
      userData.department_id = createDeptRes.department_id;
      userData.department = createDeptRes.department;
    } else if (department !== undefined) {
      userData.department = department || null;
    }
    const createPosRes = await resolvePositionFieldsForUser(
      targetTenantId,
      (req.body as any).position_id,
      targetCompanyId
    );
    if (createPosRes.kind === 'err') {
      return res.status(400).json({ success: false, message: createPosRes.message });
    }
    if (createPosRes.kind === 'ok') {
      userData.position_id = createPosRes.position_id;
      userData.position = createPosRes.position;
    } else if (position !== undefined) {
      userData.position = position || null;
    }
    if (birth_date) userData.birth_date = birth_date;
    if (gender) userData.gender = gender;
    if (phone !== undefined) userData.phone = phone || null;
    if (address !== undefined) userData.address = address || null;
    if (emergency_contact !== undefined) userData.emergency_contact = emergency_contact || null;
    if (emergency_phone !== undefined) userData.emergency_phone = emergency_phone || null;
    if (hire_date) userData.hire_date = hire_date;
    if (employment_type) userData.employment_type = employment_type;
    // 신규 등록: 급여는 잠금 없이 저장 (수정 시에만 로그인 비밀번호 확인)
    if (salary !== undefined && salary !== '') {
      userData.salary = parseSalaryInput(salary);
    }
    if (bank_name !== undefined) userData.bank_name = bank_name || null;
    if (bank_account !== undefined) userData.bank_account = bank_account || null;
    if (bank_ifsc !== undefined) userData.bank_ifsc = bank_ifsc || null;
    if (is_payment_officer !== undefined) {
      userData.is_payment_officer = Boolean(is_payment_officer);
    }
    userData.ot_eligible = ot_eligible !== undefined ? Boolean(ot_eligible) : false;
    userData.pt_eligible = pt_eligible !== undefined ? Boolean(pt_eligible) : true;
    userData.pf_calc_mode = normalizePfCalcMode(
      pf_calc_mode !== undefined ? pf_calc_mode : pf_cap_1800
    );
    if (career_history !== undefined) {
      userData.career_history = sanitizeCareerHistory(career_history);
    }
    if (education_history !== undefined) {
      userData.education_history = sanitizeEducationHistory(education_history);
    }
    if (certificate_history !== undefined) {
      userData.certificate_history = sanitizeCertificateHistory(certificate_history);
    }

    const user = await (User as any).create(userData);
    try {
      await recordInitialSalary(user, Number((req as any).user.id));
    } catch (salaryLogErr) {
      console.warn('initial salary history failed:', salaryLogErr);
    }

    try {
      await grantEmployeeSelfServicePermissions({
        userId: Number(user.id),
        tenantId: Number(user.tenant_id || targetTenantId),
        role: String(user.role || role || 'user'),
      });
    } catch (grantErr) {
      console.warn('my-workspace default permission grant failed:', grantErr);
    }

    // 비밀번호 해시 제외하고 응답
    const responseData = maskSalaryInUserPayload(user.toJSON());

    res.status(201).json({
      success: true,
      data: responseData,
      message: '사용자가 생성되었습니다.'
    });
  } catch (error: any) {
    console.error('사용자 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 사용자 수정 (admin/root 또는 사용자관리 메뉴 can_edit)
router.put(
  '/:id',
  requireAdminRootOrUserMenuPermission('can_edit'),
  validateBody({
    userid: { type: 'string', minLength: 2, maxLength: 50 },
    username: { type: 'string', minLength: 1, maxLength: 100 },
    email: { type: 'string', maxLength: 255, pattern: emailPattern },
    password: { type: 'string', minLength: 8, maxLength: 128 },
    role: { type: 'string', maxLength: 50 },
    department: { type: 'string', maxLength: 100 },
    position: { type: 'string', maxLength: 100 },
    status: { type: 'string', maxLength: 50 },
    is_payment_officer: { type: 'boolean' },
    ot_eligible: { type: 'boolean' },
    pt_eligible: { type: 'boolean' },
    pf_calc_mode: { type: 'string', maxLength: 32 }
  }),
  async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = (req as any).user.role;
    const tenantId = (req as any).user.tenant_id;
    const companyId = (req as any).user.company_id;
    const {
      userid, username, email, password, role, department, position, status,
      employee_number, birth_date, gender, phone, address,
      emergency_contact, emergency_phone, hire_date, employment_type, salary,
      bank_name, bank_account, bank_ifsc,
      is_payment_officer,
      ot_eligible,
      pt_eligible,
      pf_calc_mode,
      pf_cap_1800,
      career_history,
      education_history,
      certificate_history,
      company_id: bodyCompanyId
    } = req.body;

    // root나 audit 권한이면 모든 사용자 조회 가능, 아니면 자신의 회사 사용자만
    const whereClause: any = { id };
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    }

    // 사용자 존재 확인 - 기본 필드만 먼저 조회
    const baseAttributes = [
      'id', 'userid', 'username', 'email', 'role', 'department', 'department_id', 'position', 'position_id', 'status', 'last_login', 'created_at',
      'tenant_id', 'company_id', 'avatar_url'
    ];
    
    let user: any;
    try {
      user = await (User as any).findOne({
        where: whereClause,
        attributes: baseAttributes
      });
      
      // HR 필드가 있는지 확인하고 추가 조회 시도
      if (user) {
        try {
          const userWithHrFields = await (User as any).findOne({
            where: whereClause,
            attributes: [
              ...baseAttributes,
              'employee_number', 'birth_date', 'gender', 'phone', 'address', 
              'emergency_contact', 'emergency_phone', 'hire_date', 'employment_type', 'salary',
              'bank_name', 'bank_account', 'bank_ifsc', 'ot_eligible', 'pt_eligible', 'pf_calc_mode', 'career_history', 'education_history', 'certificate_history'
            ]
          });
          if (userWithHrFields) {
            user = userWithHrFields;
          }
        } catch (hrError: any) {
          // HR 필드가 없으면 기본 필드만 사용
          if (hrError.name === 'SequelizeDatabaseError' && 
              (hrError.message?.includes('칼럼') || hrError.message?.includes('column'))) {
            // HR 필드가 아직 추가되지 않은 경우 기본 필드만 사용
            // 경고 메시지는 제거 (스크립트로 필드 추가 후에는 발생하지 않음)
          } else {
            throw hrError;
          }
        }
      }
    } catch (error: any) {
      // 기본 필드 조회 실패 시 최소 필드만 조회
      if (error.name === 'SequelizeDatabaseError' && 
          (error.message?.includes('칼럼') || error.message?.includes('column'))) {
        console.warn('⚠️ 기본 필드 조회 실패, 최소 필드만 조회:', error.message);
        user = await (User as any).findOne({
          where: whereClause,
          attributes: ['id', 'userid', 'username', 'email', 'role', 'status']
        });
      } else {
        throw error;
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    // root 역할 부여 권한 체크 (root만 root 역할을 부여할 수 있음)
    const currentUserRole = (req as any).user.role;
    if (role !== undefined && role === 'root' && currentUserRole !== 'root') {
      return res.status(403).json({
        success: false,
        message: 'root 역할은 root 권한을 가진 사용자만 부여할 수 있습니다.'
      });
    }
    if (role !== undefined && role === 'audit' && currentUserRole !== 'root' && user.role !== 'audit') {
      return res.status(403).json({
        success: false,
        message: 'audit 역할은 root 권한을 가진 사용자만 부여할 수 있습니다.'
      });
    }
    if (role !== undefined && role !== user.role && !canAssignRole(currentUserRole, role)) {
      return res.status(403).json({
        success: false,
        message: '본인보다 상위 역할은 부여할 수 없습니다.'
      });
    }

    // 이메일 중복 확인 (다른 사용자가 사용 중인지)
    if (email && email !== user.email) {
      const existingEmail = await (User as any).findOne({
        where: { 
          email,
          id: { [Op.ne]: id }
        },
        attributes: ['id', 'email']
      });

      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: '이미 사용 중인 이메일입니다.'
        });
      }
    }

    // 사용자 ID 변경 (root만 가능)
    if (userid !== undefined && userid !== user.userid) {
      if (currentUserRole !== 'root') {
        return res.status(403).json({
          success: false,
          message: '사용자 ID 변경은 root 권한만 가능합니다.'
        });
      }
      const trimmedUserid = String(userid).trim().toLowerCase();
      if (!trimmedUserid) {
        return res.status(400).json({
          success: false,
          message: '사용자 ID를 입력해주세요.'
        });
      }
      const existingUserid = await (User as any).findOne({
        where: {
          userid: trimmedUserid,
          id: { [Op.ne]: id }
        },
        attributes: ['id', 'userid']
      });
      if (existingUserid) {
        return res.status(409).json({
          success: false,
          message: '이미 존재하는 사용자 ID입니다.'
        });
      }
    }

    // 업데이트 데이터 구성
    const updateData: any = {};

    // root만 소속 회사 변경 가능 (tenant_id도 대상 회사에 맞춤)
    let effectiveCompanyId = user.company_id;
    if (bodyCompanyId !== undefined && currentUserRole === 'root') {
      const nextCompanyId = parseInt(String(bodyCompanyId), 10);
      if (!Number.isFinite(nextCompanyId) || nextCompanyId <= 0) {
        return res.status(400).json({
          success: false,
          message: '유효한 회사를 선택해주세요.'
        });
      }
      const selectedCompany = await (Company as any).findOne({
        where: { id: nextCompanyId },
        attributes: ['id', 'name', 'tenant_id']
      });
      if (!selectedCompany) {
        return res.status(404).json({
          success: false,
          message: '선택한 회사를 찾을 수 없습니다.'
        });
      }
      updateData.company_id = nextCompanyId;
      updateData.tenant_id = selectedCompany.tenant_id;
      effectiveCompanyId = nextCompanyId;
    }

    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (userid !== undefined && currentUserRole === 'root') {
      updateData.userid = String(userid).trim().toLowerCase();
    }
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;

    const deptRes = await resolveDepartmentFieldsForUser(
      tenantId,
      (req.body as any).department_id,
      effectiveCompanyId
    );
    if (deptRes.kind === 'err') {
      return res.status(400).json({ success: false, message: deptRes.message });
    }
    if (deptRes.kind === 'ok') {
      updateData.department_id = deptRes.department_id;
      updateData.department = deptRes.department;
    } else if (department !== undefined) {
      updateData.department = department || null;
    }

    const posRes = await resolvePositionFieldsForUser(
      tenantId,
      (req.body as any).position_id,
      effectiveCompanyId
    );
    if (posRes.kind === 'err') {
      return res.status(400).json({ success: false, message: posRes.message });
    }
    if (posRes.kind === 'ok') {
      updateData.position_id = posRes.position_id;
      updateData.position = posRes.position;
    } else if (position !== undefined) {
      updateData.position = position || null;
    }
    if (employee_number !== undefined) {
      if (currentUserRole !== 'root') {
        // 사원번호 변경은 root만 허용 (비-root 요청의 해당 필드는 무시)
      } else {
        const trimmedEmpNo = normalizeEmployeeNumber(employee_number);
        if (trimmedEmpNo) {
          const duplicateEmp = await (User as any).findOne({
            where: {
              company_id: effectiveCompanyId,
              employee_number: { [Op.iLike]: trimmedEmpNo },
              id: { [Op.ne]: id },
              status: { [Op.ne]: 'inactive' },
            },
            attributes: ['id', 'employee_number'],
          });
          if (duplicateEmp) {
            return res.status(409).json({
              success: false,
              message: '같은 회사에 이미 사용 중인 사원번호입니다.',
            });
          }
        }
        updateData.employee_number = trimmedEmpNo || null;
      }
    }
    if (birth_date !== undefined) updateData.birth_date = birth_date || null;
    if (gender !== undefined) updateData.gender = gender || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (address !== undefined) updateData.address = address || null;
    if (emergency_contact !== undefined) updateData.emergency_contact = emergency_contact || null;
    if (emergency_phone !== undefined) updateData.emergency_phone = emergency_phone || null;
    if (hire_date !== undefined) updateData.hire_date = hire_date || null;
    if (employment_type !== undefined) updateData.employment_type = employment_type || null;
    let salaryChangePending = false;
    if (salary !== undefined) {
      const verified = await verifyCurrentUserPassword(req, (req.body as any).currentPassword);
      if (!verified.ok) {
        return res.status(verified.status).json({
          success: false,
          message: verified.message || '급여 변경에는 로그인 비밀번호 확인이 필요합니다.',
        });
      }
      const nextSalary = salary === '' ? null : parseSalaryInput(salary);
      if (!salariesEqual(user.salary, nextSalary)) {
        const actorId = Number((req as any).user.id);
        if (currentUserRole === 'root') {
          updateData.salary = nextSalary;
          await recordApprovedSalaryChange({
            user,
            actorId,
            nextSalary,
          });
        } else {
          const approverId = Number((req.body as any).salary_approver_id);
          const targetCompanyId = Number(user.company_id);
          if (!Number.isFinite(approverId) || approverId <= 0) {
            return res.status(400).json({
              success: false,
              message: '급여 변경 승인 담당자를 선택해주세요.',
            });
          }
          const eligible = await isEligibleSalaryApprover(
            approverId,
            targetCompanyId,
            Number(user.tenant_id),
            actorId
          );
          if (!eligible) {
            return res.status(400).json({
              success: false,
              message: '급여 변경 승인 담당자로 지정할 수 없는 사용자입니다.',
            });
          }
          await queueSalaryChange({
            user,
            actorId,
            nextSalary,
            approverId,
          });
          salaryChangePending = true;
        }
      }
    }
    if (bank_name !== undefined) updateData.bank_name = bank_name || null;
    if (bank_account !== undefined) updateData.bank_account = bank_account || null;
    if (bank_ifsc !== undefined) updateData.bank_ifsc = bank_ifsc || null;
    if (is_payment_officer !== undefined) {
      updateData.is_payment_officer = Boolean(is_payment_officer);
    }
    if (ot_eligible !== undefined) {
      updateData.ot_eligible = Boolean(ot_eligible);
    }
    if (pt_eligible !== undefined) {
      updateData.pt_eligible = Boolean(pt_eligible);
    }
    if (pf_calc_mode !== undefined || pf_cap_1800 !== undefined) {
      updateData.pf_calc_mode = normalizePfCalcMode(
        pf_calc_mode !== undefined ? pf_calc_mode : pf_cap_1800
      );
    }
    if (career_history !== undefined) {
      updateData.career_history = sanitizeCareerHistory(career_history);
    }
    if (education_history !== undefined) {
      updateData.education_history = sanitizeEducationHistory(education_history);
    }
    if (certificate_history !== undefined) {
      updateData.certificate_history = sanitizeCertificateHistory(certificate_history);
    }

    // 비밀번호 변경 (있는 경우만)
    if (password) {
      // 비밀번호 검증
      const { validatePassword } = await import('../utils/passwordValidator');
      const tenantId = (req as any).user.tenant_id;
      const companyId = user.company_id || (req as any).user.company_id;
      const passwordValidation = await validatePassword(password, tenantId, companyId);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          success: false,
          message: passwordValidation.message || '비밀번호가 정책에 맞지 않습니다.'
        });
      }
      updateData.password_hash = await hashPassword(password);
      updateData.session_version = Number(user.session_version ?? 0) + 1;
    }

    await user.update(updateData);
    if (updateData.password_hash) {
      invalidateAuthUser(Number(id));
    }

    try {
      await grantEmployeeSelfServicePermissions({
        userId: Number(user.id),
        tenantId: Number(user.tenant_id),
        role: String(user.role),
      });
    } catch (grantErr) {
      console.warn('my-workspace default permission grant failed (update):', grantErr);
    }

    // 업데이트된 사용자 정보 조회 - 기본 필드만 먼저 조회
    const responseBaseAttributes = [
      'id', 'userid', 'username', 'email', 'role', 'department', 'department_id', 'position', 'position_id', 'status', 'last_login', 'created_at',
      'is_payment_officer', 'avatar_url'
    ];
    
    let updatedUser: any;
    try {
      updatedUser = await (User as any).findByPk(id, {
        attributes: responseBaseAttributes
      });
      
      // HR 필드가 있는지 확인하고 추가 조회 시도
      try {
        const userWithHrFields = await (User as any).findByPk(id, {
          attributes: [
            ...responseBaseAttributes,
            'employee_number', 'birth_date', 'gender', 'phone', 'address', 
            'emergency_contact', 'emergency_phone', 'hire_date', 'employment_type', 'salary',
            'bank_name', 'bank_account', 'bank_ifsc', 'ot_eligible', 'pt_eligible', 'pf_calc_mode', 'career_history', 'education_history', 'certificate_history'
          ]
        });
        if (userWithHrFields) {
          updatedUser = userWithHrFields;
        }
      } catch (hrError: any) {
        // HR 필드가 없으면 기본 필드만 사용
        if (hrError.name === 'SequelizeDatabaseError' && 
            (hrError.message?.includes('칼럼') || hrError.message?.includes('column'))) {
          // HR 필드가 아직 추가되지 않은 경우 기본 필드만 사용
          // 경고 메시지는 제거 (스크립트로 필드 추가 후에는 발생하지 않음)
        } else {
          throw hrError;
        }
      }
    } catch (error: any) {
      // 기본 필드 조회 실패 시 최소 필드만 조회
      if (error.name === 'SequelizeDatabaseError' && 
          (error.message?.includes('칼럼') || error.message?.includes('column'))) {
        console.warn('⚠️ 기본 필드 조회 실패, 최소 필드만 조회:', error.message);
        updatedUser = await (User as any).findByPk(id, {
          attributes: ['id', 'userid', 'username', 'email', 'role', 'status']
        });
      } else {
        throw error;
      }
    }

    const userData = maskSalaryInUserPayload(updatedUser.toJSON ? updatedUser.toJSON() : updatedUser);
    res.json({
      success: true,
      data: userData,
      salary_change_pending: salaryChangePending,
      message: salaryChangePending
        ? '급여 변경이 담당자 승인 대기 중입니다. 승인 전까지 기존 급여가 유지됩니다.'
        : '사용자 정보가 업데이트되었습니다.'
    });
  } catch (error: any) {
    console.error('사용자 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 사용자 삭제 (admin/root 또는 사용자관리 메뉴 can_delete)
router.delete('/:id', requireAdminRootOrUserMenuPermission('can_delete'), async (req, res) => {
  try {
    const { id } = req.params;

    const userRole = (req as any).user.role;
    const requesterId = (req as any).user.id;
    const tenantId = (req as any).user.tenant_id;
    const companyId = (req as any).user.company_id;

    // root나 audit 권한이면 모든 사용자 조회 가능, 아니면 자신의 회사 사용자만
    const whereClause: any = { id };
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    }

    const user = await (User as any).findOne({
      where: whereClause
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    if (Number(id) === Number(requesterId)) {
      return res.status(400).json({
        success: false,
        message: '본인 계정은 삭제할 수 없습니다.'
      });
    }

    // 이미 퇴사(inactive)인 계정을 다시 삭제하면 로그인 ID·이메일을 비운다.
    // 행은 급여·근태 참조를 위해 남기고, 같은 이메일·사용자 ID는 새 사용자로 등록할 수 있다.
    if (String(user.status) === 'inactive') {
      if (!isPurgedUser(user)) {
        const released = releasedLoginIdentity(Number(user.id));
        const prevSettings =
          user.settings && typeof user.settings === 'object' ? user.settings : {};
        await user.update({
          status: 'inactive',
          userid: released.userid,
          email: released.email,
          employee_number: null,
          session_version: Number(user.session_version || 0) + 1,
          settings: {
            ...prevSettings,
            purged_at: new Date().toISOString(),
          },
        });
        invalidateAuthUser(Number(user.id));
      }

      return res.json({
        success: true,
        purged: true,
        message: '퇴사 사용자가 삭제되었습니다. 이메일과 사용자 ID를 다시 등록할 수 있습니다.'
      });
    }

    // 물리 삭제 금지 — status를 inactive로 소프트 삭제 (데이터·FK 보존)
    await user.update({ status: 'inactive' });
    invalidateAuthUser(Number(user.id));

    res.json({
      success: true,
      message: '사용자가 비활성화되었습니다.'
    });
  } catch (error: any) {
    console.error('사용자 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Excel 샘플 파일 다운로드
router.get('/excel/sample', authenticateToken, async (req, res) => {
  try {
    // 샘플 데이터 생성
    const sampleData = [
      {
        '사원번호': 'COMP-001',
        '사용자ID': 'user001',
        '이름': '홍길동',
        '이메일': 'hong@example.com',
        '비밀번호': 'SampleOnly!1Aa_ChangeAfterImport',
        '역할 (root/admin/user/audit)': 'user',
        '부서': '개발팀',
        '직책': '개발자',
        '생년월일 (YYYY-MM-DD)': '1990-01-15',
        '성별 (male/female/other)': 'male',
        '전화번호': '010-1234-5678',
        '주소': '서울시 강남구 테헤란로 123',
        '비상연락처': '홍부모',
        '비상연락처 전화번호': '010-9876-5432',
        '입사일 (YYYY-MM-DD)': '2020-01-01',
        '고용형태 (fulltime/contract/parttime/intern/daily/service)': 'fulltime',
        '급여': '5000000',
        '은행명': 'HDFC Bank',
        '계좌번호': '12345678901234',
        'IFSC 코드': 'HDFC0001234',
        '상태 (active/inactive/suspended)': 'active'
      },
      {
        '사원번호': 'COMP-002',
        '사용자ID': 'user002',
        '이름': '김영희',
        '이메일': 'kim@example.com',
        '비밀번호': 'SampleOnly!1Aa_ChangeAfterImport',
        '역할 (root/admin/user/audit)': 'admin',
        '부서': '인사팀',
        '직책': '인사담당자',
        '생년월일 (YYYY-MM-DD)': '1992-05-20',
        '성별 (male/female/other)': 'female',
        '전화번호': '010-2345-6789',
        '주소': '부산시 해운대구 센텀중앙로 456',
        '비상연락처': '김부모',
        '비상연락처 전화번호': '010-8765-4321',
        '입사일 (YYYY-MM-DD)': '2019-06-01',
        '고용형태 (fulltime/contract/parttime/intern/daily/service)': 'fulltime',
        '급여': '6000000',
        '은행명': 'State Bank of India',
        '계좌번호': '98765432109876',
        'IFSC 코드': 'SBIN0001234',
        '상태 (active/inactive/suspended)': 'active'
      }
    ];

    // Excel 워크북 생성
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    
    // 컬럼 너비 설정
    const columnWidths = [
      { wch: 12 }, // 사원번호
      { wch: 12 }, // 사용자ID
      { wch: 12 }, // 이름
      { wch: 25 }, // 이메일
      { wch: 15 }, // 비밀번호
      { wch: 20 }, // 역할
      { wch: 12 }, // 부서
      { wch: 12 }, // 직책
      { wch: 18 }, // 생년월일
      { wch: 15 }, // 성별
      { wch: 15 }, // 전화번호
      { wch: 30 }, // 주소
      { wch: 15 }, // 비상연락처
      { wch: 20 }, // 비상연락처 전화번호
      { wch: 18 }, // 입사일
      { wch: 25 }, // 고용형태
      { wch: 12 }, // 급여
      { wch: 18 }, // 은행명
      { wch: 18 }, // 계좌번호
      { wch: 14 }, // IFSC 코드
      { wch: 20 }  // 상태
    ];
    worksheet['!cols'] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, '사용자');

    // Excel 파일 버퍼 생성
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 파일명 설정
    const fileName = `사용자_입력_샘플_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(excelBuffer);
  } catch (error: any) {
    console.error('Excel 샘플 파일 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: 'Excel 샘플 파일 생성 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Excel 파일 내보내기
router.get(
  '/excel/export',
  authenticateToken,
  requireAdminRootOrUserMenuPermission('can_view'),
  async (req, res) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const companyId = (req as any).user.company_id;
    const userRole = (req as any).user.role;
    const { search, company_id, include_inactive } = req.query;

    // 사용자 목록 조회 (목록 조회와 동일한 로직)
    const whereClause: any = {};
    
    if (userRole !== 'root' && userRole !== 'audit') {
      whereClause.tenant_id = tenantId;
      whereClause.company_id = companyId;
    } else if (userRole === 'root' && company_id) {
      whereClause.company_id = parseInt(company_id as string);
    }

    if (typeof search === 'string' && search.trim()) {
      const searchText = search.trim();
      whereClause[Op.or] = [
        { username: { [Op.iLike]: `%${searchText}%` } },
        { email: { [Op.iLike]: `%${searchText}%` } },
        { userid: { [Op.iLike]: `%${searchText}%` } }
      ];
    }

    const includeInactive =
      include_inactive === '1' ||
      include_inactive === 'true' ||
      String(include_inactive || '').toLowerCase() === 'yes';
    // 일반 user 역할은 퇴사자 내보내기 불가
    if (!includeInactive || userRole === 'user') {
      whereClause.status = { [Op.ne]: 'inactive' };
    }

    excludePurgedUsers(whereClause);

    const users = await (User as any).findAll({
      where: whereClause,
      include: [{
        model: Company,
        as: 'company',
        attributes: ['id', 'name']
      }],
      order: [['created_at', 'DESC']]
    });

    // Excel 데이터 형식으로 변환
    const excelData = users.map((user: any) => {
      const userData = user.toJSON ? user.toJSON() : user;
      
      return {
        '사원번호': userData.employee_number || '',
        '사용자ID': userData.userid || '',
        '이름': userData.username || '',
        '이메일': userData.email || '',
        '비밀번호': '', // 보안상 비밀번호는 내보내지 않음
        '역할 (root/admin/user/audit)': userData.role || 'user',
        '부서': userData.department || '',
        '직책': userData.position || '',
        '생년월일 (YYYY-MM-DD)': userData.birth_date 
          ? new Date(userData.birth_date).toISOString().split('T')[0] 
          : '',
        '성별 (male/female/other)': userData.gender || '',
        '전화번호': userData.phone || '',
        '주소': userData.address || '',
        '비상연락처': userData.emergency_contact || '',
        '비상연락처 전화번호': userData.emergency_phone || '',
        '입사일 (YYYY-MM-DD)': userData.hire_date 
          ? new Date(userData.hire_date).toISOString().split('T')[0] 
          : '',
        '고용형태 (fulltime/contract/parttime/intern/daily/service)': userData.employment_type || '',
        '급여': (userData.salary != null && userData.salary !== '') ? '**' : '',
        '은행명': userData.bank_name || '',
        '계좌번호': userData.bank_account || '',
        'IFSC 코드': userData.bank_ifsc || '',
        '상태 (active/inactive/suspended)': userData.status || 'active'
      };
    });

    // Excel 워크북 생성 (폰트 9pt — SheetJS community는 스타일 미지원으로 ExcelJS 사용)
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('사용자');

    worksheet.addRow([...USER_EXCEL_EXPORT_COLUMNS]);
    excelData.forEach((rowObj: Record<string, unknown>) => {
      worksheet.addRow(
        USER_EXCEL_EXPORT_COLUMNS.map((key) => rowObj[key] ?? '')
      );
    });

    USER_EXCEL_EXPORT_COL_WIDTHS.forEach((wch, i) => {
      worksheet.getColumn(i + 1).width = wch;
    });

    worksheet.eachRow((row) => {
      row.font = { size: 9 };
    });

    const excelBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

    // 파일명 설정
    const fileName = `사용자_목록_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(excelBuffer);
  } catch (error: any) {
    console.error('Excel 파일 내보내기 오류:', error);
    res.status(500).json({
      success: false,
      message: 'Excel 파일 내보내기 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Excel 파일 업로드 및 사용자 일괄 등록
router.post(
  '/excel/import',
  authenticateToken,
  requireAdminRootOrUserMenuPermission('can_edit'),
  upload.single('file'),
  async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Excel 파일을 업로드해주세요.'
      });
    }

    const tenantId = (req as any).user.tenant_id;
    const companyId = (req as any).user.company_id;
    const userRole = (req as any).user.role;

    // Excel 파일 파싱
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });

    if (!data || data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Excel 파일에 데이터가 없습니다.'
      });
    }

    const results = {
      success: [] as any[],
      failed: [] as any[],
      total: data.length
    };

    const hasSalaryInFile = data.some((row: any) => {
      const v = row['급여'];
      return v != null && String(v).trim() !== '' && String(v).trim() !== '**';
    });
    if (hasSalaryInFile) {
      const verified = await verifyCurrentUserPassword(req, (req.body as any).currentPassword);
      if (!verified.ok) {
        return res.status(verified.status).json({
          success: false,
          message: verified.message || '급여가 포함된 Excel 가져오기에는 로그인 비밀번호가 필요합니다.',
        });
      }
    }

    // 각 행 처리
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as any;
      try {
        // 필수 필드 검증
        if (!row['사용자ID'] || !row['이름'] || !row['이메일'] || !row['비밀번호']) {
          results.failed.push({
            row: i + 2, // Excel 행 번호 (헤더 제외)
            data: row,
            error: '필수 필드(사용자ID, 이름, 이메일, 비밀번호)가 누락되었습니다.'
          });
          continue;
        }

        const userid = row['사용자ID'].toString().trim().toLowerCase();
        const email = row['이메일'].toString().trim();

        const existingByUserid = await (User as any).findOne({ where: { userid } });
        const existingByEmail = await (User as any).findOne({ where: { email } });

        if (existingByUserid && existingByUserid.status !== 'inactive') {
          results.failed.push({
            row: i + 2,
            data: row,
            error: '이미 등록된 사용자ID입니다.'
          });
          continue;
        }

        if (existingByEmail && existingByEmail.status !== 'inactive') {
          results.failed.push({
            row: i + 2,
            data: row,
            error: '이미 등록된 이메일입니다.'
          });
          continue;
        }

        if (
          existingByUserid &&
          existingByEmail &&
          Number(existingByUserid.id) !== Number(existingByEmail.id)
        ) {
          results.failed.push({
            row: i + 2,
            data: row,
            error: '사용자ID와 이메일이 서로 다른 비활성 계정과 충돌합니다.'
          });
          continue;
        }

        const reactivateUser = existingByUserid || existingByEmail;

        // 회사 ID 결정 (root는 company_id를 선택할 수 있음)
        let finalCompanyId = companyId;
        if (userRole === 'root' && row['회사ID']) {
          finalCompanyId = parseInt(row['회사ID'].toString());
        }

        if (reactivateUser) {
          if (Number(reactivateUser.tenant_id) !== Number(tenantId)) {
            results.failed.push({
              row: i + 2,
              data: row,
              error: '다른 테넌트의 비활성 사용자는 재등록할 수 없습니다.'
            });
            continue;
          }
          if (userRole !== 'root' && userRole !== 'audit') {
            if (Number(reactivateUser.company_id) !== Number(companyId)) {
              results.failed.push({
                row: i + 2,
                data: row,
                error: '다른 회사의 비활성 사용자는 재등록할 수 없습니다.'
              });
              continue;
            }
          }
        }

        // 사원번호 자동 생성 (없는 경우) — 대문자로 저장
        let employeeNumber = normalizeEmployeeNumber(row['사원번호']);
        if (!employeeNumber && reactivateUser?.employee_number) {
          employeeNumber = normalizeEmployeeNumber(reactivateUser.employee_number);
        }
        if (!employeeNumber && finalCompanyId) {
          const company = await (Company as any).findByPk(finalCompanyId);
          if (company) {
            const abbreviation = getCompanyAbbreviation(company.name);
            const lastUser = await (User as any).findOne({
              where: {
                company_id: finalCompanyId,
                employee_number: { [Op.like]: `${abbreviation}-%` }
              },
              order: [['employee_number', 'DESC']]
            });

            let sequence = 1;
            if (lastUser && lastUser.employee_number) {
              const match = lastUser.employee_number.match(/-(\d+)$/);
              if (match) {
                sequence = parseInt(match[1]) + 1;
              }
            }
            employeeNumber = normalizeEmployeeNumber(
              `${abbreviation}-${sequence.toString().padStart(3, '0')}`
            );
          }
        }
        employeeNumber = normalizeEmployeeNumber(employeeNumber);

        // 비밀번호 검증 및 해싱
        const password = row['비밀번호'].toString().trim();
        const { validatePassword } = await import('../utils/passwordValidator');
        const passwordValidation = await validatePassword(password, tenantId, finalCompanyId);
        if (!passwordValidation.valid) {
          results.failed.push({
            row: i + 2,
            data: row,
            error: passwordValidation.message || '비밀번호가 정책에 맞지 않습니다.'
          });
          continue;
        }
        const passwordHash = await hashPassword(password);

        const importRole = (row['역할 (root/admin/user/audit)'] && ['root', 'admin', 'user', 'audit'].includes(row['역할 (root/admin/user/audit)'].toString().toLowerCase()))
          ? row['역할 (root/admin/user/audit)'].toString().toLowerCase()
          : 'user';

        if (importRole === 'audit' && userRole !== 'root') {
          results.failed.push({
            row: i + 2,
            data: row,
            error: 'audit 역할은 root 권한을 가진 사용자만 부여할 수 있습니다.'
          });
          continue;
        }

        if (!canAssignRole(userRole, importRole)) {
          results.failed.push({
            row: i + 2,
            data: row,
            error: '본인보다 상위 역할은 부여할 수 없습니다.'
          });
          continue;
        }

        const importStatus = (row['상태 (active/inactive/suspended)'] && ['active', 'inactive', 'suspended'].includes(row['상태 (active/inactive/suspended)'].toString().toLowerCase()))
          ? row['상태 (active/inactive/suspended)'].toString().toLowerCase()
          : 'active';

        if (importStatus !== 'inactive') {
          const tenant = await (Tenant as any).findByPk(tenantId, { attributes: ['id', 'max_users'] });
          if (tenant?.max_users != null) {
            const userCount = await (User as any).count({
              where: {
                tenant_id: tenantId,
                status: { [Op.ne]: 'inactive' },
                ...(reactivateUser && reactivateUser.status === 'inactive'
                  ? { id: { [Op.ne]: reactivateUser.id } }
                  : {})
              }
            });
            if (userCount >= tenant.max_users) {
              results.failed.push({
                row: i + 2,
                data: row,
                error: `현재 요금제는 최대 ${tenant.max_users}명까지만 등록할 수 있습니다.`
              });
              continue;
            }
          }
        }

        const birthDateResult = parseExcelDateOnlyField(
          row['생년월일 (YYYY-MM-DD)'],
          '생년월일'
        );
        if (birthDateResult.ok === false) {
          results.failed.push({
            row: i + 2,
            data: row,
            error: birthDateResult.error
          });
          continue;
        }

        const hireDateResult = parseExcelDateOnlyField(
          row['입사일 (YYYY-MM-DD)'],
          '입사일'
        );
        if (hireDateResult.ok === false) {
          results.failed.push({
            row: i + 2,
            data: row,
            error: hireDateResult.error
          });
          continue;
        }

        const userPayload: Record<string, unknown> = {
          tenant_id: tenantId,
          company_id: finalCompanyId,
          userid,
          username: row['이름'].toString().trim(),
          email,
          password_hash: passwordHash,
          role: importRole,
          employee_number: employeeNumber || null,
          birth_date: birthDateResult.value,
          gender: (row['성별 (male/female/other)'] && ['male', 'female', 'other'].includes(row['성별 (male/female/other)'].toString().toLowerCase()))
            ? row['성별 (male/female/other)'].toString().toLowerCase()
            : null,
          phone: row['전화번호'] ? row['전화번호'].toString().trim() : null,
          address: row['주소'] ? row['주소'].toString().trim() : null,
          emergency_contact: row['비상연락처'] ? row['비상연락처'].toString().trim() : null,
          emergency_phone: row['비상연락처 전화번호'] ? row['비상연락처 전화번호'].toString().trim() : null,
          hire_date: hireDateResult.value,
          employment_type: (() => {
            const empTypeRaw =
              row['고용형태 (fulltime/contract/parttime/intern/daily/service)'] ??
              row['고용형태 (fulltime/contract/parttime/intern/daily)'];
            if (!empTypeRaw) return null;
            const v = empTypeRaw.toString().toLowerCase();
            return ['fulltime', 'contract', 'parttime', 'intern', 'daily', 'service'].includes(v)
              ? v
              : null;
          })(),
          salary: (() => {
            const raw = row['급여'];
            if (raw == null || String(raw).trim() === '' || String(raw).trim() === '**') return null;
            return parseSalaryInput(raw);
          })(),
          bank_name: normalizeExcelBankName(row['은행명']),
          bank_account: normalizeExcelBankAccount(row['계좌번호']),
          bank_ifsc: normalizeExcelBankIfsc(row['IFSC 코드']),
          status: importStatus,
        };

        const deptRaw = row['부서'] ? row['부서'].toString().trim() : '';
        if (deptRaw) {
          const deptRes = await resolveDepartmentFieldsByName(tenantId, deptRaw, finalCompanyId);
          if (deptRes.kind === 'ok') {
            userPayload.department_id = deptRes.department_id;
            userPayload.department = deptRes.department;
          } else if (deptRes.kind === 'text_only') {
            userPayload.department = deptRes.department;
            userPayload.department_id = null;
          }
        } else {
          userPayload.department = null;
          userPayload.department_id = null;
        }

        const posRaw = row['직책'] ? row['직책'].toString().trim() : '';
        if (posRaw) {
          const posRes = await resolvePositionFieldsByName(tenantId, posRaw, finalCompanyId);
          if (posRes.kind === 'ok') {
            userPayload.position_id = posRes.position_id;
            userPayload.position = posRes.position;
          } else if (posRes.kind === 'text_only') {
            userPayload.position = posRes.position;
            userPayload.position_id = null;
          }
        } else {
          userPayload.position = null;
          userPayload.position_id = null;
        }

        const user = reactivateUser
          ? await reactivateUser.update({
              ...userPayload,
              session_version: Number(reactivateUser.session_version ?? 0) + 1,
            })
          : await (User as any).create(userPayload);

        try {
          await grantEmployeeSelfServicePermissions({
            userId: Number(user.id),
            tenantId: Number(tenantId),
            role: String(importRole),
          });
        } catch (grantErr) {
          console.warn('my-workspace default permission grant failed (import):', grantErr);
        }

        results.success.push({
          row: i + 2,
          userid,
          username: row['이름'],
          reactivated: Boolean(reactivateUser)
        });
      } catch (error: any) {
        results.failed.push({
          row: i + 2,
          data: row,
          error: error.message || '알 수 없는 오류가 발생했습니다.'
        });
      }
    }

    res.json({
      success: true,
      message: `총 ${results.total}건 중 ${results.success.length}건이 성공적으로 등록되었습니다.`,
      data: results
    });
  } catch (error: any) {
    console.error('Excel 파일 업로드 오류:', error);
    res.status(500).json({
      success: false,
      message: 'Excel 파일 업로드 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 로그인 사용자 UI 설정 (users.settings.ui JSON)
router.get('/me/ui-preferences', authenticateToken, getUserUiPreferences);
router.patch('/me/ui-preferences', authenticateToken, patchUserUiPreferences);

// 로그인 사용자 SMTP 설정
router.get('/me/mail-server', authenticateToken, getMyMailServer);
router.patch('/me/mail-server', authenticateToken, patchMyMailServer);
router.post('/me/mail-server/test', authenticateToken, testMyMailServer);

export default router;
