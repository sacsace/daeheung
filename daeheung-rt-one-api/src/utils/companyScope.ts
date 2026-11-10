import { RequestWithUser } from '../types';
import { IS_STANDALONE } from '../config/standalone';

/** 단독 시스템에서는 역할과 관계없이 로그인 회사만 사용한다 */
export const canSelectOtherCompany = (role?: string | null): boolean => {
  if (IS_STANDALONE) return false;
  return role === 'root' || role === 'audit';
};

/** root/audit는 query·body의 company_id로 회사 전환, 그 외는 로그인 회사 고정 */
export const resolveCompanyId = (req: RequestWithUser): number => {
  const { company_id, role } = req.user;
  const raw =
    req.query.company_id ??
    req.query.companyId ??
    req.body?.company_id ??
    req.body?.companyId;
  const parsed = raw != null ? parseInt(String(raw), 10) : NaN;
  const hasOverride = Number.isFinite(parsed) && parsed > 0;

  if (canSelectOtherCompany(role) && hasOverride) {
    return parsed;
  }
  return company_id;
};

export const resolveCompanyScope = (req: RequestWithUser) => {
  const { tenant_id } = req.user;
  return { tenantId: tenant_id, companyId: resolveCompanyId(req) };
};
