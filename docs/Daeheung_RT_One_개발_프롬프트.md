# MVS 개발 프롬프트

> **문서 갱신**: 2026-04-27 — 보안·Railway·환경 변수·UI 반영 사항 추가  
> **권장 후속**: PostgreSQL SSL CA 검증 강화, Helmet CSP 점진 도입, DB RLS(민감 테이블) 검토

## 프로젝트 개요
MVS은 React + Node.js + PostgreSQL 기반의 **차세대 기업용 통합 업무 관리 시스템**입니다.
**1인 개발자 환경**에 최적화된 네이티브 개발 환경을 사용하며, **멀티테넌트 SaaS 플랫폼**으로 설계되었습니다.

### 핵심 비즈니스 모델
- **멀티테넌트 아키텍처**: 여러 회사가 독립적으로 사용하는 SaaS 플랫폼
- **회사 중심 관리**: 각 회사별로 독립적인 데이터와 사용자 관리
- **세밀한 권한 제어**: 사용자별 메뉴 접근 권한을 세분화하여 관리
- **통합 업무 시스템**: 인사, 회계, 재고, 고객관리 등 모든 업무를 하나의 시스템에서 처리

## 시스템 아키텍처

### 핵심 특징
- **멀티테넌트 아키텍처**: 테넌트별 완전한 데이터 격리 및 독립 운영
- **계층적 메뉴 시스템**: 3단계 계층 구조의 동적 메뉴 관리
- **세밀한 권한 제어**: 사용자별 메뉴 접근 권한 (조회/생성/수정/삭제)
- **실시간 협업**: WebSocket 기반 실시간 알림 및 채팅
- **AI 통합**: 스마트 분석 및 자동화 기능
- **클라우드 네이티브**: Railway 기반 확장 가능한 인프라
- **다국어 지원**: 한국어/영어 메뉴 및 인터페이스 지원

### 기술 스택
- **Frontend**: React 18, TypeScript, Material-UI v5, Create React App (`react-scripts`), Zustand
- **Backend**: Node.js 20, Express, Sequelize ORM, Socket.io
- **Database**: PostgreSQL 15, Redis (캐싱)
- **인증**: JWT + OAuth 2.0, Multi-Factor Authentication
- **배포**: Railway, AWS
- **모니터링**: Prometheus, Grafana, ELK Stack, Sentry
- **다국어**: i18next (한국어/영어)

## 개발 환경 설정

### 개발 환경 유형
- **네이티브 환경**: 1인 개발자 최적화 설정
  - PostgreSQL과 Redis를 로컬에 직접 설치
  - 프론트엔드/백엔드는 npm으로 직접 실행
  - 빠른 개발 속도와 간단한 환경 관리

### 필수 도구 설치 순서
1. **Node.js 20+** 설치
2. **PostgreSQL 15** 네이티브 설치
3. **Redis** 네이티브 설치
4. **Git** 설치 (이미 설치됨)

### 개발 서버 실행 순서
```bash
# 1. PostgreSQL과 Redis 서비스 시작
net start postgresql-x64-17
net start redis

# 2. 백엔드 서버 실행
cd daeheung-rt-one-api && npm run dev

# 3. 프론트엔드 서버 실행 (새 터미널)
cd daeheung-rt-one-web && npm start
```

### 접속 URL
- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:5000
- **API 문서**: http://localhost:5000/api/health

## 프로젝트 구조
```
MVS/
├── daeheung-rt-one-api/          # 백엔드 API 서버
│   ├── src/
│   │   ├── controllers/ # API 컨트롤러
│   │   ├── models/      # Sequelize 모델
│   │   ├── routes/      # API 라우트
│   │   ├── services/    # 비즈니스 로직
│   │   ├── middleware/  # 미들웨어
│   │   └── utils/       # 유틸리티
│   └── src/__tests__/   # Jest 설정·백엔드 테스트
├── daeheung-rt-one-web/        # 프론트엔드 React 앱
│   ├── src/
│   │   ├── components/  # React 컴포넌트
│   │   ├── pages/       # 페이지 컴포넌트
│   │   ├── hooks/       # 커스텀 훅
│   │   ├── services/    # API 서비스
│   │   ├── store/       # Zustand 스토어
│   │   ├── types/       # TypeScript 타입
│   │   └── utils/       # 유틸리티
│   └── tests/           # 프론트엔드 테스트
├── server/                # 로컬 서버 기동·중지 PowerShell (start-server.ps1 등)
├── scripts/               # 배포 및 기타 유틸리티 스크립트
└── railway.toml           # Railway 배포 설정
```

