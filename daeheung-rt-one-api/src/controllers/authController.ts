import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { DataTypes, Op } from 'sequelize';
import { User, Company, LoginLog, Tenant, Menu, UserPermission, CompanyGstNumber, Department, Position } from '../models';
import { AuthRequest } from '../types';
import sequelize from '../config/database';
import { invalidateAuthUser } from '../utils/authCache';
import { recordActivityLog } from '../services/activityLogService';
import { resolveIsNotifierAuth, isMvsNotifierClient } from '../constants/authClients';
import {
  buildAuthTokenClaims,
  signAuthToken,
} from '../services/authSessionService';
import { ensureLoginNoticeVersionColumn } from '../utils/ensureLoginNoticeVersion';
import { PRODUCT_NAME } from '../config/standalone';

const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

/** 로그인/프로필용 부서·직책 표시명 (문자열 비어 있으면 id 마스터에서 보강) */
const resolveUserOrgLabels = async (user: any): Promise<{ department: string | null; position: string | null }> => {
  let department = String(user?.department || '').trim();
  let position = String(user?.position || '').trim();
  try {
    if (!department && user?.department_id) {
      const dept = await (Department as any).findByPk(user.department_id, { attributes: ['id', 'name'] });
      department = String(dept?.name || '').trim();
    }
    if (!position && user?.position_id) {
      const pos = await (Position as any).findByPk(user.position_id, { attributes: ['id', 'name'] });
      position = String(pos?.name || '').trim();
    }
  } catch (err) {
    console.warn('[auth] resolveUserOrgLabels failed:', (err as any)?.message || err);
  }
  return {
    department: department || null,
    position: position || null,
  };
};

const getClientIp = (req: Request): string | null => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
};

const DEFAULT_SESSION_TIMEOUT_MINUTES = 600;
const MIN_SESSION_TIMEOUT_MINUTES = 5;
const MAX_SESSION_TIMEOUT_MINUTES = 24 * 60;

const normalizeSessionTimeoutMinutes = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_SESSION_TIMEOUT_MINUTES;
  const rounded = Math.floor(num);
  if (rounded < MIN_SESSION_TIMEOUT_MINUTES) return MIN_SESSION_TIMEOUT_MINUTES;
  if (rounded > MAX_SESSION_TIMEOUT_MINUTES) return MAX_SESSION_TIMEOUT_MINUTES;
  return rounded;
};

let loginLogSchemaEnsured = false;
const ensureLoginLogSchema = async () => {
  if (loginLogSchemaEnsured) return;
  const queryInterface = sequelize.getQueryInterface();
  let table: any = null;
  try {
    table = await queryInterface.describeTable('login_logs');
  } catch (error: any) {
    const message = String(error?.message || '').toLowerCase();
    if (
      message.includes('login_logs') &&
      (message.includes('does not exist') || message.includes('relation') || message.includes('없습니다'))
    ) {
      await queryInterface.createTable('login_logs', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        tenant_id: { type: DataTypes.INTEGER, allowNull: true },
        company_id: { type: DataTypes.INTEGER, allowNull: true },
        user_id: { type: DataTypes.INTEGER, allowNull: true },
        userid: { type: DataTypes.STRING(100), allowNull: true },
        status: { type: DataTypes.ENUM('success', 'failure'), allowNull: false },
        event_type: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'login' },
        reason: { type: DataTypes.STRING(255), allowNull: true },
        resource: { type: DataTypes.STRING(120), allowNull: true },
        ip_address: { type: DataTypes.STRING(64), allowNull: true },
        user_agent: { type: DataTypes.STRING(500), allowNull: true },
        logged_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
      });
      loginLogSchemaEnsured = true;
      return;
    }
    throw error;
  }

  const ensureColumn = async (columnName: string, definition: any) => {
    if (!(table as any)[columnName]) {
      await queryInterface.addColumn('login_logs', columnName, definition);
    }
  };

  await ensureColumn('tenant_id', { type: DataTypes.INTEGER, allowNull: true });
  await ensureColumn('company_id', { type: DataTypes.INTEGER, allowNull: true });
  await ensureColumn('user_id', { type: DataTypes.INTEGER, allowNull: true });
  await ensureColumn('userid', { type: DataTypes.STRING(100), allowNull: true });
  await ensureColumn('status', {
    type: DataTypes.ENUM('success', 'failure'),
    allowNull: false,
    defaultValue: 'success'
  });
  await ensureColumn('event_type', {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'login'
  });
  await ensureColumn('reason', { type: DataTypes.STRING(255), allowNull: true });
  await ensureColumn('resource', { type: DataTypes.STRING(120), allowNull: true });
  await ensureColumn('ip_address', { type: DataTypes.STRING(64), allowNull: true });
  await ensureColumn('user_agent', { type: DataTypes.STRING(500), allowNull: true });
  await ensureColumn('logged_at', { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW });

  loginLogSchemaEnsured = true;
};

