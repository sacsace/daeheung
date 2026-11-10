import { useReferenceDataStore } from '../store/referenceDataStore';
import { IS_STANDALONE } from '../config/deployment';

/** 서버 `requireRootOrMinsubEmployee` 와 동일: root 또는 Minsub Ventures 소속 */
export function isMinsubCompanyName(name?: string | null): boolean {
  if (!name) return false;
  return name.toLowerCase().includes('minsub ventures');
}

/** Minsub Ventures 회사에만 노출하는 메뉴 route */
export const MINSUB_ONLY_MENU_ROUTES = ['/work/assignee-list'] as const;

export function isMinsubOnlyMenuRoute(route?: string | null): boolean {
  if (!route) return false;
  return MINSUB_ONLY_MENU_ROUTES.some(
    (base) => route === base || route.startsWith(`${base}/`)
  );
}

/** 비 Minsub 회사면 Minsub 전용 메뉴를 트리에서 제거 */
export function filterMenusForMinsubCompany<T extends { route?: string | null; children?: T[] }>(
  menus: T[],
  companyName?: string | null
): T[] {
  if (IS_STANDALONE || isMinsubCompanyName(companyName)) return menus;
  return menus
    .filter((m) => !isMinsubOnlyMenuRoute(m.route))
    .map((m) =>
      m.children?.length
        ? { ...m, children: filterMenusForMinsubCompany(m.children, companyName) }
        : m
    );
}

export async function canAccessSystemLoginHistory(user?: {
  role?: string | null;
  company_id?: number | null;
} | null): Promise<boolean> {
  if (!user) return false;
  if (IS_STANDALONE || user.role === 'root') return true;
  const companyId = Number(user.company_id);
  if (!Number.isFinite(companyId) || companyId <= 0) return false;
  try {
    const company = await useReferenceDataStore.getState().fetchCompanyById(companyId);
    return isMinsubCompanyName(company?.name);
  } catch {
    return false;
  }
}

/** 고객사 리스트 등 Minsub 전용 화면 접근 */
export async function canAccessMinsubOnlyWorkMenus(user?: {
  role?: string | null;
  company_id?: number | null;
} | null): Promise<boolean> {
  return canAccessSystemLoginHistory(user);
}
