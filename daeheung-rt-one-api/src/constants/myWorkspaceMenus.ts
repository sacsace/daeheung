/**
 * 「내 정보·업무」메뉴 트리 최종 정의 (시드·수리 마이그레이션 공용)
 */
export const MY_WORKSPACE_PARENT = {
  route: '/my',
  name_ko: '내 정보·업무',
  name_en: 'My Profile & Work',
  icon: 'Person',
  order: 1,
  description: '내 정보·업무',
} as const;

export const MY_WORKSPACE_CHILDREN = [
  {
    /** 사이트 첫 화면 경로 유지 — 메뉴만 「내 정보·업무」 하위 */
    route: '/dashboard',
    name_ko: '대시보드',
    name_en: 'Dashboard',
    icon: 'dashboard',
    order: 1,
  },
  {
    route: '/my/personal-info',
    name_ko: '개인 정보',
    name_en: 'Personal Information',
    icon: 'person',
    order: 2,
  },
  {
    route: '/my/attendance',
    name_ko: '출퇴근 기록',
    name_en: 'My Attendance',
    icon: 'schedule',
    order: 3,
  },
  {
    route: '/my/leave',
    name_ko: '휴가 관리',
    name_en: 'Leave Management',
    icon: 'event',
    order: 4,
  },
  {
    route: '/my/payslips',
    name_ko: '급여 명세서',
    name_en: 'My Payslips',
    icon: 'payments',
    order: 5,
  },
  {
    route: '/my/contracts',
    name_ko: '내 계약서',
    name_en: 'My Contracts',
    icon: 'description',
    order: 6,
  },
  {
    route: '/my/notices',
    name_ko: '공지사항',
    name_en: 'Notices',
    icon: 'campaign',
    order: 7,
  },
  {
    route: '/my/work-list',
    name_ko: '내 업무 리스트',
    name_en: 'My Work List',
    icon: 'assignment',
    order: 8,
  },
  {
    route: '/my/company-policies',
    name_ko: '회사 정책',
    name_en: 'Company Policies',
    icon: 'policy',
    order: 9,
  },
  {
    route: '/my/mail-settings',
    name_ko: '설정',
    name_en: 'Settings',
    icon: 'settings',
    order: 10,
  },
] as const;

/** 일반 직원 셀프서비스(+업무 보드 진입) 경로 */
export const EMPLOYEE_SELF_SERVICE_ROUTES = [
  MY_WORKSPACE_PARENT.route,
  ...MY_WORKSPACE_CHILDREN.map((c) => c.route),
  '/work/projects',
] as const;

export function isMyWorkspaceRoute(route?: string | null): boolean {
  if (typeof route !== 'string' || !route) return false;
  return route === '/my' || route.startsWith('/my/');
}

/** 대시보드는 /my 하위 메뉴이지만 경로·첫 화면은 /dashboard 유지 */
export function isDashboardMenuRoute(route?: string | null): boolean {
  if (typeof route !== 'string' || !route) return false;
  return route === '/dashboard' || route.startsWith('/dashboard/');
}