const writeLoginLog = async ({
  tenant_id,
  company_id,
  user_id,
  userid,
  status,
  reason,
  ip_address,
  user_agent,
  event_type = 'login'
}: {
  tenant_id?: number | null;
  company_id?: number | null;
  user_id?: number | null;
  userid?: string | null;
  status: 'success' | 'failure';
  reason?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  event_type?: 'login' | 'logout' | 'security';
}) => {
  try {
    await ensureLoginLogSchema();
    // 로그인 경로에서는 기존처럼 await하되, 실패해도 로그인 자체는 계속
    await (LoginLog as any).create({
      tenant_id: tenant_id ?? null,
      company_id: company_id ?? null,
      user_id: user_id ?? null,
      userid: userid ?? null,
      status,
      event_type,
      reason: reason ?? null,
      ip_address: ip_address ?? null,
      user_agent: user_agent ?? null,
      logged_at: new Date()
    });
  } catch (error) {
    console.error('로그인 로그 기록 오류:', error);
  }
};

type BillingPlanKey = 'free_3months';

const BILLING_PLAN_CONFIG: Record<BillingPlanKey, { months: number; amount: number; code: string }> = {
  free_3months: { months: 3, amount: 0, code: 'free_3months' }
};

/** 신규 가입은 3개월 무료만 허용 (구 유료·7일 체험 키는 무료 3개월로 통일) */
const normalizeBillingPlanKey = (_raw: string): BillingPlanKey => 'free_3months';

const FREE_TRIAL_PLAN_CODES = new Set(['free_day_1', 'free_week_7', 'free_3months']);

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'company';

const toDateOnly = (value?: string): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

const addMonthsInclusiveEnd = (base: Date, months: number): Date => {
  const end = new Date(base);
  end.setMonth(end.getMonth() + months);
  end.setDate(end.getDate() - 1);
  return end;
};