## 개발 가이드라인

### 코드 스타일
- **언어**: 모든 주석과 문서는 한국어로 작성
- **네이밍**: camelCase (변수, 함수), PascalCase (컴포넌트, 클래스)
- **타입**: TypeScript strict 모드 사용
- **포맷팅**: Prettier + ESLint 자동 적용

### 개발 원칙
1. **멀티테넌트 우선**: 모든 데이터 조작 시 `tenant_id` 필터링 필수
2. **권한 체크**: 모든 API 엔드포인트에 권한 검사 미들웨어 적용
3. **에러 처리**: 일관된 에러 응답 형식 사용
4. **타입 안전성**: TypeScript strict 모드로 타입 안전성 보장
5. **재사용성**: 공통 컴포넌트와 유틸리티 함수 최대한 활용
6. **성능 최적화**: 데이터베이스 쿼리 최적화 및 인덱스 활용
7. **보안**: SQL 인젝션, XSS 등 보안 취약점 방지; **시크릿·API 키는 코드에 하드코딩하지 않고** 환경 변수만 사용 (아래 「보안 가이드라인」)
8. **테스트**: 단위 테스트 및 통합 테스트 작성
9. **문서화**: API 문서 및 코드 주석 작성
10. **버전 관리**: 의미있는 커밋 메시지 작성

### 로깅 및 불필요한 코드
- **애플리케이션 소스**(`daeheung-rt-one-web/src`, `daeheung-rt-one-api/src`)에는 디버깅용 `console.log` / `console.info` / `console.debug`를 남기지 않는다. (일회성 CLI·`scripts/` 유지보수 스크립트는 예외)
- **민감 정보**(JWT·비밀번호·전체 요청 본문 등)는 콘솔·로그에 출력하지 않는다.
- **실패·경고**는 `console.error` / `console.warn` 또는 프로젝트 표준 로거로만 남긴다. 서버 기동 한 줄 요약·DB 연결 성공 등 운영에 필요한 최소 메시지는 허용한다.
- **빈 `useEffect`**, 주석만 남은 디버그 블록, 사용하지 않는 import는 제거한다.
- 로컬 실행 중 생성되는 **`daeheung-rt-one-api/server-log.txt`** 등 산출 로그 파일은 저장소에 포함하지 않는다(`.gitignore` 참고).

## 메뉴 구성 시스템

### 메뉴 구조 (3단계 계층)
```
1단계 (Level 1) - 메인 메뉴
├── Dashboard (대시보드)
├── 기본정보관리 (Basic Information Management)
├── 인사관리 (HR Management)
├── 업무관리 (Task Management)
├── 회계관리 (Accounting Management)
├── 재고관리 (Inventory Management)
├── 고객관리 (Customer Management)
├── AI 분석 (AI Analysis)
├── 커뮤니케이션 (Communication)
└── 시스템관리 (System Management)

2단계 (Level 2) - 서브 메뉴
예: 회계관리 하위
├── 전자세금계산서 (E-Invoice)
├── 전자운송장 (E-Way Bill)
├── 일반세금계산서 (Regular Invoice)
├── 견적서 (Quotation)
├── 지출보고서 (Expense Report)
├── 예산관리 (Budget Management)
├── 자산관리 (Asset Management)
└── 회계통계 (Accounting Statistics)

3단계 (Level 3) - 세부 기능 (필요시)
```

