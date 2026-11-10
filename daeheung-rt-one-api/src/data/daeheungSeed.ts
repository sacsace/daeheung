import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import {
  Tenant,
  Company,
  User,
  Menu,
  Customer,
} from '../models';
import {
  MY_WORKSPACE_CHILDREN,
  MY_WORKSPACE_PARENT,
} from '../constants/myWorkspaceMenus';

const TENANT_ID = 1;

export const MINSUB_COMPANY = {
  name: 'Daeheung R&T',
  business_number: 'MSV-IN-2025-001',
  ceo_name: 'Minsub Lee',
  address: 'Hyderabad, Telangana, India',
  phone: '+91-40-1234-5678',
  email: 'minsub.lee@gmail.com',
  website: 'https://www.msventures.in',
  industry: 'IT / Software Services',
  employee_count: 25,
  subscription_plan: 'enterprise',
  subscription_status: 'active',
  login_time_start: '09:00:00',
  login_time_end: '18:00:00',
  timezone: 'Asia/Kolkata',
  settings: {},
};

const PARENT_MENUS = [
  {
    name_ko: MY_WORKSPACE_PARENT.name_ko,
    name_en: MY_WORKSPACE_PARENT.name_en,
    route: MY_WORKSPACE_PARENT.route,
    icon: MY_WORKSPACE_PARENT.icon,
    order: MY_WORKSPACE_PARENT.order,
  },
  { name_ko: '기본정보', name_en: 'Master Data Management', route: '/basic-info', icon: 'Info', order: 3 },
  { name_ko: '인사 관리', name_en: 'HR', route: '/hr', icon: 'People', order: 4 },
  { name_ko: '업무 관리', name_en: 'Work', route: '/work', icon: 'Work', order: 5 },
  { name_ko: '매입/매출 관리', name_en: 'Purchasing & Sales', route: '/sales', icon: 'trending_up', order: 6 },
  { name_ko: '재고 관리', name_en: 'Inventory Management', route: '/inventory', icon: 'Inventory', order: 7 },
  { name_ko: '생산 추적', name_en: 'Production Tracking', route: '/production', icon: 'Inventory', order: 14 },
  { name_ko: '회계관리', name_en: 'Accounting', route: '/accounting', icon: 'AccountBalance', order: 8 },
  { name_ko: '알람', name_en: 'Notifications', route: '/communication', icon: 'Forum', order: 9 },
  { name_ko: 'AI 분석', name_en: 'AI', route: '/ai', icon: 'Psychology', order: 10 },
  { name_ko: '보고서', name_en: 'Reports', route: '/reports', icon: 'Assessment', order: 11 },
  { name_ko: '기숙사 관리', name_en: 'Dormitory Management', route: '/hotel', icon: 'Hotel', order: 12 },
  { name_ko: '시스템', name_en: 'System', route: '/system', icon: 'Settings', order: 13 },
];