export const register = async (req: Request, res: Response) => {
  return res.status(403).json({
    success: false,
    message: `${PRODUCT_NAME}은 단독 시스템입니다. 신규 회사 가입은 사용할 수 없습니다.`,
  });

  const transaction = await (User as any).sequelize.transaction();
  try {
    const {
      companyName,
      businessNumber,
      gstNumber,
      adminName,
      adminUserid,
      adminEmail,
      adminPassword,
      planType,
      startDate,
      phone,
      address
    } = req.body || {};

    const normalizedCompanyName = String(companyName || '').trim();
    const normalizedBusinessNumber = String(businessNumber || '').trim();
    const normalizedGstNumber = String(gstNumber || '').trim().toUpperCase();
    const normalizedAdminName = String(adminName || '').trim();
    const normalizedAdminUserid = String(adminUserid || '').trim();
    const normalizedAdminEmail = String(adminEmail || '').trim().toLowerCase();
    const normalizedPlan = normalizeBillingPlanKey(String(planType || ''));
    const normalizedPhone = String(phone || '').trim();
    const normalizedAddress = String(address || '').trim();

    if (!/^[0-9]{2}[A-Z0-9]{13}$/.test(normalizedGstNumber)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'GST 번호 형식이 올바르지 않습니다. (15자리)'
      });
    }

    // 동일 회사(회사명·사업자번호·GST 기준) 무료 가입은 1회만 허용
    {
      const companiesByName = await (Company as any).findAll({
        where: { name: normalizedCompanyName },
        attributes: ['id', 'subscription_plan', 'settings'],
        transaction
      });
      const companyByBusinessNumber = await (Company as any).findOne({
        where: { business_number: normalizedBusinessNumber },
        attributes: ['id', 'subscription_plan', 'settings'],
        transaction
      });
      const gstRow = await (CompanyGstNumber as any).findOne({
        where: { gst_number: normalizedGstNumber },
        attributes: ['company_id'],
        transaction
      });
      const companyByGst = gstRow
        ? await (Company as any).findByPk(gstRow.company_id, {
            attributes: ['id', 'subscription_plan', 'settings'],
            transaction
          })
        : null;

      const candidates = [...companiesByName];
      if (companyByBusinessNumber) candidates.push(companyByBusinessNumber);
      if (companyByGst) candidates.push(companyByGst);

      const alreadyUsedFreeTrial = candidates.some((company: any) => {
        const settings = company?.settings || {};
        const onboarding = settings?.onboarding || {};
        const plan = company?.subscription_plan;
        return FREE_TRIAL_PLAN_CODES.has(plan) || onboarding?.freeTrialUsed === true;
      });

      if (alreadyUsedFreeTrial) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: '동일한 회사는 무료 이용(3개월)을 1회만 사용할 수 있습니다.'
        });
      }
    }

    const duplicateUserId = await (User as any).findOne({
      where: { userid: normalizedAdminUserid },
      transaction
    });
    if (duplicateUserId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '이미 사용 중인 관리자 ID입니다.'
      });
    }

    const duplicateEmail = await (User as any).findOne({
      where: { email: normalizedAdminEmail },
      transaction
    });
    if (duplicateEmail) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '이미 사용 중인 이메일입니다.'
      });
    }

    const duplicateBusinessNumber = await (Company as any).findOne({
      where: { business_number: normalizedBusinessNumber },
      transaction
    });
    if (duplicateBusinessNumber) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '이미 등록된 사업자번호입니다.'
      });
    }
    const duplicateGstNumber = await (CompanyGstNumber as any).findOne({
      where: { gst_number: normalizedGstNumber },
      transaction
    });
    if (duplicateGstNumber) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: '이미 등록된 GST 번호입니다.'
      });
    }

    const now = new Date();
    const usageStartDate = toDateOnly(startDate) || new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const usageEndDate = addMonthsInclusiveEnd(usageStartDate, BILLING_PLAN_CONFIG[normalizedPlan].months);
    const companySlug = slugify(normalizedCompanyName);
    const uniqueSuffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const subdomain = `${companySlug}-${uniqueSuffix}`.slice(0, 60);
    const domain = `${subdomain}.mvs.local`;

    const tenant = await (Tenant as any).create(
      {
        name: normalizedCompanyName,
        domain,
        subdomain,
        plan: 'standard',
        max_users: 1,
        max_companies: 1,
        features: ['all_menus', 'payment_approval', 'work_management', 'analytics'],
        status: 'active',
        trial_ends_at: usageEndDate,
        subscription_id: `${normalizedPlan}-${Date.now()}`
      },
      { transaction }
    );

    const company = await (Company as any).create(
      {
        tenant_id: tenant.id,
        name: normalizedCompanyName,
        business_number: normalizedBusinessNumber,
        ceo_name: normalizedAdminName,
        address: normalizedAddress || '',
        phone: normalizedPhone || '',
        email: normalizedAdminEmail,
        website: '',
        industry: 'General',
        employee_count: 1,
        subscription_plan: BILLING_PLAN_CONFIG[normalizedPlan].code,
        subscription_status: 'active',
        status: 'active',
        account_holder_name: '',
        bank_name: '',
        bank_address: '',
        account_number: '',
        ifsc_code: '',
        swift_code: '',
        msme_number: '',
        iec_number: '',
        pan_number: '',
        login_period_start: usageStartDate,
        login_period_end: usageEndDate,
        login_time_start: '00:00:00',
        login_time_end: '23:59:59',
        timezone: 'Asia/Kolkata',
        settings: {
          onboarding: {
            initialized: true,
            planType: normalizedPlan,
            billingAmount: BILLING_PLAN_CONFIG[normalizedPlan].amount,
            freeTrialUsed: true
          }
        }
      },
      { transaction }
    );
    await (CompanyGstNumber as any).create(
      {
        company_id: company.id,
        gst_number: normalizedGstNumber,
        status: 'active'
      },
      { transaction }
    );

    const passwordHash = await bcrypt.hash(String(adminPassword), 10);
    const adminUser = await (User as any).create(
      {
        tenant_id: tenant.id,
        company_id: company.id,
        userid: normalizedAdminUserid,
        username: normalizedAdminName,
        email: normalizedAdminEmail,
        password_hash: passwordHash,
        role: 'admin',
        status: 'active',
        department: '관리',
        position: '관리자',
        is_payment_officer: true
      },
      { transaction }
    );

    const templateMenus = await (Menu as any).findAll({
      where: { tenant_id: 1, is_active: true },
      order: [['level', 'ASC'], ['order', 'ASC'], ['id', 'ASC']],
      transaction
    });

    const createdMenusByOldId = new Map<number, any>();
    const clonedMenus: any[] = [];
    for (const templateMenu of templateMenus) {
      const raw = templateMenu.toJSON ? templateMenu.toJSON() : templateMenu;
      const oldMenuId = Number(raw.id);
      const oldParentId = raw.parent_id ? Number(raw.parent_id) : null;
      const mappedParent = oldParentId ? createdMenusByOldId.get(oldParentId) : null;
      const createdMenu = await (Menu as any).create(
        {
          tenant_id: tenant.id,
          parent_id: mappedParent ? mappedParent.id : null,
          name_ko: raw.name_ko,
          name_en: raw.name_en,
          route: raw.route,
          icon: raw.icon,
          order: raw.order,
          level: raw.level,
          is_active: raw.is_active,
          description: raw.description || null
        },
        { transaction }
      );
      createdMenusByOldId.set(oldMenuId, createdMenu);
      clonedMenus.push(createdMenu);
    }

    if (clonedMenus.length > 0) {
      await (UserPermission as any).bulkCreate(
        clonedMenus.map((menu) => ({
          user_id: adminUser.id,
          menu_id: menu.id,
          can_view: true,
          can_create: true,
          can_edit: true,
          can_delete: true
        })),
        { transaction }
      );
    }

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: '가입이 완료되었습니다.',
      data: {
        tenantId: tenant.id,
        companyId: company.id,
        adminUserId: adminUser.id,
        plan: normalizedPlan,
        billingAmount: BILLING_PLAN_CONFIG[normalizedPlan].amount,
        gstNumber: normalizedGstNumber,
        usageStartDate: usageStartDate.toISOString().split('T')[0],
        usageEndDate: usageEndDate.toISOString().split('T')[0]
      }
    });
  } catch (error: any) {
    await transaction.rollback();
    console.error('가입 처리 오류:', error);
    return res.status(500).json({
      success: false,
      message: '가입 처리 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { userid, password } = req.body as {
      userid?: string;
      password?: string;
    };
    const isNotifierLogin = resolveIsNotifierAuth(req);
    const clientIp = getClientIp(req);
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 500) || null;

    if (!userid || !password || typeof userid !== 'string' || typeof password !== 'string') {
      await writeLoginLog({
        userid: typeof userid === 'string' ? userid.trim() : null,
        status: 'failure',
        reason: 'invalid_payload',
        ip_address: clientIp,
        user_agent: userAgent
      });
      return res.status(400).json({
        success: false,
        code: 'INVALID_INPUT',
        message: '입력값이 올바르지 않습니다.'
      });
    }

    const normalizedUserId = userid.trim();
    if (normalizedUserId.length < 2 || normalizedUserId.length > 50) {
      await writeLoginLog({
        userid: normalizedUserId,
        status: 'failure',
        reason: 'invalid_userid_length',
        ip_address: clientIp,
        user_agent: userAgent
      });
      return res.status(400).json({
        success: false,
        code: 'INVALID_INPUT',
        message: '입력값이 올바르지 않습니다.'
      });
    }
    if (password.length > 128) {
      await writeLoginLog({
        userid: normalizedUserId,
        status: 'failure',
        reason: 'invalid_password_length',
        ip_address: clientIp,
        user_agent: userAgent
      });
      return res.status(400).json({
        success: false,
        code: 'INVALID_INPUT',
        message: '입력값이 올바르지 않습니다.'
      });
    }

    await ensureLoginNoticeVersionColumn();

    // 사용자 조회 (기존 컬럼만 조회하여 마이그레이션 전 호환성 유지)
    const user = await (User as any).findOne({
      where: { userid: normalizedUserId, status: 'active' },
      attributes: [
        'id', 'tenant_id', 'company_id', 'userid', 'username', 'email',
        'password_hash', 'role', 'department', 'department_id', 'position', 'position_id',
        'status', 'last_login',
        'is_payment_officer', 'session_version', 'login_notice_version', 'avatar_url'
      ]
    });

    if (!user) {
      await writeLoginLog({
        userid: normalizedUserId,
        status: 'failure',
        reason: 'user_not_found_or_inactive',
        ip_address: clientIp,
        user_agent: userAgent
      });
      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: '사용자 ID 또는 비밀번호가 올바르지 않습니다.'
      });
    }

    // 비밀번호 확인
    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      await writeLoginLog({
        tenant_id: user.tenant_id,
        company_id: user.company_id,
        user_id: user.id,
        userid: user.userid,
        status: 'failure',
        reason: 'password_mismatch',
        ip_address: clientIp,
        user_agent: userAgent
      });
      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: '사용자 ID 또는 비밀번호가 올바르지 않습니다.'
      });
    }

    // 시스템 설정/사용기간 정보 로드
    let sessionTimeoutMinutes = DEFAULT_SESSION_TIMEOUT_MINUTES;
    let loginPeriodStart: Date | null = null;
    let loginPeriodEnd: Date | null = null;
    let subscriptionStatus: string | null = null;
    try {
      if (user.company_id) {
        const company = await (Company as any).findOne({
          where: { id: user.company_id, tenant_id: user.tenant_id },
          attributes: ['settings', 'login_period_start', 'login_period_end', 'subscription_status']
        });
        if (company && company.settings && company.settings.security) {
          sessionTimeoutMinutes = normalizeSessionTimeoutMinutes(company.settings.security.sessionTimeout);
        }
        if (company) {
          loginPeriodStart = company.login_period_start ? new Date(company.login_period_start) : null;
          loginPeriodEnd = company.login_period_end ? new Date(company.login_period_end) : null;
          subscriptionStatus = company.subscription_status || null;
        }
      }
    } catch (error) {
      console.error('세션 타임아웃 설정 로드 오류:', error);
    }

    const nowDate = new Date();
    const currentDateOnly = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate()));
    if (subscriptionStatus && ['inactive', 'expired', 'suspended'].includes(String(subscriptionStatus).toLowerCase())) {
      await writeLoginLog({
        tenant_id: user.tenant_id,
        company_id: user.company_id,
        user_id: user.id,
        userid: user.userid,
        status: 'failure',
        reason: `subscription_${String(subscriptionStatus).toLowerCase()}`,
        ip_address: clientIp,
        user_agent: userAgent
      });
      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_INACTIVE',
        message: '이용권 상태가 비활성화되어 로그인할 수 없습니다.'
      });
    }
    if (loginPeriodStart && currentDateOnly < new Date(Date.UTC(loginPeriodStart.getUTCFullYear(), loginPeriodStart.getUTCMonth(), loginPeriodStart.getUTCDate()))) {
      await writeLoginLog({
        tenant_id: user.tenant_id,
        company_id: user.company_id,
        user_id: user.id,
        userid: user.userid,
        status: 'failure',
        reason: 'before_usage_period',
        ip_address: clientIp,
        user_agent: userAgent
      });
      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_NOT_STARTED',
        message: '아직 이용 기간이 시작되지 않았습니다.'
      });
    }
    if (loginPeriodEnd && currentDateOnly > new Date(Date.UTC(loginPeriodEnd.getUTCFullYear(), loginPeriodEnd.getUTCMonth(), loginPeriodEnd.getUTCDate()))) {
      await writeLoginLog({
        tenant_id: user.tenant_id,
        company_id: user.company_id,
        user_id: user.id,
        userid: user.userid,
        status: 'failure',
        reason: 'usage_period_expired',
        ip_address: clientIp,
        user_agent: userAgent
      });
      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_EXPIRED',
        message: '이용 기간이 만료되었습니다. 결제를 갱신해 주세요.'
      });
    }

    // JWT 토큰 생성 (세션 타임아웃 적용)
    // expiresIn은 숫자(초 단위)로 전달합니다
    const expiresInSeconds = sessionTimeoutMinutes * 60;
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: '서버 JWT 설정이 누락되었습니다.'
      });
    }

    // 웹: 동시 로그인 허용 — session_version 유지, login_notice_version만 +1 해 다른 기기 안내
    // 알람 앱: session_version·notice 유지 → 웹과 공존 (웹에 알림 팝업을 띄우지 않음)
    const tokenSv = Number(user.session_version ?? 0);
    const prevNotice = Number((user as any).login_notice_version ?? 0);
    let nextNotice = prevNotice;
    await user.update({ last_login: new Date() });
    if (!isNotifierLogin) {
      try {
        await user.increment('login_notice_version', { by: 1 });
        await user.reload({ attributes: ['login_notice_version'] });
        nextNotice = Number((user as any).login_notice_version ?? prevNotice + 1);
      } catch (noticeErr) {
        // 컬럼 미적용 등 — raw SQL로 한 번 더 시도 후 실패해도 로그인은 계속
        console.error('login_notice_version increment failed:', noticeErr);
        try {
          await ensureLoginNoticeVersionColumn();
          const [rows]: any = await sequelize.query(
            `UPDATE users SET login_notice_version = COALESCE(login_notice_version, 0) + 1
             WHERE id = :id
             RETURNING login_notice_version`,
            { replacements: { id: user.id } }
          );
          const raw = Array.isArray(rows) ? rows[0] : rows;
          nextNotice = Number(raw?.login_notice_version ?? prevNotice + 1);
        } catch (rawErr) {
          console.error('login_notice_version raw bump failed:', rawErr);
          nextNotice = prevNotice + 1;
        }
      }
      invalidateAuthUser(user.id);
      // 다른 탭/브라우저의 다음 API·폴링이 바로 새 버전을 보도록 응답 헤더에도 기록
      res.setHeader('X-DRT-Login-Notice-Version', String(Math.floor(nextNotice)));
      res.setHeader('X-MVS-Login-Notice-Version', String(Math.floor(nextNotice)));
    }

    const token = signAuthToken(
      buildAuthTokenClaims(user, { isNotifier: isNotifierLogin, sessionVersion: tokenSv }),
      jwtSecret,
      expiresInSeconds
    );

    await writeLoginLog({
      tenant_id: user.tenant_id,
      company_id: user.company_id,
      user_id: user.id,
      userid: user.userid,
      status: 'success',
      reason: isNotifierLogin
        ? 'desktop_notifier_login'
        : prevNotice > 0
          ? 'concurrent_web_login'
          : null,
      ip_address: clientIp,
      user_agent: userAgent
    });

    const org = await resolveUserOrgLabels(user);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          userid: user.userid,
          username: user.username,
          email: user.email,
          role: user.role,
          department: org.department,
          position: org.position,
          tenant_id: user.tenant_id,
          company_id: user.company_id,
          is_payment_officer: user.is_payment_officer,
          avatar_url: user.avatar_url || null
        },
        loginNoticeVersion: nextNotice,
        sessionReplaced: false
      },
      message: '로그인 성공'
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const org = await resolveUserOrgLabels(user);

    res.json({
      success: true,
      data: {
        id: user.id,
        userid: user.userid,
        username: user.username,
        email: user.email,
        role: user.role,
        department: org.department,
        position: org.position,
        last_login: user.last_login,
        is_payment_officer: user.is_payment_officer,
        avatar_url: user.avatar_url || null
      }
    });
  } catch (error) {
    console.error('프로필 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 활동 기반 세션 연장을 위한 토큰 재발급
export const refreshToken = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '인증이 필요합니다.'
      });
    }

    let sessionTimeoutMinutes = DEFAULT_SESSION_TIMEOUT_MINUTES;
    try {
      if (user.company_id) {
        const company = await (Company as any).findOne({
          where: { id: user.company_id, tenant_id: user.tenant_id },
          attributes: ['settings']
        });
        if (company && company.settings && company.settings.security) {
          sessionTimeoutMinutes = normalizeSessionTimeoutMinutes(company.settings.security.sessionTimeout);
        }
      }
    } catch (error) {
      console.error('세션 타임아웃 설정 로드 오류(리프레시):', error);
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({
        success: false,
        message: '서버 JWT 설정이 누락되었습니다.'
      });
    }

    const expiresInSeconds = sessionTimeoutMinutes * 60;
    const sessionVersion = Number((user as any).session_version ?? 0);
    const authClient = (req as any).authClient;
    const isNotifier = isMvsNotifierClient(authClient);

    const token = signAuthToken(
      buildAuthTokenClaims(user as any, {
        isNotifier,
        sessionVersion,
      }),
      jwtSecret,
      expiresInSeconds
    );

    return res.json({
      success: true,
      data: {
        token,
        expiresInSeconds
      },
      message: '세션이 연장되었습니다.'
    });
  } catch (error) {
    console.error('토큰 리프레시 오류:', error);
    return res.status(500).json({
      success: false,
      message: '토큰 갱신 중 오류가 발생했습니다.'
    });
  }
};

