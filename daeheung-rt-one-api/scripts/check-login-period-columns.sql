-- ================================================
-- login_period_start, login_period_end 컬럼 확인
-- ================================================

-- 1. 컬럼 존재 여부 및 속성 확인
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'companies'
AND column_name IN ('login_period_start', 'login_period_end')
ORDER BY column_name;

-- 2. 실제 데이터 확인
SELECT 
  id,
  name,
  login_period_start,
  login_period_end,
  login_period_start::text as login_period_start_text,
  login_period_end::text as login_period_end_text
FROM companies
ORDER BY id
LIMIT 10;

-- 3. 컬럼 타입 변경이 필요한지 확인
-- DATE 타입이면 DATEONLY로 변경 권장 (시간 정보 불필요)

