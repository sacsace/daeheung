# MVS 초기 데이터 입력 프롬프트

## 개요
MVS 시스템의 초기 데이터 입력을 위한 포괄적인 가이드입니다. 이 프롬프트는 개발자와 Cursor AI가 시스템 초기화 시 필요한 모든 데이터를 체계적으로 입력할 수 있도록 도와줍니다.

## 초기 데이터 입력 순서

### 1단계: 기본 테넌트 및 회사 설정

#### 테넌트 생성
```sql
-- 기본 테넌트 생성
INSERT INTO tenant (
    tenant_code, 
    name, 
    domain, 
    subdomain, 
    plan, 
    max_users, 
    max_companies, 
    features, 
    status, 
    settings
) VALUES (
    'default', 
    'Default Tenant', 
    'localhost', 
    'default', 
    'enterprise', 
    100, 
    10, 
    '["inventory", "hr", "accounting", "ai_analysis", "communication"]', 
    'active', 
    '{"timezone": "Asia/Seoul", "language": "ko", "currency": "KRW"}'
) ON CONFLICT (tenant_code) DO NOTHING;
```

#### 회사 생성
```sql
-- 기본 회사 생성
INSERT INTO company (
    tenant_id, 
    name, 
    business_number, 
    ceo_name, 
    address, 
    phone, 
    email, 
    website, 
    industry, 
    employee_count, 
    subscription_plan, 
    subscription_status,
    company_logo,
    company_seal,
    ceo_signature,
    settings
) VALUES (
    1, 
    'MVS Company', 
    '123-45-67890', 
    '김대표', 
    '서울시 서초구 서초대로 456', 
    '02-1234-5678', 
    'info@mvs.com', 
    'https://mvs.com', 
    'IT/소프트웨어', 
    0, 
    'enterprise', 
    'active',
    NULL,
    NULL,
    NULL,
    '{"timezone": "Asia/Seoul", "language": "ko", "currency": "KRW", "tax_rate": 10}'
) ON CONFLICT (business_number) DO NOTHING;
```

### 2단계: 메뉴 구조 생성

#### 1단계 메뉴 (메인 메뉴)
```sql
-- 1단계 메뉴 생성
INSERT INTO menu (
    tenant_id, 
    parent_id, 
    code, 
    name_ko, 
    name_en, 
    icon, 
    route, 
    component, 
    order_num, 
    level, 
    is_active, 
    is_visible, 
    permissions, 
    metadata
) VALUES
-- 대시보드
(1, NULL, 'dashboard', '대시보드', 'Dashboard', 'dashboard', '/dashboard', 'Dashboard', 1, 1, true, true, '["dashboard:read"]', '{}'),
-- 기본정보관리
(1, NULL, 'basic-info', '기본정보관리', 'Basic Information Management', 'business', '/basic-info', 'BasicInfo', 2, 1, true, true, '["basic-info:read", "basic-info:update"]', '{}'),
-- 인사관리
(1, NULL, 'hr-management', '인사관리', 'HR Management', 'people', '/hr', 'HRManagement', 3, 1, true, true, '["hr:read", "hr:create", "hr:update", "hr:delete"]', '{}'),
-- 업무관리
(1, NULL, 'task-management', '업무관리', 'Task Management', 'work', '/work', 'TaskManagement', 4, 1, true, true, '["task:read", "task:create", "task:update", "task:delete"]', '{}'),
-- 회계관리
(1, NULL, 'accounting', '회계관리', 'Accounting Management', 'account_balance', '/accounting', 'Accounting', 5, 1, true, true, '["accounting:read", "accounting:create", "accounting:update", "accounting:delete"]', '{}'),
-- 재고관리
(1, NULL, 'inventory', '재고관리', 'Inventory Management', 'inventory', '/inventory', 'Inventory', 6, 1, true, true, '["inventory:read", "inventory:create", "inventory:update", "inventory:delete"]', '{}'),
-- 고객관리
(1, NULL, 'customer-management', '고객관리', 'Customer Management', 'person', '/customers', 'CustomerManagement', 7, 1, true, true, '["customer:read", "customer:create", "customer:update", "customer:delete"]', '{}'),
-- AI 분석
(1, NULL, 'ai-analysis', 'AI 분석', 'AI Analysis', 'psychology', '/ai', 'AIAnalysis', 8, 1, true, true, '["ai:read"]', '{}'),
-- 커뮤니케이션
(1, NULL, 'communication', '커뮤니케이션', 'Communication', 'chat', '/communication', 'Communication', 9, 1, true, true, '["communication:read", "communication:create"]', '{}'),
-- 시스템관리
(1, NULL, 'system-management', '시스템관리', 'System Management', 'settings', '/system', 'SystemManagement', 10, 1, true, true, '["system:read", "system:update"]', '{}');
```