### 메뉴 테이블 구조
```sql
CREATE TABLE menu (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenant(id),  -- 테넌트별 격리
    parent_id INTEGER REFERENCES menu(id),    -- 계층 구조
    name_ko VARCHAR(255) NOT NULL,             -- 한국어 메뉴명
    name_en VARCHAR(255) NOT NULL,            -- 영어 메뉴명
    route VARCHAR(255),                       -- 라우트 경로
    icon VARCHAR(100),                        -- 아이콘
    order_num INTEGER DEFAULT 0,             -- 정렬 순서
    level INTEGER DEFAULT 1,                 -- 계층 레벨
    is_active BOOLEAN DEFAULT true,           -- 활성화 상태
    is_visible BOOLEAN DEFAULT true,         -- 표시 여부
    permissions JSONB DEFAULT '[]',           -- 기본 권한 설정
    metadata JSONB DEFAULT '{}',             -- 메타데이터
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 사용자 권한 시스템
```sql
CREATE TABLE user_permission (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES "user"(id),
    menu_id INTEGER REFERENCES menu(id),
    can_view BOOLEAN DEFAULT false,      -- 조회 권한
    can_create BOOLEAN DEFAULT false,    -- 생성 권한
    can_edit BOOLEAN DEFAULT false,      -- 수정 권한
    can_delete BOOLEAN DEFAULT false,    -- 삭제 권한
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, menu_id)             -- 사용자-메뉴 조합 유니크
);
```

### 권한 체크 로직
```typescript
// 프론트엔드 권한 체크
const hasPermission = (menuId: number, action: 'view' | 'create' | 'edit' | 'delete') => {
  const permission = userPermissions.find(p => p.menu_id === menuId);
  if (!permission) return false;
  
  switch (action) {
    case 'view': return permission.can_view;
    case 'create': return permission.can_create;
    case 'edit': return permission.can_edit;
    case 'delete': return permission.can_delete;
    default: return false;
  }
};
```

## 관계형 데이터베이스 구성

### 핵심 테이블 구조 (30개 테이블)

#### 1. 멀티테넌트 기반 테이블
```sql
-- 테넌트 (최상위 엔티티)
tenants (id, name, domain, subdomain, plan, max_users, max_companies, features, status)

-- 회사 (비즈니스 중심 엔티티)
companies (id, tenant_id, name, business_number, ceo_name, address, phone, email, website, industry, employee_count, company_logo, company_seal, ceo_signature)

-- 사용자 (인증 및 권한)
users (id, tenant_id, company_id, userid, username, email, password_hash, role, department, position, status, last_login)
```

#### 2. 비즈니스 핵심 테이블
```sql
-- 고객 관리
customers (id, tenant_id, company_id, name, business_number, ceo_name, address, phone, email, website, industry, status)

-- 제품 관리
products (id, tenant_id, company_id, product_code, name, description, category, unit_price, cost_price, stock_quantity, min_stock_level, max_stock_level, unit, tax_rate, status, created_by)

-- 프로젝트 관리
projects (id, tenant_id, company_id, customer_id, name, description, start_date, end_date, status, budget, created_by)

-- 계약 관리
contracts (id, tenant_id, company_id, customer_id, project_id, contract_number, contract_date, amount, status, created_by)

-- 인보이스 관리
invoices (id, tenant_id, company_id, customer_id, invoice_number, invoice_date, due_date, subtotal, tax_amount, total_amount, status, payment_status, payment_method, payment_date, notes, created_by)

-- 인보이스 항목
invoice_items (id, invoice_id, item_name, description, quantity, unit_price, total_price, tax_rate, tax_amount)
```

#### 3. 인사관리 테이블
```sql
-- 부서
departments (id, tenant_id, company_id, name, parent_id, manager_id, description)

-- 직책
positions (id, tenant_id, company_id, name, level, description)

-- 출근 기록
attendance_records (id, tenant_id, company_id, user_id, date, check_in_time, check_out_time, work_hours, status)

-- 휴가 신청
leave_requests (id, tenant_id, company_id, user_id, leave_type, start_date, end_date, days, reason, status, approved_by)

-- 급여
payrolls (id, tenant_id, company_id, user_id, month, year, basic_salary, allowances, deductions, net_salary, status)

-- 급여 기록
payroll_records (id, payroll_id, item_name, amount, type, description)

-- 업무 보고서
work_reports (id, tenant_id, company_id, user_id, report_date, content, status, created_at)
```

#### 4. 재고관리 테이블
```sql
-- 재고 거래
inventory_transactions (id, tenant_id, company_id, product_id, transaction_type, quantity, unit_price, total_amount, reference_number, notes, created_by)
```

#### 5. 회계관리 테이블
```sql
-- 지출
expenses (id, tenant_id, company_id, expense_date, amount, category, description, receipt_image, approved_by, status)

-- 예산
budgets (id, tenant_id, company_id, budget_year, budget_month, department_id, category, budget_amount, spent_amount, remaining_amount)
```

#### 6. 영업/마케팅 테이블
```sql
-- 영업 기회
sales_opportunities (id, tenant_id, company_id, customer_id, opportunity_name, stage, probability, expected_value, expected_close_date, assigned_to, status)

