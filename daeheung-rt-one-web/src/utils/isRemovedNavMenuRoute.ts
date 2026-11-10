/** DB 메뉴에 남아 있어도 네비게이션에서 숨길 경로 (제거된 화면) */
export function isRemovedNavMenuRoute(route: string | undefined | null): boolean {
  const n = String(route || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (n === 'customers/support' || n === 'customers/info') return true;
  // 미사용 AI 분석 메뉴
  if (n === 'ai' || n.startsWith('ai/')) return true;
  // 레거시 시스템관리 (기본정보관리의 시스템 설정으로 대체)
  if (n === 'system' || n.startsWith('system/')) return true;
  return false;
}