#### 2단계 메뉴 (서브 메뉴)
```sql
-- 회계관리 하위 메뉴
INSERT INTO menu (
    tenant_id, 
    parent_id, 
    code, 
    name_ko, 
    name_en, 
    icon, 
    route, 
    component, 
    order_num, 
    level, 
    is_active, 
    is_visible, 
    permissions, 
    metadata
) VALUES
-- 전자세금계산서
(1, 5, 'e-invoice', '전자세금계산서', 'E-Invoice', 'receipt', '/accounting/e-invoice', 'EInvoice', 1, 2, true, true, '["e-invoice:read", "e-invoice:create", "e-invoice:update", "e-invoice:delete"]', '{}'),
-- 전자운송장
(1, 5, 'eway-bill', '전자운송장', 'E-Way Bill', 'local_shipping', '/accounting/eway-bill', 'EWayBill', 2, 2, true, true, '["eway-bill:read", "eway-bill:create", "eway-bill:update", "eway-bill:delete"]', '{}'),
-- 일반세금계산서
(1, 5, 'invoice', '일반세금계산서', 'Regular Invoice', 'description', '/accounting/invoice', 'Invoice', 3, 2, true, true, '["invoice:read", "invoice:create", "invoice:update", "invoice:delete"]', '{}'),
-- 견적서
(1, 5, 'quotation', '견적서', 'Quotation', 'request_quote', '/accounting/quotation', 'Quotation', 4, 2, true, true, '["quotation:read", "quotation:create", "quotation:update", "quotation:delete"]', '{}'),
-- 지출보고서
(1, 5, 'expense', '지출보고서', 'Expense Report', 'money_off', '/accounting/expense', 'Expense', 5, 2, true, true, '["expense:read", "expense:create", "expense:update", "expense:delete"]', '{}'),
-- 예산관리
(1, 5, 'budget', '예산관리', 'Budget Management', 'account_balance', '/accounting/budget', 'Budget', 6, 2, true, true, '["budget:read", "budget:create", "budget:update", "budget:delete"]', '{}'),
-- 자산관리
(1, 5, 'assets', '자산관리', 'Asset Management', 'account_balance', '/accounting/assets', 'Assets', 7, 2, true, true, '["assets:read", "assets:create", "assets:update", "assets:delete"]', '{}'),
-- 회계통계
(1, 5, 'accounting-statistics', '회계통계', 'Accounting Statistics', 'assessment', '/accounting/statistics', 'AccountingStatistics', 8, 2, true, true, '["accounting-statistics:read"]', '{}');

-- 재고관리 하위 메뉴
INSERT INTO menu (
    tenant_id, 
    parent_id, 
    code, 
    name_ko, 
    name_en, 
    icon, 
    route, 
    component, 
    order_num, 
    level, 
    is_active, 
    is_visible, 
    permissions, 
    metadata
) VALUES
-- 기본 재고 등록
(1, 6, 'inventory-basic', '기본 재고 등록', 'Basic Inventory Registration', 'inventory_2', '/inventory/basic', 'InventoryBasic', 1, 2, true, true, '["inventory:read", "inventory:create", "inventory:update"]', '{}'),
-- 재고 현황 조회
(1, 6, 'inventory-status', '재고 현황 조회', 'Inventory Status Check', 'inventory_2', '/inventory/status', 'InventoryStatus', 2, 2, true, true, '["inventory:read"]', '{}'),
-- 입출고 관리
(1, 6, 'inventory-transaction', '입출고 관리', 'In/Outbound Management', 'swap_horiz', '/inventory/transaction', 'InventoryTransaction', 3, 2, true, true, '["inventory:read", "inventory:create", "inventory:update"]', '{}'),
-- 재고 이동 및 조정
(1, 6, 'inventory-movement', '재고 이동 및 조정', 'Inventory Movement and Adjustment', 'inventory_2', '/inventory/movement', 'InventoryMovement', 4, 2, true, true, '["inventory:read", "inventory:create", "inventory:update"]', '{}'),
-- 재고 보고서
(1, 6, 'inventory-report', '재고 보고서', 'Inventory Report', 'assessment', '/inventory/report', 'InventoryReport', 5, 2, true, true, '["inventory:read"]', '{}');

-- 고객관리 하위 메뉴
INSERT INTO menu (
    tenant_id, 
    parent_id, 
    code, 
    name_ko, 
    name_en, 
    icon, 
    route, 
    component, 
    order_num, 
    level, 
    is_active, 
    is_visible, 
    permissions, 
    metadata
) VALUES
-- 고객 정보
(1, 7, 'customer-info', '고객 정보', 'Customer Information', 'person', '/customers/info', 'CustomerInfo', 1, 2, true, true, '["customer:read", "customer:create", "customer:update", "customer:delete"]', '{}'),
-- 영업 기회
(1, 7, 'sales-opportunity', '영업 기회', 'Sales Opportunity', 'trending_up', '/customers/sales', 'SalesOpportunity', 2, 2, true, true, '["sales:read", "sales:create", "sales:update", "sales:delete"]', '{}'),
-- 계약 관리
(1, 7, 'contract-management', '계약 관리', 'Contract Management', 'description', '/customers/contracts', 'ContractManagement', 3, 2, true, true, '["contract:read", "contract:create", "contract:update", "contract:delete"]', '{}'),
-- 고객 지원
(1, 7, 'customer-support', '고객 지원', 'Customer Support', 'support_agent', '/customers/support', 'CustomerSupport', 4, 2, true, true, '["support:read", "support:create", "support:update"]', '{}');
```