-- 지원 티켓
support_tickets (id, tenant_id, company_id, customer_id, ticket_number, subject, description, priority, status, assigned_to, created_by)

-- 지원 응답
support_responses (id, ticket_id, response_text, response_type, created_by, created_at)
```

#### 7. 시스템 테이블
```sql
-- 메뉴
menus (id, tenant_id, parent_id, name_ko, name_en, route, icon, order_num, level, is_active, is_visible, permissions, metadata)

-- 사용자 권한
user_permissions (id, user_id, menu_id, can_view, can_create, can_edit, can_delete)

-- 공지사항
notices (id, tenant_id, company_id, title, content, priority, is_active, created_by, created_at)

-- 시스템 로그
system_logs (id, tenant_id, company_id, user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, created_at)

-- 백업
backups (id, tenant_id, backup_type, file_path, file_size, status, created_at)

-- 작업
tasks (id, tenant_id, company_id, project_id, title, description, assigned_to, priority, status, due_date, created_by)

-- 채팅방
chat_rooms (id, tenant_id, company_id, name, type, created_by, created_at)

-- 채팅 메시지
chat_messages (id, room_id, user_id, message, message_type, created_at)
```

### 테이블 관계도 (ERD)

#### 핵심 관계
```
tenants (1) ←→ (N) companies
tenants (1) ←→ (N) users
tenants (1) ←→ (N) menus

companies (1) ←→ (N) users
companies (1) ←→ (N) customers
companies (1) ←→ (N) products
companies (1) ←→ (N) projects
companies (1) ←→ (N) contracts
companies (1) ←→ (N) invoices

users (1) ←→ (N) attendance_records
users (1) ←→ (N) leave_requests
users (1) ←→ (N) payrolls
users (1) ←→ (N) work_reports
users (1) ←→ (N) tasks
users (1) ←→ (N) chat_messages

customers (1) ←→ (N) projects
customers (1) ←→ (N) invoices
customers (1) ←→ (N) support_tickets

projects (1) ←→ (N) tasks
projects (1) ←→ (N) contracts

invoices (1) ←→ (N) invoice_items

support_tickets (1) ←→ (N) support_responses

chat_rooms (1) ←→ (N) chat_messages
```

### 데이터 격리 전략

#### 1. 테넌트 레벨 격리
- 모든 테이블에 `tenant_id` 필드 필수
- 테넌트별 완전한 데이터 분리
- 테넌트 삭제 시 관련 데이터 모두 삭제 (CASCADE)

#### 2. 회사 레벨 격리
- 비즈니스 데이터에 `company_id` 필드 추가
- 회사별 독립적인 데이터 관리
- 회사 삭제 시 관련 데이터 모두 삭제 (CASCADE)

#### 3. 사용자 권한 격리
- `user_permissions` 테이블로 메뉴별 접근 권한 제어
- 사용자별 다른 메뉴 구성 가능
- 역할 기반 권한 (root, audit, admin, user)

### 인덱스 전략

#### 주요 인덱스
```sql
-- 기본 인덱스
CREATE INDEX idx_tenants_domain ON tenants(domain);
CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_companies_business_number ON companies(business_number);
CREATE INDEX idx_users_userid ON users(userid);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_products_product_code ON products(product_code);
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);

-- 성능 최적화 인덱스
CREATE INDEX idx_tenant_id ON [table_name](tenant_id);
CREATE INDEX idx_company_id ON [table_name](company_id);
CREATE INDEX idx_user_id ON [table_name](user_id);
CREATE INDEX idx_customer_id ON [table_name](customer_id);
CREATE INDEX idx_invoice_id ON [table_name](invoice_id);
CREATE INDEX idx_parent_id ON menus(parent_id);
```

### 비즈니스 규칙

#### 1. 데이터 무결성
- 사업자등록번호 중복 불가
- 사용자 ID 중복 불가
- 이메일 중복 불가
- 제품 코드 중복 불가
- 인보이스 번호 중복 불가

#### 2. 권한 규칙
- 테넌트당 최대 사용자 수 제한
- 테넌트당 최대 회사 수 제한
- 플랜별 기능 활성화/비활성화
- 사용자별 메뉴 접근 권한 세분화

#### 3. 상태 관리
- 대부분의 엔티티에 `status` 필드로 상태 관리
- 활성화/비활성화 상태 구분
- 삭제 시 논리적 삭제 고려 (soft delete)

## Cursor AI 개발 가이드

### 코드 작성 규칙

#### 1. 파일 구조 이해
```
daeheung-rt-one-api/src/
├── controllers/     # API 엔드포인트 로직
├── models/         # Sequelize 데이터베이스 모델
├── routes/         # Express 라우터 정의
├── services/       # 비즈니스 로직
├── middleware/     # 인증, 권한, 로깅 미들웨어
└── utils/          # 유틸리티 함수

