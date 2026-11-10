import { Company } from '../models';

/** Daeheung R&T One — 단일 회사 배포. 테넌트/회사 컬럼은 유지하고 전환·추가만 막는다. */

export const IS_STANDALONE = true;
export const PRODUCT_NAME = 'Daeheung R&T One';
export const OPERATING_COMPANY_NAME = 'Daeheung R&T';

const companyIdByTenant = new Map<number, number>();

/** 소속 회사가 없는 계정은 해당 테넌트의 첫 활성 회사로 요청 범위를 고정한다. */
export async function attachStandaloneCompany<T extends { tenant_id?: number; company_id?: number | null }>(
  user: T
): Promise<T> {
  if (!IS_STANDALONE) return user;
  const current = Number(user.company_id);
  if (Number.isFinite(current) && current > 0) return user;

  const tenantId = Number(user.tenant_id);
  if (!Number.isFinite(tenantId) || tenantId <= 0) return user;

  const cached = companyIdByTenant.get(tenantId);
  if (cached) return { ...user, company_id: cached };

  const row = await (Company as any).findOne({
    where: { tenant_id: tenantId, status: 'active' },
    order: [['id', 'ASC']],
    attributes: ['id'],
  });
  if (!row) return user;

  const companyId = Number(row.id);
  companyIdByTenant.set(tenantId, companyId);
  return { ...user, company_id: companyId };
}
