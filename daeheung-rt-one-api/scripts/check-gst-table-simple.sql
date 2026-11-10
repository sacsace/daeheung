-- company_gst_numbers 테이블 존재 여부 확인
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'company_gst_numbers'
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
AND table_name = 'company_gst_numbers'
ORDER BY ordinal_position;

-- 저장된 데이터 확인
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

