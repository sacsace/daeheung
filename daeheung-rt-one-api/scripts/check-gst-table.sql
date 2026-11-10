-- ================================================
-- company_gst_numbers 테이블 확인 SQL
-- ================================================

-- 1. 테이블 존재 여부 확인
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'company_gst_numbers'
    ) THEN '✅ 테이블이 존재합니다.'
    ELSE '❌ 테이블이 존재하지 않습니다.'
  END as table_status;

-- 2. 테이블 구조 확인 (테이블이 존재하는 경우)
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'company_gst_numbers'
ORDER BY ordinal_position;

-- 3. 인덱스 확인
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
AND tablename = 'company_gst_numbers'
ORDER BY indexname;

-- 4. 저장된 데이터 확인
SELECT 
  id,
  company_id,
  gst_number,
  state_code,
  registration_date,
  status,
  created_at,
  updated_at
FROM company_gst_numbers
ORDER BY id;

-- 5. 데이터 개수
SELECT COUNT(*) as total_count FROM company_gst_numbers;