const SUB_MENUS: Record<string, Array<{ name_ko: string; name_en: string; route: string; icon: string; order: number }>> = {
  '/my': MY_WORKSPACE_CHILDREN.map((c) => ({
    name_ko: c.name_ko,
    name_en: c.name_en,
    route: c.route,
    icon: c.icon,
    order: c.order,
  })),
  '/basic-info': [
    { name_ko: '내 회사 정보', name_en: 'My Company', route: '/basic-info/company', icon: 'business', order: 1 },
    { name_ko: '파트너 업체/고객 관리', name_en: 'Partners / Customers', route: '/basic-info/partners', icon: 'business', order: 2 },
    { name_ko: '조직도 관리', name_en: 'Organization', route: '/basic-info/organization', icon: 'account_tree', order: 3 },
    { name_ko: '메뉴권한관리', name_en: 'Menu Permissions', route: '/basic-info/menu-permissions', icon: 'lock', order: 4 },
    { name_ko: '로그인 정보 관리', name_en: 'Login Info', route: '/basic-info/login-info', icon: 'person', order: 5 },
    { name_ko: '시스템 설정', name_en: 'System Settings', route: '/basic-info/system-settings', icon: 'settings', order: 6 },
  ],
  '/hr': [
    { name_ko: '사용자 관리', name_en: 'Users', route: '/hr/users', icon: 'people', order: 1 },
    { name_ko: '전자근로계약', name_en: 'Employment Contracts', route: '/hr/employment-contracts', icon: 'description', order: 2 },
    { name_ko: '근태 관리', name_en: 'Attendance', route: '/hr/attendance', icon: 'schedule', order: 3 },
    { name_ko: '근태 통계', name_en: 'Attendance Statistics', route: '/hr/attendance/statistics', icon: 'assessment', order: 4 },
    { name_ko: '휴가 관리', name_en: 'Leave', route: '/hr/leave', icon: 'event', order: 5 },
    { name_ko: '급여 관리', name_en: 'Payroll', route: '/hr/payroll', icon: 'payments', order: 6 },
    { name_ko: '급여 명세서 발송', name_en: 'Payslip Delivery', route: '/hr/payslip-send', icon: 'email', order: 7 },
  ],
  '/work': [
    { name_ko: '업무 관리', name_en: 'Projects', route: '/work/projects', icon: 'view_kanban', order: 1 },
    { name_ko: '프로젝트 관리', name_en: 'Project Management', route: '/work/project-management', icon: 'folder_special', order: 2 },
    { name_ko: '고객사 리스트', name_en: 'Client List', route: '/work/assignee-list', icon: 'assignment_ind', order: 3 },
    { name_ko: '계약 관리', name_en: 'Contracts', route: '/customers/contracts', icon: 'description', order: 4 },
    { name_ko: '전자결재', name_en: 'Approval', route: '/work/approval', icon: 'approval', order: 5 },
    { name_ko: '업무 보고서', name_en: 'Reports', route: '/work/reports', icon: 'assessment', order: 6 },
    { name_ko: '업무 통계', name_en: 'Statistics', route: '/work/statistics', icon: 'bar_chart', order: 7 },
  ],
  '/sales': [
    { name_ko: '견적서', name_en: 'Quotation', route: '/accounting/quotation', icon: 'request_quote', order: 1 },
    { name_ko: '프로포마인보이스', name_en: 'Proforma Invoice', route: '/accounting/proforma', icon: 'description', order: 2 },
    { name_ko: '전자세금계산서', name_en: 'E-Invoice', route: '/accounting/e-invoice', icon: 'receipt_long', order: 3 },
    { name_ko: '일반세금계산서', name_en: 'Invoice', route: '/accounting/invoice', icon: 'receipt', order: 4 },
    { name_ko: '지출결의서', name_en: 'Expense', route: '/accounting/expense', icon: 'money_off', order: 5 },
    { name_ko: '매입/매출 통계', name_en: 'Purchasing & Sales Stats', route: '/accounting/statistics', icon: 'assessment', order: 6 },
  ],
  '/inventory': [
    { name_ko: '기초재고 등록', name_en: 'Basic Inventory', route: '/inventory/basic', icon: 'inventory_2', order: 1 },
    { name_ko: '재고 현황 확인', name_en: 'Inventory Status', route: '/inventory/status', icon: 'inventory_2', order: 2 },
    { name_ko: '입고 관리', name_en: 'Stock In', route: '/inventory/stock-in', icon: 'move_to_inbox', order: 3 },
    { name_ko: '출고 관리', name_en: 'Stock Out', route: '/inventory/stock-out', icon: 'outbox', order: 4 },
    { name_ko: '재고 보고서', name_en: 'Inventory Report', route: '/inventory/report', icon: 'assessment', order: 5 },
  ],
  '/accounting': [
    { name_ko: '계정과목', name_en: 'Chart of Accounts', route: '/accounting/chart-of-accounts', icon: 'account_tree', order: 1 },
    { name_ko: '회계 마스터', name_en: 'Accounting Masters', route: '/accounting/settings/masters', icon: 'tune', order: 2 },
    { name_ko: '전표 입력', name_en: 'Voucher Entry', route: '/accounting/voucher-entry', icon: 'receipt_long', order: 3 },
    { name_ko: '전표 조회', name_en: 'Voucher List', route: '/accounting/voucher-list', icon: 'list_alt', order: 4 },
    { name_ko: '증빙 전표', name_en: 'Document Voucher', route: '/accounting/document-voucher', icon: 'upload_file', order: 5 },
    { name_ko: '회계장부', name_en: 'General Ledger', route: '/accounting/books', icon: 'menu_book', order: 6 },
    { name_ko: '예산 관리', name_en: 'Budget', route: '/accounting/budget', icon: 'account_balance', order: 7 },
    { name_ko: '자산 관리', name_en: 'Assets', route: '/accounting/assets', icon: 'account_balance', order: 8 },
    { name_ko: '손익계산서', name_en: 'Profit & Loss', route: '/accounting/profit-and-loss', icon: 'trending_up', order: 9 },
    { name_ko: '법인세 계산', name_en: 'Corporate Tax', route: '/accounting/corporate-tax', icon: 'payments', order: 10 },
    { name_ko: 'Advance Tax', name_en: 'Advance Tax', route: '/accounting/advance-tax', icon: 'payments', order: 11 },
  ],
  '/communication': [
    { name_ko: '이메일', name_en: 'Email', route: '/communication/email', icon: 'email', order: 2 },
    { name_ko: 'SMS', name_en: 'SMS', route: '/communication/sms', icon: 'sms', order: 3 },
    {
      name_ko: '알림 프로그램',
      name_en: 'Desktop Notifier',
      route: '/communication/desktop-notifier',
      icon: 'download',
      order: 4,
    },
  ],
  '/ai': [
    { name_ko: '비용 분석', name_en: 'Cost Analysis', route: '/ai/cost-analysis', icon: 'analytics', order: 1 },
    { name_ko: '효율 지표', name_en: 'Efficiency Metrics', route: '/ai/efficiency-metrics', icon: 'speed', order: 2 },
    { name_ko: '예측 데이터', name_en: 'Forecasting', route: '/ai/forecasting-data', icon: 'trending_up', order: 3 },
    { name_ko: '추천 엔진', name_en: 'Recommendations', route: '/ai/recommendation-engine', icon: 'psychology', order: 4 },
  ],
  '/reports': [
    { name_ko: '매출 보고서', name_en: 'Sales Report', route: '/reports/sales', icon: 'bar_chart', order: 1 },
    { name_ko: '재고 보고서', name_en: 'Inventory Report', route: '/reports/inventory', icon: 'pie_chart', order: 2 },
    { name_ko: '고객 보고서', name_en: 'Customer Report', route: '/reports/customers', icon: 'people', order: 3 },
    { name_ko: '재무 보고서', name_en: 'Financial Report', route: '/reports/financial', icon: 'account_balance', order: 4 },
    { name_ko: 'AI 보고서', name_en: 'AI Report', route: '/reports/ai', icon: 'psychology', order: 5 },
  ],
  '/production': [
    { name_ko: '로트', name_en: 'Lots', route: '/production/lots', icon: 'inventory_2', order: 1 },
  ],
  '/hotel': [
    { name_ko: '프론트 데스크', name_en: 'Front Desk', route: '/hotel/front-desk', icon: 'desk', order: 1 },
    { name_ko: '투숙객 명단', name_en: 'Guest List', route: '/hotel/room-reservation', icon: 'hotel', order: 2 },
    { name_ko: '예약 현황 관리', name_en: 'Reservation Status', route: '/hotel/reservations', icon: 'event_available', order: 3 },
    { name_ko: '객실 유형 관리', name_en: 'Room Types', route: '/hotel/room-types', icon: 'meeting_room', order: 4 },
  ],
};