### 3단계: 사용자 생성

#### 기본 사용자 생성
```sql
-- Root 사용자 생성
INSERT INTO "user" (
    tenant_id,
    company_id,
    userid,
    username,
    email,
    password_hash,
    role,
    department,
    position,
    status,
    first_name,
    last_name,
    is_root,
    is_audit,
    is_admin,
    is_user
) VALUES (
    1,
    1,
    'root',
    'Root User',
    'root@mvs.com',
    '$2b$10$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8K8K8K8', -- password: admin123
    'root',
    'IT',
    'System Administrator',
    'active',
    'Root',
    'User',
    true,
    false,
    false,
    false
) ON CONFLICT (userid) DO NOTHING;

-- Admin 사용자 생성
INSERT INTO "user" (
    tenant_id,
    company_id,
    userid,
    username,
    email,
    password_hash,
    role,
    department,
    position,
    status,
    first_name,
    last_name,
    is_root,
    is_audit,
    is_admin,
    is_user
) VALUES (
    1,
    1,
    'admin',
    'Admin User',
    'admin@mvs.com',
    '$2b$10$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8K8K8K8', -- password: admin123
    'admin',
    'Management',
    'Administrator',
    'active',
    'Admin',
    'User',
    false,
    false,
    true,
    false
) ON CONFLICT (userid) DO NOTHING;

-- 일반 사용자 생성
INSERT INTO "user" (
    tenant_id,
    company_id,
    userid,
    username,
    email,
    password_hash,
    role,
    department,
    position,
    status,
    first_name,
    last_name,
    is_root,
    is_audit,
    is_admin,
    is_user
) VALUES (
    1,
    1,
    'user1',
    'Test User',
    'user@mvs.com',
    '$2b$10$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8K8K8K8', -- password: admin123
    'user',
    'Sales',
    'Sales Representative',
    'active',
    'Test',
    'User',
    false,
    false,
    false,
    true
) ON CONFLICT (userid) DO NOTHING;
```

