-- companies 테이블 존재 여부 확인
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'companies'
) as table_exists;

-- 테이블이 존재하는 경우 구조 확인
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'companies'
ORDER BY ordinal_position;

-- 저장된 회사 데이터 확인 (기본 정보)
SELECT 
  id,
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
  status,
  created_at,
  updated_at
FROM companies
ORDER BY id;

-- 저장된 회사 데이터 확인 (상세 정보 - 모든 컬럼)
SELECT * FROM companies ORDER BY id;

-- 회사 개수 확인
SELECT COUNT(*) as total_companies FROM companies;

-- 상태별 회사 개수
SELECT 
  status,
  COUNT(*) as count
FROM companies
GROUP BY status
ORDER BY count DESC;

-- 테넌트별 회사 개수
SELECT 
  tenant_id,
  COUNT(*) as count
FROM companies
GROUP BY tenant_id
ORDER BY tenant_id;