async function ensureTenant() {
  const [tenant] = await (Tenant as any).findOrCreate({
    where: { subdomain: 'mvs3' },
    defaults: {
      name: 'Daeheung R&T One',
      domain: 'mvsystem.in',
      subdomain: 'mvs3',
      plan: 'enterprise',
      max_users: 200,
      max_companies: 1,
      features: ['inventory', 'hr', 'accounting', 'ai_analysis', 'hotel'],
      status: 'active',
    },
  });
  const placeholderName = String(tenant.name || '');
  if (
    placeholderName === 'MVS Solutions' ||
    placeholderName === 'MVS' ||
    /minsub ventures/i.test(placeholderName) ||
    Number(tenant.max_companies) !== 1
  ) {
    await tenant.update({
      name: /minsub ventures|^mvs(\s|$)/i.test(placeholderName) || placeholderName === 'MVS Solutions'
        ? 'Daeheung R&T One'
        : tenant.name,
      max_companies: 1,
    });
  }
  return tenant;
}

async function ensureMinsubCompany(tenantId: number) {
  let company = await (Company as any).findOne({
    where: {
      tenant_id: tenantId,
      [Op.or]: [
        { name: { [Op.iLike]: '%Daeheung%' } },
        { name: { [Op.iLike]: '%Minsub Ventures%' } },
        { business_number: MINSUB_COMPANY.business_number },
      ],
    },
    order: [['id', 'ASC']],
  });

  if (!company) {
    company = await (Company as any).findOne({
      where: { tenant_id: tenantId },
      order: [['id', 'ASC']],
    });
  }

  if (!company) {
    company = await (Company as any).create({
      tenant_id: tenantId,
      ...MINSUB_COMPANY,
    });
    console.log('  ✅ Daeheung R&T 회사 생성');
    return company;
  }

  const currentName = String(company.name || '');
  if (currentName === 'MVS Solutions' || currentName === 'Default Tenant') {
    await company.update({ name: 'Daeheung R&T' });
    console.log(`  ✅ 회사명을 Daeheung R&T 로 변경 (id=${company.id})`);
  }

  return company;
}

