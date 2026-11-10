import { SAMPLE_DATA } from '../config/constants';

// 샘플 사용자 데이터
export const sampleUsers = [
  {
    tenant_id: 1,
    company_id: 1,
    userid: 'developer',
    username: SAMPLE_DATA.USERS.DEVELOPER,
    email: 'developer@mvs3.com',
    password_hash: '$2b$10$example_hash_developer', // 실제로는 bcrypt로 해시된 값
    role: 'admin' as const,
    department: SAMPLE_DATA.DEPARTMENTS.DEVELOPMENT,
    position: SAMPLE_DATA.POSITIONS.TEAM_LEAD,
    status: 'active' as const
  },
  {
    tenant_id: 1,
    company_id: 1,
    userid: 'frontend',
    username: SAMPLE_DATA.USERS.FRONTEND,
    email: 'frontend@mvs3.com',
    password_hash: '$2b$10$example_hash_frontend',
    role: 'user' as const,
    department: SAMPLE_DATA.DEPARTMENTS.DEVELOPMENT,
    position: SAMPLE_DATA.POSITIONS.DEVELOPER,
    status: 'active' as const
  },
  {
    tenant_id: 1,
    company_id: 1,
    userid: 'backend',
    username: SAMPLE_DATA.USERS.BACKEND,
    email: 'backend@mvs3.com',
    password_hash: '$2b$10$example_hash_backend',
    role: 'user' as const,
    department: SAMPLE_DATA.DEPARTMENTS.DEVELOPMENT,
    position: SAMPLE_DATA.POSITIONS.DEVELOPER,
    status: 'active' as const
  },
  {
    tenant_id: 1,
    company_id: 1,
    userid: 'marketing',
    username: SAMPLE_DATA.USERS.MARKETING,
    email: 'marketing@mvs3.com',
    password_hash: '$2b$10$example_hash_marketing',
    role: 'user' as const,
    department: SAMPLE_DATA.DEPARTMENTS.MARKETING,
    position: SAMPLE_DATA.POSITIONS.MANAGER,
    status: 'active' as const
  }
];

// 샘플 회사 데이터
export const sampleCompanies = [
  {
    tenant_id: 1,
    name: SAMPLE_DATA.COMPANIES.MVS,
    business_number: '123-45-67890',
    ceo_name: '김대표',
    address: '서울시 서초구 서초대로 456',
    phone: '02-9876-5432',
    email: 'info@mvs3.com',
    website: 'https://mvs3.com',
    industry: 'IT/소프트웨어',
    employee_count: 50,
    subscription_plan: 'premium',
    subscription_status: 'active',
    login_time_start: '09:00:00',
    login_time_end: '18:00:00',
    timezone: 'Asia/Kolkata',
    settings: {}
  },
  {
    tenant_id: 1,
    name: SAMPLE_DATA.COMPANIES.ABC,
    business_number: '234-56-78901',
    ceo_name: '이대표',
    address: '서울시 강남구 테헤란로 123',
    phone: '02-1234-5678',
    email: 'contact@abc.com',
    industry: '제조업',
    employee_count: 200,
    subscription_plan: 'enterprise',
    subscription_status: 'active',
    login_time_start: '09:00:00',
    login_time_end: '18:00:00',
    timezone: 'Asia/Kolkata',
    settings: {}
  },
  {
    tenant_id: 1,
    name: SAMPLE_DATA.COMPANIES.XYZ,
    business_number: '345-67-89012',
    ceo_name: '박대표',
    address: '경기도 성남시 분당구 판교로 789',
    phone: '031-1111-2222',
    email: 'billing@xyz.com',
    industry: '금융',
    employee_count: 500,
    subscription_plan: 'enterprise',
    subscription_status: 'active',
    login_time_start: '09:00:00',
    login_time_end: '18:00:00',
    timezone: 'Asia/Kolkata',
    settings: {}
  }
];

// 샘플 테넌트 데이터
export const sampleTenants = [
  {
    name: 'MVS Solutions',
    domain: 'mvs3.com',
    subdomain: 'mvs3',
    plan: 'premium' as const,
    max_users: 1000,
    max_companies: 10,
    features: ['inventory', 'hr', 'accounting', 'ai_analysis'],
    status: 'active' as const
  }
];

// 샘플 메뉴 데이터
export const sampleMenus = [
  // 대시보드
  {
    tenant_id: 1,
    name_ko: '대시보드',
    name_en: 'Dashboard',
    route: '/dashboard',
    icon: 'Dashboard',
    order: 1,
    level: 0,
    is_active: true,
    description: '메인 대시보드'
  },
  // 재고 관리
  {
    tenant_id: 1,
    name_ko: '재고 관리',
    name_en: 'Inventory',
    route: '/inventory',
    icon: 'Inventory',
    order: 2,
    level: 0,
    is_active: true,
    description: '재고 관리 시스템'
  },
  // 인사 관리
  {
    tenant_id: 1,
    name_ko: '인사 관리',
    name_en: 'HR',
    route: '/hr',
    icon: 'People',
    order: 3,
    level: 0,
    is_active: true,
    description: '인사 관리 시스템'
  },
  // 급여 관리
  {
    tenant_id: 1,
    name_ko: '급여 관리',
    name_en: 'Payroll',
    route: '/payroll',
    icon: 'AttachMoney',
    order: 3.1,
    level: 1,
    parent_id: null, // 인사 관리 하위 메뉴로 설정할 예정
    is_active: true,
    description: '급여 관리 시스템'
  },
  // 회계 관리
  {
    tenant_id: 1,
    name_ko: '회계 관리',
    name_en: 'Accounting',
    route: '/accounting',
    icon: 'AccountBalance',
    order: 4,
    level: 0,
    is_active: true,
    description: '회계 관리 시스템'
  },
  // 시스템 설정
  {
    tenant_id: 1,
    name_ko: '시스템 설정',
    name_en: 'System',
    route: '/system',
    icon: 'Settings',
    order: 5,
    level: 0,
    is_active: true,
    description: '시스템 설정'
  }
];

// 샘플 데이터 초기화 함수
export const initializeSampleData = async () => {
  const { Tenant, Company, User, Menu } = await import('../models');
  
  try {
    // 테넌트 생성
    const tenant = await (Tenant as any).findOrCreate({
      where: { subdomain: 'mvs3' },
      defaults: sampleTenants[0]
    });
    
    // 회사 생성
    for (const companyData of sampleCompanies) {
      await (Company as any).findOrCreate({
        where: { tenant_id: tenant[0].id, business_number: companyData.business_number },
        defaults: { ...companyData, tenant_id: tenant[0].id }
      });
    }
    
    // 사용자 생성
    for (const userData of sampleUsers) {
      await (User as any).findOrCreate({
        where: { tenant_id: tenant[0].id, userid: userData.userid },
        defaults: { ...userData, tenant_id: tenant[0].id }
      });
    }
    
    // 메뉴 생성
    for (const menuData of sampleMenus) {
      await (Menu as any).findOrCreate({
        where: { tenant_id: tenant[0].id, route: menuData.route },
        defaults: { ...menuData, tenant_id: tenant[0].id }
      });
    }
    
    console.log('✅ 샘플 데이터 초기화 완료');
  } catch (error) {
    console.error('❌ 샘플 데이터 초기화 실패:', error);
  }
};