### 4단계: 사용자 권한 설정

#### 사용자 메뉴 권한 설정
```sql
-- Root 사용자에게 모든 권한 부여
INSERT INTO user_permission (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
SELECT 1, id, true, true, true, true, NOW(), NOW() 
FROM menu 
WHERE tenant_id = 1
ON CONFLICT (user_id, menu_id) DO NOTHING;

-- Admin 사용자에게 읽기/생성/수정 권한 부여
INSERT INTO user_permission (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
SELECT 2, id, true, true, true, false, NOW(), NOW() 
FROM menu 
WHERE tenant_id = 1
ON CONFLICT (user_id, menu_id) DO NOTHING;

-- 일반 사용자에게 읽기 권한만 부여
INSERT INTO user_permission (user_id, menu_id, can_view, can_create, can_edit, can_delete, created_at, updated_at)
SELECT 3, id, true, false, false, false, NOW(), NOW() 
FROM menu 
WHERE tenant_id = 1
ON CONFLICT (user_id, menu_id) DO NOTHING;
```

### 5단계: 부서 및 직책 생성

#### 부서 생성
```sql
-- 기본 부서 생성
INSERT INTO department (
    tenant_id,
    company_id,
    name,
    parent_id,
    manager_id,
    description,
    is_active
) VALUES
(1, 1, '경영진', NULL, 2, '경영진 부서', true),
(1, 1, '개발팀', NULL, 1, '소프트웨어 개발팀', true),
(1, 1, '영업팀', NULL, 3, '영업 및 마케팅팀', true),
(1, 1, '인사팀', NULL, 2, '인사관리팀', true),
(1, 1, '회계팀', NULL, 2, '회계 및 재무팀', true)
ON CONFLICT (tenant_id, company_id, name) DO NOTHING;
```

#### 직책 생성
```sql
-- 기본 직책 생성
INSERT INTO position (
    tenant_id,
    company_id,
    name,
    level,
    description,
    is_active
) VALUES
(1, 1, '대표이사', 1, '최고 경영자', true),
(1, 1, '부사장', 2, '부사장', true),
(1, 1, '이사', 3, '이사', true),
(1, 1, '부장', 4, '부장', true),
(1, 1, '차장', 5, '차장', true),
(1, 1, '과장', 6, '과장', true),
(1, 1, '대리', 7, '대리', true),
(1, 1, '주임', 8, '주임', true),
(1, 1, '사원', 9, '사원', true)
ON CONFLICT (tenant_id, company_id, name) DO NOTHING;
```

### 6단계: 채팅 시스템 초기화

#### 기본 채팅방 생성
```sql
-- 기본 채팅방 생성
INSERT INTO chat_room (
    tenant_id,
    company_id,
    name,
    description,
    room_type,
    created_by,
    is_active
) VALUES
(1, 1, '전체 공지', '전체 직원 공지사항', 'group', 1, true),
(1, 1, '일반 채팅', '일반적인 업무 소통', 'group', 1, true),
(1, 1, '개발팀 채팅', '개발팀 전용 채팅방', 'group', 1, true),
(1, 1, '영업팀 채팅', '영업팀 전용 채팅방', 'group', 1, true)
ON CONFLICT (tenant_id, company_id, name) DO NOTHING;
```

### 7단계: 시스템 설정 초기화