async function ensureMenus(tenantId: number) {
  const parentIds = new Map<string, number>();

  for (const menu of PARENT_MENUS) {
    const [row, created] = await (Menu as any).findOrCreate({
      where: { tenant_id: tenantId, route: menu.route },
      defaults: {
        tenant_id: tenantId,
        parent_id: null,
        level: 0,
        is_active: true,
        description: menu.name_ko,
        ...menu,
      },
    });
    if (!created) {
      await row.update({
        name_ko: menu.name_ko,
        name_en: menu.name_en,
        icon: menu.icon,
        order: menu.order,
        level: 0,
        parent_id: null,
        // import-menus 로 비활성화·이름 변경된 메뉴를 배포 시드가 되돌리지 않음
      });
    }
    parentIds.set(menu.route, row.id);
  }

  let submenuCount = 0;
  for (const [parentRoute, children] of Object.entries(SUB_MENUS)) {
    const parentId = parentIds.get(parentRoute);
    if (!parentId) continue;

    for (const submenu of children) {
      const [row, created] = await (Menu as any).findOrCreate({
        where: { tenant_id: tenantId, route: submenu.route },
        defaults: {
          tenant_id: tenantId,
          parent_id: parentId,
          level: 1,
          is_active: true,
          description: submenu.name_ko,
          ...submenu,
        },
      });
      if (!created && row.parent_id !== parentId) {
        await row.update({ parent_id: parentId, level: 1, ...submenu });
      }
      submenuCount++;
    }
  }

  console.log(`  ✅ 메뉴 ${PARENT_MENUS.length}개 + 하위 ${submenuCount}개`);
}

async function ensureUsers(tenantId: number, companyId: number) {
  const passwordHash = await bcrypt.hash('admin123', 10);
  const users = [
    { userid: 'root', username: 'Root User', email: 'root@mvs3.com', role: 'root' as const },
    { userid: 'admin', username: 'Admin User', email: 'admin@mvs3.com', role: 'admin' as const },
    { userid: 'user1', username: 'User One', email: 'user1@mvs3.com', role: 'user' as const },
  ];

  const createdUsers: any[] = [];
  for (const u of users) {
    const [user, created] = await (User as any).findOrCreate({
      where: { tenant_id: tenantId, userid: u.userid },
      defaults: {
        ...u,
        tenant_id: tenantId,
        company_id: companyId,
        password_hash: passwordHash,
        status: 'active',
        department: 'Management',
        position: 'Manager',
      },
    });
    await user.update({ company_id: companyId, password_hash: passwordHash, status: 'active' });
    createdUsers.push(user);
    console.log(`  ✅ 사용자 ${u.userid} (company_id=${companyId})`);
  }
  return createdUsers;
}

/** 구 샘플 데이터 잔존 메뉴 비활성화 (신규 트리와 중복) */
const LEGACY_MENU_ROUTES = ['/system', '/payroll', '/reports'];

