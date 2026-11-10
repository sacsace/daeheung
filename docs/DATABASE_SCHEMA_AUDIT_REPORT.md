# MVS 데이터베이스 스키마 감사 리포트

**작성일**: 2025-01-XX  
**검사 범위**: 모델 파일 vs 마이그레이션 파일

## 📋 요약

전체 코드베이스를 검토한 결과, **모델 정의와 마이그레이션 파일 간에 여러 불일치**가 발견되었습니다. 이로 인해 데이터베이스 스키마가 실제 모델과 일치하지 않을 수 있습니다.

## 🔴 심각한 불일치 사항

### 1. **Menu 테이블** - 필드명 불일치

**마이그레이션** (`20251004202639-create-all-tables.js`):
- `name` (STRING)
- `path` (STRING)

**모델** (`Menu.ts`):
- `name_ko` (STRING) - 한글명
- `name_en` (STRING) - 영문명
- `route` (STRING) - 경로
- `level` (INTEGER) - 메뉴 레벨
- `description` (TEXT) - 설명

**문제점**: 마이그레이션에는 다국어 지원 필드가 없고, 모델에는 있음.

### 2. **Company 테이블** - 필드 누락

**마이그레이션에 누락된 필드**:
- `website` (STRING)
- `industry` (STRING)
- `employee_count` (INTEGER)
- `subscription_plan` (STRING)
- `subscription_status` (STRING)
- `account_holder_name` (STRING)
- `bank_name` (STRING)
- `account_number` (STRING)
- `ifsc_code` (STRING)
- `login_period_start` (DATEONLY)
- `login_period_end` (DATEONLY)
- `login_time_start` (TIME)
- `login_time_end` (TIME)
- `timezone` (STRING)
- `settings` (JSONB)

**영향**: 회사 정보의 많은 필드가 데이터베이스에 저장되지 않음.

### 3. **Product 테이블** - 필드명 및 필드 누락

**마이그레이션**:
- `sku` (STRING) - 모델에는 없음
- `name`, `description`, `stock_quantity`, `unit_price`만 있음

**모델에 있지만 마이그레이션에 없는 필드**:
- `product_code` (STRING) - `sku` 대신 사용
- `category` (STRING)
- `cost_price` (DECIMAL)
- `min_stock_level` (DECIMAL)
- `max_stock_level` (DECIMAL)
- `unit` (STRING)
- `tax_rate` (DECIMAL)
- `status` (STRING)

**문제점**: 제품 관리 기능이 제대로 작동하지 않을 수 있음.

### 4. **UserPermission 테이블** - 필드명 불일치

**마이그레이션**:
- `can_read` (BOOLEAN)
- `can_write` (BOOLEAN)
- `can_delete` (BOOLEAN)

**모델**:
- `can_view` (BOOLEAN) - `can_read` 대신
- `can_create` (BOOLEAN) - 새로 추가
- `can_edit` (BOOLEAN) - `can_write` 대신
- `can_delete` (BOOLEAN) - 동일

**문제점**: 권한 체크 로직이 작동하지 않을 수 있음.

### 5. **Project 테이블** - 필드 누락

**마이그레이션에 누락된 필드**:
- `company_id` (INTEGER) - 회사 참조
- `project_code` (STRING) - 프로젝트 코드
- `priority` (STRING) - 우선순위
- `actual_cost` (DECIMAL) - 실제 비용
- `progress` (INTEGER) - 진행률
- `project_manager` (INTEGER) - 프로젝트 매니저
- `created_by` (INTEGER) - 생성자

**영향**: 프로젝트 관리 기능이 제한적임.

### 6. **Invoice 테이블** - 필드 타입 불일치 가능성

**마이그레이션**: `invoice_date`, `due_date`가 DATE 타입  
**모델**: DATEONLY 타입으로 정의

**문제점**: 타입 불일치로 인한 오류 가능성.

### 7. **Customer 테이블** - 필드 누락

**마이그레이션에 누락된 필드**:
- `status` (STRING)
- `website` (STRING)
- `industry` (STRING)

## ⚠️ 기타 발견 사항