#### 시스템 설정 생성
```sql
-- 시스템 설정 생성
INSERT INTO system_settings (
    tenant_id,
    company_id,
    setting_key,
    setting_value,
    setting_type,
    description,
    is_active
) VALUES
(1, 1, 'company_logo', '', 'string', '회사 로고 이미지 경로', true),
(1, 1, 'company_seal', '', 'string', '회사 인감 이미지 경로', true),
(1, 1, 'ceo_signature', '', 'string', '대표 서명 이미지 경로', true),
(1, 1, 'default_currency', 'KRW', 'string', '기본 통화', true),
(1, 1, 'default_tax_rate', '10', 'number', '기본 세율 (%)', true),
(1, 1, 'timezone', 'Asia/Seoul', 'string', '기본 시간대', true),
(1, 1, 'language', 'ko', 'string', '기본 언어', true),
(1, 1, 'date_format', 'YYYY-MM-DD', 'string', '날짜 형식', true),
(1, 1, 'time_format', '24', 'string', '시간 형식 (12/24)', true),
(1, 1, 'pagination_size', '20', 'number', '페이지당 항목 수', true)
ON CONFLICT (tenant_id, company_id, setting_key) DO NOTHING;
```

### 8단계: 샘플 비즈니스 데이터 생성

#### 고객 데이터 생성
```sql
-- 샘플 고객 생성
INSERT INTO customer (
    tenant_id,
    company_id,
    name,
    business_number,
    ceo_name,
    address,
    phone,
    email,
    website,
    industry,
    status
) VALUES
(1, 1, 'ABC 제조업체', '234-56-78901', '이대표', '서울시 강남구 테헤란로 123', '02-1234-5678', 'contact@abc.com', 'https://abc.com', '제조업', 'active'),
(1, 1, 'XYZ 금융회사', '345-67-89012', '박대표', '경기도 성남시 분당구 판교로 789', '031-1111-2222', 'billing@xyz.com', 'https://xyz.com', '금융', 'active'),
(1, 1, 'DEF 소프트웨어', '456-78-90123', '최대표', '부산시 해운대구 센텀중앙로 456', '051-3333-4444', 'info@def.com', 'https://def.com', 'IT/소프트웨어', 'active')
ON CONFLICT (tenant_id, company_id, business_number) DO NOTHING;
```

#### 제품 데이터 생성
```sql
-- 샘플 제품 생성
INSERT INTO product (
    tenant_id,
    company_id,
    product_code,
    name,
    description,
    category,
    unit_price,
    cost_price,
    stock_quantity,
    min_stock_level,
    max_stock_level,
    unit,
    tax_rate,
    status,
    created_by
) VALUES
(1, 1, 'PROD-001', '노트북 컴퓨터', '고성능 노트북 컴퓨터', '전자제품', 1500000.00, 1200000.00, 50, 10, 100, '대', 10, 'active', 1),
(1, 1, 'PROD-002', '모니터', '24인치 LED 모니터', '전자제품', 300000.00, 240000.00, 100, 20, 200, '대', 10, 'active', 1),
(1, 1, 'PROD-003', '키보드', '무선 키보드', '전자제품', 80000.00, 60000.00, 200, 50, 500, '개', 10, 'active', 1),
(1, 1, 'PROD-004', '마우스', '무선 마우스', '전자제품', 50000.00, 35000.00, 150, 30, 300, '개', 10, 'active', 1)
ON CONFLICT (tenant_id, company_id, product_code) DO NOTHING;
```

### 9단계: 성능 최적화 인덱스 생성

#### 성능 최적화 인덱스
```sql
-- 성능 최적화를 위한 인덱스 생성
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenant_company_user ON "user" (tenant_id, company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenant_company_menu ON menu (tenant_id, company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenant_company_customer ON customer (tenant_id, company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenant_company_product ON product (tenant_id, company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenant_company_invoice ON invoice (tenant_id, company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenant_company_chat_room ON chat_room (tenant_id, company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenant_company_chat_message ON chat_message (tenant_id, company_id, room_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenant_company_notification ON notification (tenant_id, company_id, user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenant_company_system_log ON system_log (tenant_id, company_id, user_id);

-- 통계 정보 업데이트
ANALYZE;
```

## 초기 데이터 입력 스크립트 실행

