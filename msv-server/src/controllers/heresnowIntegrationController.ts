import { Response } from 'express';
import { AuthRequest } from '../types';
import { Company } from '../models';
import {
  getHeresnowIntegrationStatus,
  getHeresnowSettings,
  mergeHeresnowSettings,
  processHeresnowDispatch,
  pullHeresnowAttendance,
  testHeresnowConnection,
  verifyHeresnowDispatchAuth
} from '../services/heresnowIntegrationService';

const loadCompanyForUser = async (req: AuthRequest) => {
  const companyId = req.user?.company_id;
  const tenantId = req.user?.tenant_id;
  if (!companyId || !tenantId) return null;
  return Company.findOne({ where: { id: companyId, tenant_id: tenantId } });
};

/**
 * HeresNow 업스트림 오류 → MVS 클라이언트 응답.
 * 업스트림 401/Unauthorized 를 HTTP 401 로 넘기면 axios가 MVS 세션 만료로 오인해 로그아웃하므로
 * 연동 실패는 4xx(권한·설정) / 502(업스트림) 만 사용한다.
 */
const mapHeresnowClientError = (
  error: any,
  fallbackMessage: string
): { status: number; message: string; code?: string } => {
  const code = String(error?.message || '');
  const lower = code.toLowerCase();

  if (code === 'INTEGRATION_DISABLED') {
    return { status: 403, message: 'HeresNow 연동이 비활성화되어 있습니다.', code };
  }
  if (code === 'API_KEY_NOT_CONFIGURED') {
    return {
      status: 503,
      message: '회사별 HeresNow 연동 API 키가 설정되지 않았습니다.',
      code,
    };
  }
  if (code === '연동된 회사를 찾을 수 없습니다.' || code === 'COMPANY_NOT_FOUND') {
    return {
      status: 404,
      message: '외부 회사 ID 매핑을 찾을 수 없습니다. HeresNow 회사 연동 설정을 확인하세요.',
      code: 'COMPANY_NOT_FOUND',
    };
  }
  if (
    lower.includes('unauthorized') ||
    /\b401\b/.test(code) ||
    lower.includes('invalid api key') ||
    lower.includes('invalid token')
  ) {
    return {
      status: 502,
      message:
        'HeresNow API 키 또는 회사 ID가 올바르지 않습니다. 회사 ID는 HeresNow에 표시된 그대로(소문자) 복사한 뒤 [연동 설정 저장] 후 다시 시도하세요.',
      code: 'HERESNOW_UPSTREAM_UNAUTHORIZED',
    };
  }
  if (lower.includes('not found') || /\b404\b/.test(code)) {
    return {
      status: 502,
      message: 'HeresNow에서 해당 회사/기간 데이터를 찾지 못했습니다. 연동 설정을 확인하세요.',
      code: 'HERESNOW_UPSTREAM_NOT_FOUND',
    };
  }
  return { status: 500, message: fallbackMessage, code: code || undefined };
};

export const dispatchHeresnowAttendance = async (req: AuthRequest, res: Response) => {
  try {
    if (!verifyHeresnowDispatchAuth(req.headers as Record<string, unknown>)) {
      return res.status(401).json({ success: false, message: '연동 인증에 실패했습니다.' });
    }

    const result = await processHeresnowDispatch(req.body);
    return res.json({
      success: true,
      message: 'HeresNow 근태 이벤트를 처리했습니다.',
      data: result
    });
  } catch (error: any) {
    const code = String(error?.message || '');
    const status = code === 'COMPANY_NOT_FOUND'
      ? 404
      : code === 'INTEGRATION_DISABLED'
        ? 403
        : code === 'EVENTS_REQUIRED'
          ? 400
          : 500;

    return res.status(status).json({
      success: false,
      message:
        code === 'COMPANY_NOT_FOUND'
          ? '연동된 회사를 찾을 수 없습니다.'
          : code === 'INTEGRATION_DISABLED'
            ? 'HeresNow 연동이 비활성화되어 있습니다.'
            : code === 'EVENTS_REQUIRED'
              ? '전송할 근태 이벤트가 없습니다.'
              : 'HeresNow 연동 처리 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? code : undefined
    });
  }
};