daeheung-rt-one-web/src/
├── components/     # 재사용 가능한 React 컴포넌트
├── pages/          # 페이지 컴포넌트
├── hooks/          # 커스텀 React 훅
├── services/       # API 호출 서비스
├── store/          # Zustand 상태 관리
├── types/          # TypeScript 타입 정의
└── utils/          # 유틸리티 함수
```

#### 2. 데이터베이스 모델 작성 예시
```typescript
// daeheung-rt-one-api/src/models/User.ts
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

interface UserAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  userid: string;
  username: string;
  email: string;
  password_hash: string;
  role: 'root' | 'audit' | 'admin' | 'user';
  department?: string;
  position?: string;
  status: 'active' | 'inactive';
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'created_at' | 'updated_at'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public userid!: string;
  public username!: string;
  public email!: string;
  public password_hash!: string;
  public role!: 'root' | 'audit' | 'admin' | 'user';
  public department?: string;
  public position?: string;
  public status!: 'active' | 'inactive';
  public last_login?: Date;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

User.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'tenants',
      key: 'id',
    },
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'companies',
      key: 'id',
    },
  },
  userid: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  username: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('root', 'audit', 'admin', 'user'),
    allowNull: false,
    defaultValue: 'user',
  },
  department: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  position: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active',
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  sequelize,
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default User;
```

#### 3. 컨트롤러 작성 예시
```typescript
// daeheung-rt-one-api/src/controllers/userController.ts
import { Request, Response } from 'express';
import { User, Company } from '../models';
import { Op } from 'sequelize';