### PowerShell 스크립트
```powershell
# MVS 초기 데이터 입력 스크립트
Write-Host "🚀 MVS 초기 데이터 입력 시작..." -ForegroundColor Green

# PostgreSQL 연결 확인
Write-Host "📊 PostgreSQL 연결 확인 중..." -ForegroundColor Yellow
$connectionString = "postgresql://mvs_user:mvs_password@localhost:5432/mvs"

# 초기 데이터 입력
Write-Host "🌱 초기 데이터 입력 중..." -ForegroundColor Yellow

# 1단계: 기본 테넌트 및 회사 설정
Write-Host "1️⃣ 기본 테넌트 및 회사 설정..." -ForegroundColor Cyan
psql $connectionString -f "scripts/init-tenant-company.sql"

# 2단계: 메뉴 구조 생성
Write-Host "2️⃣ 메뉴 구조 생성..." -ForegroundColor Cyan
psql $connectionString -f "sql-queries/02-menu-management/complete-menu-with-submenus.sql"

# 3단계: 사용자 생성
Write-Host "3️⃣ 사용자 생성..." -ForegroundColor Cyan
psql $connectionString -f "scripts/insert-users.sql"

# 4단계: 사용자 권한 설정
Write-Host "4️⃣ 사용자 권한 설정..." -ForegroundColor Cyan
psql $connectionString -f "sql-queries/03-user-permissions/create-user-permissions.sql"

# 5단계: 부서 및 직책 생성
Write-Host "5️⃣ 부서 및 직책 생성..." -ForegroundColor Cyan
psql $connectionString -f "scripts/init-departments-positions.sql"

# 6단계: 채팅 시스템 초기화
Write-Host "6️⃣ 채팅 시스템 초기화..." -ForegroundColor Cyan
psql $connectionString -f "scripts/init-chat-system.sql"

# 7단계: 시스템 설정 초기화
Write-Host "7️⃣ 시스템 설정 초기화..." -ForegroundColor Cyan
psql $connectionString -f "scripts/init-system-settings.sql"

# 8단계: 샘플 비즈니스 데이터 생성
Write-Host "8️⃣ 샘플 비즈니스 데이터 생성..." -ForegroundColor Cyan
psql $connectionString -f "scripts/insert-sample-data.sql"

# 9단계: 성능 최적화 인덱스 생성
Write-Host "9️⃣ 성능 최적화 인덱스 생성..." -ForegroundColor Cyan
psql $connectionString -f "scripts/create-performance-indexes.sql"

Write-Host "✅ MVS 초기 데이터 입력 완료!" -ForegroundColor Green
Write-Host "📋 생성된 데이터:" -ForegroundColor Yellow
Write-Host "   - 테넌트: 1개" -ForegroundColor White
Write-Host "   - 회사: 1개" -ForegroundColor White
Write-Host "   - 사용자: 3명 (root, admin, user1)" -ForegroundColor White
Write-Host "   - 메뉴: 30개 (1단계 10개, 2단계 20개)" -ForegroundColor White
Write-Host "   - 부서: 5개" -ForegroundColor White
Write-Host "   - 직책: 9개" -ForegroundColor White
Write-Host "   - 채팅방: 4개" -ForegroundColor White
Write-Host "   - 고객: 3개" -ForegroundColor White
Write-Host "   - 제품: 4개" -ForegroundColor White
Write-Host "   - 시스템 설정: 10개" -ForegroundColor White
Write-Host "" -ForegroundColor White
Write-Host "🔑 기본 로그인 정보:" -ForegroundColor Yellow
Write-Host "   사용자 ID: root, admin, user1" -ForegroundColor White
Write-Host "   비밀번호: admin123" -ForegroundColor White
```