### 1. **인코딩 문제**
- `daeheung-rt-one-api/src/models/index.ts` 파일에 한글 주석이 깨져 있음 (라인 20-21, 31, 35, 42, 49, 56, 60, 73, 83, 93, 109, 122, 135)

### 2. **마이그레이션 순서**
- `users` 테이블이 `tenants`와 `companies` 테이블보다 먼저 생성됨
- 외래키 제약조건이 나중에 추가되지 않음

### 3. **누락된 테이블**
문서에는 언급되었지만 마이그레이션에 없는 테이블:
- `departments`
- `positions`
- `attendance_records`
- `leave_requests`
- `payroll_records`
- `work_reports`
- `expenses`
- `budgets`
- `notices`
- `system_logs`
- `backups`
- `tasks`
- `chat_rooms`
- `chat_messages`

## ✅ 정상 작동하는 부분

1. **Tenant 테이블**: 모델과 마이그레이션 일치
2. **InvoiceItem 테이블**: 기본 구조 일치
3. **SalesOpportunity 테이블**: 기본 구조 일치
4. **Contract 테이블**: 기본 구조 일치
5. **SupportTicket 테이블**: 기본 구조 일치
6. **SupportResponse 테이블**: 기본 구조 일치
7. **Payroll 테이블**: 기본 구조 일치
8. **InventoryTransaction 테이블**: 기본 구조 일치

## 🔧 권장 조치 사항

### 즉시 수정 필요 (High Priority)

1. **Menu 테이블 마이그레이션 수정**
   - `name` → `name_ko`, `name_en`으로 변경
   - `path` → `route`로 변경
   - `level`, `description` 필드 추가

2. **Company 테이블 마이그레이션 수정**
   - 누락된 모든 필드 추가

3. **Product 테이블 마이그레이션 수정**
   - `sku` → `product_code`로 변경
   - 누락된 필드 추가

4. **UserPermission 테이블 마이그레이션 수정**
   - 필드명 변경 및 `can_create` 추가

5. **Project 테이블 마이그레이션 수정**
   - 누락된 필드 추가

### 중기 조치 (Medium Priority)

1. 누락된 테이블에 대한 마이그레이션 생성
2. 외래키 제약조건 명시적 추가
3. 인덱스 최적화

### 장기 조치 (Low Priority)

1. 데이터베이스 스키마 문서 업데이트
2. 모델과 마이그레이션 동기화 자동화
3. 스키마 검증 테스트 추가

## 📊 영향도 분석

### 높은 영향도
- **Menu 테이블**: 메뉴 시스템이 작동하지 않을 수 있음
- **Company 테이블**: 회사 정보 저장 불가
- **Product 테이블**: 제품 관리 기능 제한

### 중간 영향도
- **UserPermission 테이블**: 권한 체크 오류 가능
- **Project 테이블**: 프로젝트 관리 기능 제한

### 낮은 영향도
- 누락된 테이블들은 아직 사용되지 않을 수 있음

## 🎯 다음 단계

1. ✅ 마이그레이션 파일 수정 완료
2. ✅ 스크립트 오류 수정 완료
3. 데이터베이스 재생성 또는 ALTER 마이그레이션 생성
4. 테스트 실행
5. 프로덕션 배포 전 검증

## ✅ 수정 완료 사항

### 마이그레이션 파일 수정 완료
- ✅ Menu 테이블: `name_ko`, `name_en`, `route`, `level`, `description` 필드 추가
- ✅ Company 테이블: 모든 누락 필드 추가
- ✅ Product 테이블: `product_code` 및 모든 누락 필드 추가
- ✅ UserPermission 테이블: `can_view`, `can_create`, `can_edit`, `can_delete` 필드로 수정
- ✅ Project 테이블: 모든 누락 필드 추가
- ✅ Customer 테이블: `status`, `website`, `industry` 필드 추가
- ✅ Invoice 테이블: ENUM → STRING 타입으로 변경 (모델과 일치)
- ✅ SalesOpportunity 테이블: `company_id` 필드 추가

### 스크립트 수정 완료
- ✅ `sampleData.ts`: 모델과 일치하도록 필드 수정
- ✅ `fix-columns.ts`: 오류 처리 개선
- ✅ 모든 스크립트에서 올바른 필드명 사용 확인