async function cleanupLegacyMenus(tenantId: number) {
  const [result] = await sequelize.query(
    `UPDATE menus SET is_active = false, updated_at = NOW()
     WHERE tenant_id = $1::int AND parent_id IS NULL AND route = ANY($2::varchar[])`,
    { bind: [tenantId, LEGACY_MENU_ROUTES] }
  );
  const rowCount = (result as { rowCount?: number })?.rowCount ?? 0;
  if (rowCount > 0) {
    console.log(`  ✅ 레거시 메뉴 ${rowCount}개 비활성화 (${LEGACY_MENU_ROUTES.join(', ')})`);
  }
}

/** root/admin — 활성 메뉴 전체에 CRUD 권한 동기화 (기본 템플릿) */
async function syncFullMenuPermissions(tenantId: number, userIds: number[]) {
  for (const userId of userIds) {
    await sequelize.query(
      `DELETE FROM user_permissions
       WHERE user_id = $1::int
         AND menu_id NOT IN (SELECT id FROM menus WHERE tenant_id = $2::int AND is_active = true)`,
      { bind: [userId, tenantId] }
    );

    const [menus] = await sequelize.query(
      `SELECT id FROM menus WHERE tenant_id = $1::int AND is_active = true ORDER BY id`,
      { bind: [tenantId] }
    );
    const menuIds = (menus as { id: number }[]).map((m) => m.id);

    for (const menuId of menuIds) {
      const [existing] = await sequelize.query(
        `SELECT id FROM user_permissions WHERE user_id = $1::int AND menu_id = $2::int LIMIT 1`,
        { bind: [userId, menuId] }
      );
      if ((existing as unknown[]).length > 0) {
        await sequelize.query(
          `UPDATE user_permissions SET can_view=true, can_create=true, can_edit=true, can_delete=true, updated_at=NOW()
           WHERE user_id = $1::int AND menu_id = $2::int`,
          { bind: [userId, menuId] }
        );
      } else {
        await sequelize.query(
          `INSERT INTO user_permissions (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
           VALUES ($1::int, $2::int, true, true, true, true, NOW(), NOW())`,
          { bind: [userId, menuId] }
        );
      }
    }

    console.log(`  ✅ user_id=${userId} 메뉴 권한 ${menuIds.length}건 동기화 (전체 CRUD)`);
  }
}

async function ensurePermissions(tenantId: number, users: any[]) {
  await cleanupLegacyMenus(tenantId);

  const privileged = users.filter((u) => ['root', 'admin'].includes(u.role));
  const userIds = privileged.map((u) => Number(u.id)).filter((id) => Number.isFinite(id));

  if (userIds.length === 0) {
    console.warn('  ⚠️  root/admin 사용자 없음 — 메뉴 권한 건너뜀');
  } else {
    await syncFullMenuPermissions(tenantId, userIds);
  }

  // 모든 역할 — 「내 정보·업무」기본 보기
  const { grantEmployeeSelfServicePermissions } = await import('../utils/employeeSelfServicePermissions');
  for (const u of users) {
    const n = await grantEmployeeSelfServicePermissions({
      userId: Number(u.id),
      tenantId,
      role: u.role,
    });
    console.log(`  ✅ user_id=${u.id} (${u.role}) 내 정보·업무 기본 권한 (${n}건 신규)`);
  }
}