### Node.js 스크립트
```javascript
// daeheung-rt-one-api/scripts/init-sample-data.js
const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 MVS 초기 데이터 입력 시작...\n');

try {
  // 데이터베이스 마이그레이션 실행
  console.log('📊 데이터베이스 마이그레이션 실행 중...');
  execSync('npx sequelize-cli db:migrate', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  // 시드 데이터 실행
  console.log('\n🌱 시드 데이터 삽입 중...');
  execSync('npx sequelize-cli db:seed:all', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  // 샘플 데이터 초기화
  console.log('\n📝 샘플 데이터 초기화 중...');
  const { initializeSampleData } = require('../src/data/sampleData');
  await initializeSampleData();

  console.log('\n🎉 MVS 초기 데이터 입력 완료!');
  console.log('\n📋 생성된 데이터:');
  console.log('   - 테넌트: 1개');
  console.log('   - 회사: 1개');
  console.log('   - 사용자: 3명 (root, admin, user1)');
  console.log('   - 메뉴: 30개 (1단계 10개, 2단계 20개)');
  console.log('   - 부서: 5개');
  console.log('   - 직책: 9개');
  console.log('   - 채팅방: 4개');
  console.log('   - 고객: 3개');
  console.log('   - 제품: 4개');
  console.log('   - 시스템 설정: 10개');
  console.log('\n🔑 기본 로그인 정보:');
  console.log('   사용자 ID: root, admin, user1');
  console.log('   비밀번호: admin123');

} catch (error) {
  console.error('\n❌ 초기 데이터 입력 중 오류가 발생했습니다:', error.message);
  process.exit(1);
}
```

## 데이터 검증

### 초기 데이터 검증 쿼리
```sql
-- 초기 데이터 검증
SELECT 
    '테넌트' as table_name, 
    COUNT(*) as count 
FROM tenant
UNION ALL
SELECT 
    '회사' as table_name, 
    COUNT(*) as count 
FROM company
UNION ALL
SELECT 
    '사용자' as table_name, 
    COUNT(*) as count 
FROM "user"
UNION ALL
SELECT 
    '메뉴' as table_name, 
    COUNT(*) as count 
FROM menu
UNION ALL
SELECT 
    '사용자 권한' as table_name, 
    COUNT(*) as count 
FROM user_permission
UNION ALL
SELECT 
    '부서' as table_name, 
    COUNT(*) as count 
FROM department
UNION ALL
SELECT 
    '직책' as table_name, 
    COUNT(*) as count 
FROM position
UNION ALL
SELECT 
    '채팅방' as table_name, 
    COUNT(*) as count 
FROM chat_room
UNION ALL
SELECT 
    '고객' as table_name, 
    COUNT(*) as count 
FROM customer
UNION ALL
SELECT 
    '제품' as table_name, 
    COUNT(*) as count 
FROM product
UNION ALL
SELECT 
    '시스템 설정' as table_name, 
    COUNT(*) as count 
FROM system_settings
ORDER BY table_name;
```

## 주의사항

### 1. 데이터 무결성
- 모든 외래키 관계가 올바르게 설정되었는지 확인
- 중복 데이터가 없는지 확인 (ON CONFLICT 사용)
- 필수 필드가 누락되지 않았는지 확인

### 2. 권한 설정
- 사용자별 메뉴 권한이 올바르게 설정되었는지 확인
- 역할별 권한 차이가 명확한지 확인
- 보안상 민감한 데이터는 적절히 보호되었는지 확인

### 3. 성능 최적화
- 인덱스가 적절히 생성되었는지 확인
- 쿼리 성능이 최적화되었는지 확인
- 대용량 데이터 처리 시 성능 이슈가 없는지 확인

### 4. 테스트 계정
- 테스트용 계정의 비밀번호는 보안상 변경 권장
- 프로덕션 환경에서는 샘플 데이터 삭제 권장
- 실제 사용자 데이터로 교체 권장

## 문제 해결

### 일반적인 문제
1. **외래키 제약 조건 오류**: 테이블 생성 순서 확인
2. **중복 데이터 오류**: ON CONFLICT 절 사용
3. **권한 설정 오류**: 사용자 ID와 메뉴 ID 매칭 확인
4. **인덱스 생성 오류**: CONCURRENTLY 옵션 사용

### 로그 확인
```sql
-- 오류 로그 확인
SELECT * FROM system_log 
WHERE log_level = 'ERROR' 
ORDER BY created_at DESC 
LIMIT 10;

-- 사용자 활동 로그 확인
SELECT * FROM system_log 
WHERE user_id IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 10;
```

---

**이 프롬프트를 사용하여 MVS 시스템의 초기 데이터를 체계적으로 입력할 수 있습니다. 각 단계별로 순서대로 실행하면 안정적인 시스템 초기화가 가능합니다.**