/** 현재 세션 유효성 — 프론트 폴링/포커스 복귀 시 다른 기기 로그인 안내 */
export const checkSession = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '인증이 필요합니다.',
        code: 'UNAUTHORIZED'
      });
    }

    await ensureLoginNoticeVersionColumn();
    // 캐시가 아닌 DB에서 직접 읽어 다른 인스턴스/브라우저 로그인을 즉시 반영
    const fresh = await (User as any).findByPk(req.user.id, {
      attributes: ['id', 'session_version', 'login_notice_version'],
    });

    return res.json({
      success: true,
      data: {
        valid: true,
        userId: req.user.id,
        sessionVersion: Number(fresh?.session_version ?? (req.user as any).session_version ?? 0),
        loginNoticeVersion: Number(fresh?.login_notice_version ?? 0)
      }
    });
  } catch (error) {
    console.error('세션 확인 오류:', error);
    return res.status(500).json({
      success: false,
      message: '세션 확인 중 오류가 발생했습니다.'
    });
  }
};

/** 명시적 로그아웃 — 해당 기기 토큰만 버림. 다른 기기 동시 세션은 유지 */
export const logout = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    const isNotifier = isMvsNotifierClient((req as any).authClient || (req as any).user?.client);
    if (user?.id && !isNotifier) {
      recordActivityLog({
        tenant_id: user.tenant_id ?? null,
        company_id: user.company_id ?? null,
        user_id: user.id,
        userid: (user as any).userid ?? null,
        status: 'success',
        event_type: 'logout',
        reason: 'user_logout',
        ip_address: getClientIp(req),
        user_agent: req.get('user-agent') || null,
      });
    } else if (user?.id && isNotifier) {
      recordActivityLog({
        tenant_id: user.tenant_id ?? null,
        company_id: user.company_id ?? null,
        user_id: user.id,
        userid: (user as any).userid ?? null,
        status: 'success',
        event_type: 'logout',
        reason: 'notifier_logout',
        ip_address: getClientIp(req),
        user_agent: req.get('user-agent') || null,
      });
    }
    return res.json({ success: true, message: '로그아웃되었습니다.' });
  } catch (error) {
    console.error('로그아웃 오류:', error);
    return res.status(500).json({
      success: false,
      message: '로그아웃 처리 중 오류가 발생했습니다.'
    });
  }
};