export const getHeresnowStatus = async (req: AuthRequest, res: Response) => {
  try {
    const company = await loadCompanyForUser(req);
    if (!company) {
      return res.status(404).json({ success: false, message: '회사 정보를 찾을 수 없습니다.' });
    }

    const role = String(req.user?.role || '');
    const canManage = role === 'admin' || role === 'root';
    const status = await getHeresnowIntegrationStatus(company);
    if (!canManage) {
      // 일반 사용자에게는 연동 민감 상태(키 힌트/설정 상태)를 노출하지 않음
      delete (status as any).apiKeyHint;
      delete (status as any).apiConfigured;
      delete (status as any).dispatchConfigured;
    }

    return res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'HeresNow 연동 상태 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const syncHeresnowAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const company = await loadCompanyForUser(req);
    if (!company) {
      return res.status(404).json({ success: false, message: '회사 정보를 찾을 수 없습니다.' });
    }

    const since = typeof req.body?.since === 'string' ? req.body.since : undefined;
    const result = await pullHeresnowAttendance(company, { since });
    console.info('[HeresNow sync]', {
      companyId: company.id,
      tenantId: company.tenant_id,
      since,
      total: result.total,
      applied: result.applied,
      errors: Array.isArray(result.errors) ? result.errors.slice(0, 5) : [],
      debug: (result as any).debug
    });
    const message =
      result.total === 0
        ? '선택한 기간에 HeresNow 동기화 데이터가 없습니다.'
        : result.applied === 0
          ? `HeresNow 데이터 ${result.total}건을 찾았지만 적용 0건입니다. 사용자 매핑(이메일/사번) 또는 데이터 형식을 확인해주세요.`
          : `HeresNow에서 ${result.applied}건의 근태를 반영했습니다.`;

    return res.json({
      success: true,
      message,
      data: result
    });
  } catch (error: any) {
    const mapped = mapHeresnowClientError(error, 'HeresNow 동기화 중 오류가 발생했습니다.');
    return res.status(mapped.status).json({
      success: false,
      message: mapped.message,
      code: mapped.code,
      error: process.env.NODE_ENV === 'development' ? String(error?.message || '') : undefined
    });
  }
};

export const previewHeresnowAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const company = await loadCompanyForUser(req);
    if (!company) {
      return res.status(404).json({ success: false, message: '회사 정보를 찾을 수 없습니다.' });
    }

    const since = typeof req.body?.since === 'string' ? req.body.since : undefined;
    const result = await pullHeresnowAttendance(company, { since, dryRun: true });

    return res.json({
      success: true,
      message: `HeresNow API 미리보기: 선택 월 기준 ${result.total}건 조회됨 (DB 미반영).`,
      data: result
    });
  } catch (error: any) {
    const mapped = mapHeresnowClientError(error, 'HeresNow 미리보기 조회 중 오류가 발생했습니다.');
    return res.status(mapped.status).json({
      success: false,
      message: mapped.message,
      code: mapped.code,
      error: process.env.NODE_ENV === 'development' ? String(error?.message || '') : undefined
    });
  }
};

export const testHeresnowAttendanceConnection = async (req: AuthRequest, res: Response) => {
  try {
    const company = await loadCompanyForUser(req);
    if (!company) {
      return res.status(404).json({ success: false, message: '회사 정보를 찾을 수 없습니다.' });
    }

    const result = await testHeresnowConnection(company);
    return res.json({
      success: true,
      message: 'HeresNow 연동 테스트에 성공했습니다.',
      data: result
    });
  } catch (error: any) {
    // HeresNow 업스트림 401을 MVS 세션 401로 내려주면 프론트가 강제 로그아웃함 — 절대 401 사용 금지
    const mapped = mapHeresnowClientError(error, 'HeresNow 연동 테스트 중 오류가 발생했습니다.');
    return res.status(mapped.status).json({
      success: false,
      message: mapped.message,
      code: mapped.code,
      error: process.env.NODE_ENV === 'development' ? String(error?.message || '') : undefined
    });
  }
};

export const updateHeresnowSettings = async (req: AuthRequest, res: Response) => {
  try {
    const company = await loadCompanyForUser(req);
    if (!company) {
      return res.status(404).json({ success: false, message: '회사 정보를 찾을 수 없습니다.' });
    }

    const { enabled, companyId, externalCompanyId, apiKey } = req.body || {};
    const current = getHeresnowSettings(company);
    const normalizedApiKey =
      typeof apiKey === 'string'
        ? apiKey.trim()
        : undefined;
    const nextSettings = mergeHeresnowSettings(company, {
      enabled: typeof enabled === 'boolean' ? enabled : current.enabled,
      companyId:
        companyId != null && String(companyId).trim()
          ? String(companyId).trim() // mergeHeresnowSettings 에서 소문자 정규화
          : current.companyId || String(company.id),
      externalCompanyId:
        externalCompanyId != null && String(externalCompanyId).trim()
          ? String(externalCompanyId).trim()
          : current.externalCompanyId || String(company.id),
      ...(normalizedApiKey !== undefined
        ? { apiKey: normalizedApiKey || undefined }
        : {})
    });

    await company.update({ settings: nextSettings });
    await company.reload();

    return res.json({
      success: true,
      message: 'HeresNow 연동 설정을 저장했습니다.',
      data: await getHeresnowIntegrationStatus(company)
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'HeresNow 연동 설정 저장 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
