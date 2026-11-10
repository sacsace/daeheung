import { Company } from '../models';

import { canSelectOtherCompany } from './companyScope';

/**
 * 일반 사용자는 로그인 회사.
 * root/audit는 query/body의 company_id가 같은 테넌트 회사일 때 그 회사를 사용한다.
 */
export async function resolveRequestCompanyId(req: {
  user?: { role?: string; company_id?: number; tenant_id?: number };
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}): Promise<number> {
  const user = req.user || {};
  const loginCompanyId = Number(user.company_id);
  if (!canSelectOtherCompany(user.role)) {
    return loginCompanyId;
  }

  const raw = req.query?.company_id ?? req.body?.company_id ?? req.body?.companyId;
  const requested = Number(raw);
  if (!Number.isFinite(requested) || requested <= 0) {
    return loginCompanyId;
  }

  const company = await (Company as any).findOne({
    where: { id: requested, tenant_id: user.tenant_id },
    attributes: ['id'],
  });
  if (!company) {
    const error: any = new Error('선택한 회사를 찾을 수 없습니다.');
    error.status = 400;
    throw error;
  }
  return Number(company.id);
}