async function ensureBusinessData(tenantId: number, companyId: number, createdBy: number) {
  try {
  const customers = [
    { name: 'TechNova India Pvt Ltd', business_number: 'CUST-001', email: 'contact@technova.in', phone: '+91-98765-43210' },
    { name: 'Global Trade Partners', business_number: 'CUST-002', email: 'sales@gtp.com', phone: '+91-91234-56789' },
    { name: 'Hyderabad Software Hub', business_number: 'CUST-003', email: 'info@hsh.in', phone: '+91-99887-76655' },
  ];

  const customerRows: any[] = [];
  for (const c of customers) {
    const [row] = await (Customer as any).findOrCreate({
      where: { tenant_id: tenantId, company_id: companyId, business_number: c.business_number },
      defaults: {
        tenant_id: tenantId,
        company_id: companyId,
        status: 'active',
        industry: 'Technology',
        ...c,
      },
    });
    customerRows.push(row);
  }

  const products = [
    { product_code: 'MSV-001', name: 'MVS Enterprise License', category: 'Software', unit_price: 50000, cost_price: 20000, stock_quantity: 50, min_stock_level: 10, unit: 'EA' },
    { product_code: 'MSV-002', name: 'Cloud Hosting Package', category: 'Service', unit_price: 12000, cost_price: 5000, stock_quantity: 5, min_stock_level: 10, unit: 'EA' },
    { product_code: 'MSV-003', name: 'Support Maintenance Kit', category: 'Service', unit_price: 8000, cost_price: 3000, stock_quantity: 25, min_stock_level: 5, unit: 'EA' },
    { product_code: 'MSV-004', name: 'Hardware Integration Module', category: 'Hardware', unit_price: 35000, cost_price: 22000, stock_quantity: 3, min_stock_level: 5, unit: 'EA' },
  ];

  for (const p of products) {
    await sequelize.query(
      `INSERT INTO products (
        tenant_id, company_id, product_code, name, description, category,
        unit_price, cost_price, stock_quantity, min_stock_level, max_stock_level,
        unit, tax_rate, status, created_by, created_at, updated_at
      )
      SELECT $1::int, $2::int, $3::varchar, $4::varchar, $5::text, $6::varchar,
             $7::numeric, $8::numeric, $9::numeric, $10::numeric, $11::numeric,
             $12::varchar, $13::numeric, $14::varchar, $15::int, NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM products WHERE product_code = $3::varchar)`,
      {
        bind: [
          tenantId,
          companyId,
          p.product_code,
          p.name,
          p.name,
          p.category,
          p.unit_price,
          p.cost_price,
          p.stock_quantity,
          p.min_stock_level,
          200,
          p.unit,
          18,
          'active',
          createdBy,
        ],
      }
    );
  }

  console.log(`  ✅ 고객 ${customers.length} · 제품 ${products.length} (샘플 인보이스 시드 생략)`);
  } catch (error: any) {
    console.warn('  ⚠️  샘플 거래 데이터 일부 실패 (회사·메뉴는 적용됨):', error?.message);
  }
}

async function ensureNotices(companyId: number, authorId: number) {
  const [exists] = await sequelize.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'notices'
    ) AS exists;
  `);
  if (!(exists as any[])[0]?.exists) {
    console.log('  ⏭️  notices 테이블 없음 — 공지 건너뜀');
    return;
  }

  const notices = [
    { title: 'Minsub Ventures 시스템 오픈', content: 'MVS 3.0 프로덕션 환경이 준비되었습니다.', category: 'general', priority: 'high' },
    { title: '월간 재고 점검 안내', content: '매월 마지막 주 금요일 재고 실사를 진행합니다.', category: 'policy', priority: 'medium' },
  ];

  for (const n of notices) {
    try {
      await sequelize.query(
        `INSERT INTO notices (tenant_id, company_id, title, content, category, priority, status, author_id, is_public, is_active, created_at, updated_at)
         SELECT $1::int, $2::int, $3::varchar, $4::text, $5::"enum_notices_category", $6::"enum_notices_priority", 'published'::"enum_notices_status", $7::int, true, true, NOW(), NOW()
         WHERE NOT EXISTS (SELECT 1 FROM notices WHERE company_id = $2::int AND title = $3::varchar)`,
        { bind: [TENANT_ID, companyId, n.title, n.content, n.category, n.priority, authorId] }
      );
    } catch (noticeError: any) {
      console.warn(`  ⚠️  공지 "${n.title}" 건너뜀:`, noticeError?.message);
    }
  }
  console.log(`  ✅ 공지 ${notices.length}건 시도`);
}

export async function seedDaeheungData() {
  console.log('\n🏢 Minsub Ventures 초기 데이터 시드...');

  const tenant = await ensureTenant();
  const company = await ensureMinsubCompany(tenant.id);
  await ensureMenus(tenant.id);
  const users = await ensureUsers(tenant.id, company.id);
  await ensurePermissions(tenant.id, users);

  const rootUser = users.find((u) => u.userid === 'root') || users[0];
  await ensureBusinessData(tenant.id, company.id, rootUser.id);
  await ensureNotices(company.id, rootUser.id);

  console.log('✅ Minsub Ventures 초기 데이터 시드 완료\n');
  return { tenantId: tenant.id, companyId: company.id };
}