// 사용자 목록 조회 (테넌트별 필터링)
export const getUsers = async (req: Request, res: Response) => {
  try {
    const { tenantId, companyId } = req.params;
    const { page = 1, limit = 10, search, role, status } = req.query;

    const whereClause: any = {
      tenant_id: tenantId,
    };

    if (companyId) {
      whereClause.company_id = companyId;
    }

    if (search) {
      whereClause[Op.or] = [
        { username: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { userid: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (role) {
      whereClause.role = role;
    }

    if (status) {
      whereClause.status = status;
    }

    const users = await User.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name', 'business_number'],
        },
      ],
      limit: Number(limit),
      offset: (Number(page) - 1) * Number(limit),
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: {
        users: users.rows,
        pagination: {
          total: users.count,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(users.count / Number(limit)),
        },
      },
      message: '사용자 목록을 성공적으로 조회했습니다.',
    });
  } catch (error) {
    console.error('사용자 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
};

// 사용자 생성
export const createUser = async (req: Request, res: Response) => {
  try {
    const { tenantId, companyId } = req.params;
    const userData = req.body;

    // 비밀번호 해싱
    const bcrypt = require('bcrypt');
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(userData.password, saltRounds);

    const user = await User.create({
      ...userData,
      tenant_id: tenantId,
      company_id: companyId,
      password_hash,
    });

    res.status(201).json({
      success: true,
      data: user,
      message: '사용자가 성공적으로 생성되었습니다.',
    });
  } catch (error) {
    console.error('사용자 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 생성 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
};
```

#### 4. 프론트엔드 컴포넌트 작성 예시
```typescript
// daeheung-rt-one-web/src/components/UserList.tsx
import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
} from '@mui/material';
import { Edit, Delete, Add } from '@mui/icons-material';
import { useStore } from '../store';
import { User } from '../types';

interface UserListProps {
  tenantId: number;
  companyId?: number;
}

const UserList: React.FC<UserListProps> = ({ tenantId, companyId }) => {
  const { user } = useStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // 사용자 목록 조회
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/users/${tenantId}/${companyId || ''}`);
      const data = await response.json();
      if (data.success) {
        setUsers(data.data.users);
      }
    } catch (error) {
      console.error('사용자 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [tenantId, companyId]);

  // 권한 체크
  const hasPermission = (action: 'create' | 'edit' | 'delete') => {
    // 메뉴 권한 체크 로직
    return true; // 임시
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">사용자 관리</Typography>
        {hasPermission('create') && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setOpen(true)}
          >
            사용자 추가
          </Button>
        )}
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>사용자 ID</TableCell>
              <TableCell>이름</TableCell>
              <TableCell>이메일</TableCell>
              <TableCell>역할</TableCell>
              <TableCell>부서</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>작업</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.userid}</TableCell>
                <TableCell>{user.username}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Chip
                    label={user.role}
                    color={user.role === 'admin' ? 'primary' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{user.department}</TableCell>
                <TableCell>
                  <Chip
                    label={user.status}
                    color={user.status === 'active' ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {hasPermission('edit') && (
                    <IconButton
                      onClick={() => {
                        setSelectedUser(user);
                        setOpen(true);
                      }}
                    >
                      <Edit />
                    </IconButton>
                  )}
                  {hasPermission('delete') && (
                    <IconButton color="error">
                      <Delete />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 사용자 생성/수정 다이얼로그 */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedUser ? '사용자 수정' : '사용자 추가'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="사용자 ID"
            defaultValue={selectedUser?.userid || ''}
            margin="normal"
          />
          <TextField
            fullWidth
            label="이름"
            defaultValue={selectedUser?.username || ''}
            margin="normal"
          />
          <TextField
            fullWidth
            label="이메일"
            type="email"
            defaultValue={selectedUser?.email || ''}
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>역할</InputLabel>
            <Select defaultValue={selectedUser?.role || 'user'}>
              <MenuItem value="user">사용자</MenuItem>
              <MenuItem value="admin">관리자</MenuItem>
              <MenuItem value="audit">감사</MenuItem>
              <MenuItem value="root">루트</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>취소</Button>
          <Button variant="contained">저장</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserList;
```

#### 5. API 라우트 작성 예시
```typescript
// daeheung-rt-one-api/src/routes/userRoutes.ts
import express from 'express';
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';
import { checkPermission } from '../middleware/permission';

const router = express.Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

// 사용자 목록 조회
router.get('/:tenantId/:companyId?', 
  checkPermission('users', 'view'),
  getUsers
);

// 사용자 생성
router.post('/:tenantId/:companyId',
  checkPermission('users', 'create'),
  createUser
);

// 사용자 수정
router.put('/:tenantId/:userId',
  checkPermission('users', 'edit'),
  updateUser
);

// 사용자 삭제
router.delete('/:tenantId/:userId',
  checkPermission('users', 'delete'),
  deleteUser
);

export default router;
```

### API 설계
- **RESTful**: 표준 HTTP 메서드 사용
- **인증**: JWT 토큰 기반 인증
- **권한**: 미들웨어로 엔드포인트별 권한 검사
- **에러 처리**: 일관된 에러 응답 형식
- **문서화**: Swagger/OpenAPI 자동 생성

### 프론트엔드 설계
- **컴포넌트**: 재사용 가능한 Material-UI 기반 컴포넌트
- **상태 관리**: Zustand로 전역 상태 관리
- **라우팅**: React Router로 SPA 라우팅
- **다국어**: i18next로 한국어/영어 지원
- **테마**: Material-UI 테마 시스템 활용

## 개발 규칙

### 커밋 메시지
```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 코드 리팩토링
test: 테스트 추가
chore: 빌드 설정 변경
```

### 브랜치 전략
- `main`: 프로덕션 브랜치
- `develop`: 개발 브랜치
- `feature/*`: 기능 개발 브랜치
- `hotfix/*`: 긴급 수정 브랜치

### 코드 리뷰
- 모든 변경사항은 테스트 코드 포함 필수
- 타입 안전성 검증
- 성능 영향도 검토

## 배포 프로세스

### 개발 환경
1. PostgreSQL과 Redis 서비스 시작
2. 백엔드 서버 실행: `cd daeheung-rt-one-api && npm run dev`
3. 프론트엔드 서버 실행: `cd daeheung-rt-one-web && npm start`
4. 기능 개발 및 테스트

### 프로덕션 배포
1. Railway에 자동 배포
2. 데이터베이스 마이그레이션 실행
3. 헬스체크 및 모니터링

## 모니터링 및 로깅

### 애플리케이션 코드에서의 로깅
- 프론트·백엔드 **비즈니스 코드**에는 `console.log` 남용을 피하고, 위 **「로깅 및 불필요한 코드」** 절을 따른다.
- 배포·스테이징에서는 브라우저 개발자 도구에 토큰 일부가 노출되지 않도록 API 클라이언트에 디버그 출력을 두지 않는다.

### 로그 레벨(백엔드·인프라 일반)
- `error`: 에러 로그
- `warn`: 경고 로그
- `info`: 정보 로그
- `debug`: 디버그 로그

### 모니터링 지표
- API 응답 시간
- 데이터베이스 연결 상태
- 메모리 사용량
- CPU 사용률
- 에러 발생률

## 보안 가이드라인

### 시크릿·환경 변수 (코드에 금지)
- **`JWT_SECRET`**: 반드시 환경 변수로 설정. **32자 이상**이어야 서버가 기동된다(`daeheung-rt-one-api/src/config/env.ts`의 `validateEnv`).
- **`SESSION_SECRET`**, DB 비밀번호, 외부 API 키 등: **소스에 기본값·샘플 시크릿을 넣지 않는다.** (과거 `mvs-jwt-secret` 같은 하드코딩 금지)
- Excel/시드 등 **예시 비밀번호**는 실제 서비스에서 쓰이는 값(`password123` 등)을 쓰지 않고, “임포트 후 변경”이 분명한 문구를 사용한다.

### 인증 및 권한
- JWT: 로그인·미들웨어·Socket.io는 **`process.env.JWT_SECRET`**만 사용한다.
- 비밀번호: **bcrypt** 해시 저장; 평문 로그·응답 금지.
- API: **Helmet**, **express-rate-limit**(전역·로그인·업로드 분리), 프로덕션에서 **`trust proxy`**(Railway 리버스 프록시 뒤 IP·레이트 리밋 정확도).
- **CORS**: 프로덕션에서는 **`CORS_ORIGIN`** 필수(쉼표로 여러 Origin). localhost만으로 두면 기동 검증 실패.
- **메뉴 권한**: `user_permissions` + 라우트 미들웨어로 API 단에서 강제(`middleware/menuPermission.ts`).

### 데이터·멀티테넌트
- 조회/수정/삭제 시 **`tenant_id`·`company_id`** 조건 누락 금지(앱 레이어 격리; DB RLS는 별도 도입 시 문서화).
- SQL: Sequelize 위주; `sequelize.literal` 등 사용자 입력 결합 시 인젝션 재검토.
- XSS: React 이스케이프 + `dangerouslySetInnerHTML` 사용 시 입력 검증·최소화.

### 로깅
- 요청 본문 로깅 시 **password·token·authorization** 등은 마스킹(`index.ts`의 `sanitizeLogPayload` 패턴 준수).

### 알려진 트레이드오프 (개선 여지)
- PostgreSQL 연결 SSL에서 `rejectUnauthorized: false`는 호스팅 편의와의 타협; CA 검증 가능하면 강화 검토.
- 프로덕션 Helmet에서 **CSP 비활성**인 상태 — 도입 시 프론트 번들·인라인 스크립트와 충돌 점검 필요.

## 참고 자료

### 문서
- [React 공식 문서](https://react.dev/)
- [Material-UI 문서](https://mui.com/)
- [Express.js 가이드](https://expressjs.com/)
- [Sequelize 문서](https://sequelize.org/)
- [Railway 가이드](https://docs.railway.app/)

### 도구
- [TypeScript 핸드북](https://www.typescriptlang.org/docs/)
- [Zustand 가이드](https://github.com/pmndrs/zustand)
- [i18next 문서](https://www.i18next.com/)

## 개발 목표

MVS은 **현대적이고 확장 가능한 기업용 통합 업무 관리 시스템**을 목표로 합니다. 

**핵심 가치:**
- **사용자 중심**: 직관적이고 사용하기 쉬운 UI/UX
- **확장성**: 비즈니스 성장에 따른 시스템 확장 지원
- **안정성**: 99.9% 가용성 보장
- **보안**: 엔터프라이즈급 보안 표준 준수
- **성능**: 빠른 응답 시간과 높은 처리량

**개발 원칙:**
- 코드 품질 우선
- 테스트 주도 개발
- 지속적인 개선
- 사용자 피드백 반영

## 배포 및 개발 환경

### Railway 배포 (프로덕션)
- **Nixpacks 사용**: 빠르고 간단한 자동 배포
- **Git 기반 배포**: 푸시 시 자동 배포 트리거
- **백엔드 서비스 변수 (필수 예시)**  
  - `DATABASE_URL` — Railway Postgres 플러그인 연결 문자열  
  - `JWT_SECRET` — **32자 이상** 임의 문자열  
  - `CORS_ORIGIN` — 프론트 공개 URL(여러 개면 쉼표 구분). **미설정 시 프로덕션 기동 실패**  
  - `PORT` — Railway가 주입하는 경우가 많음(미설정 시 기본 5000)  
  - (선택) `TRUST_PROXY=1` — `NODE_ENV`가 production이 아닌데 리버스 프록시 뒤에 둘 때
- **시작 스크립트**: `npm run start:railway` → 빌드(`dist`) 후 `scripts/run-migrations.cjs`로 마이그레이션, 이후 `node dist/index.js`
- **프론트엔드 빌드 변수**  
  - API가 **별도 Railway 서비스/도메인**이면 빌드 시 **`REACT_APP_API_URL`** = `https://<백엔드 호스트>/api` 형태로 설정(끝에 `/api` 없으면 `api.ts`에서 보정).  
  - 미설정 시 **동일 오리진의 `/api`**로 요청하며 콘솔에 경고가 출력된다(같은 서비스에서 리버스 프록시로 `/api`만 넘기는 구성용).
- **DB 덤프 복원**: 로컬에 PostgreSQL 클라이언트(`pg_restore`/`psql`) 설치 후, Railway `DATABASE_URL`을 설정하고 `cd daeheung-rt-one-api && npm run db:restore:railway` (기본 `backup/daeheung-rt-one-db.dump`). 자세한 절차는 **`docs/SERVER_START_GUIDE.md`** 의 「Railway에 DB 덤프 복원하기」절.
- **백엔드 배포 절차·설정 표**: **`docs/RAILWAY_BACKEND_DEPLOY.md`**

### 백엔드 테스트(Jest)
- `config/env`·`database` 로드 전에 환경이 필요하므로 **`src/__tests__/jest-preset-env.cjs`**가 `jest.config.js`의 `setupFiles`로 먼저 실행된다(`DATABASE_URL`·`JWT_SECRET` 등 최소값). 새 테스트가 DB를 켜면 로컬/CI에서 해당 URL 접근 가능 여부를 확인한다.

### 로컬 개발 환경
- **네이티브 환경**: PostgreSQL과 Redis를 로컬에 직접 설치
- **직접 실행**: 프론트엔드/백엔드는 npm으로 직접 실행
- **빠른 개발**: 핫 리로드와 디버깅 지원

### 개발 명령어
```bash
# 로컬 개발
net start postgresql-x64-17  # PostgreSQL 시작
net start redis              # Redis 시작
cd daeheung-rt-one-api && npm run dev # 백엔드 실행
cd daeheung-rt-one-web && npm start # 프론트엔드 실행

# Railway 배포
git push origin main         # 자동 배포
railway up                  # 수동 배포
```

### 파일 구조
```
MVS/
├── nixpacks.toml              # Railway 배포 설정
├── daeheung-rt-one-api/
│   ├── nixpacks.toml          # 백엔드 배포 설정
│   └── railway.json           # Railway 서비스 설정
└── daeheung-rt-one-web/
    ├── nixpacks.toml          # 프론트엔드 배포 설정
    └── railway.json           # Railway 서비스 설정
```

## 테스트 계정
- **사용자 ID**: testuser
- **비밀번호**: TestPassword123!

## 제품·UI 반영 메모 (에이전트·인수인계용)
다음은 최근 코드에 반영된 동작이다. 신규 화면·메뉴 추가 시 충돌하지 않도록 참고한다.

| 구분 | 내용 |
|------|------|
| 고객 지원 | **페이지·라우트 제거** (`CustomerSupport.tsx` 삭제, `/customers/support` 라우트 없음). DB 메뉴 제거는 마이그레이션 `20260427103000-remove-customer-support-menu.js` 실행. 사이드바·**대시보드 바로가기**에서는 **`isRemovedNavMenuRoute`**로 남은 DB 메뉴 항목을 숨김. |
| 협력업체 목록 | 연락처 열: **이메일만** 표시(전화번호 목록 비표시). |
| 투숙객 명단 | 목록 테이블: **예약번호·이메일 열 비표시**. 검색은 고객명·회사명·호실 중심 문구(`i18n`); 키워드로 예약번호·이메일 검색은 백엔드 필터에서 유지 가능. |

---

**MVS 1인 개발자와 함께 차세대 기업용 시스템을 만들어가세요!**
