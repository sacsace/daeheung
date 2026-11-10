-- companies 테이블에 status 컬럼이 있는지 확인
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'companies'
  AND column_name IN ('status', 'subscription_status')
ORDER BY column_name;

-- companies 테이블의 모든 컬럼 확인 (status 관련)
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'companies'
  AND (column_name LIKE '%status%' OR column_name LIKE '%Status%')
ORDER BY ordinal_position;

-- companies 테이블의 모든 컬럼 목록
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'companies'
ORDER BY ordinal_position;

-- 실제 데이터에서 status와 subscription_status 값 확인
SELECT 
  id,
  name,
  status,
  subscription_status,
  subscription_plan
FROM companies
ORDER BY id;

-- status 값 분포 확인
SELECT 
  status,
  COUNT(*) as count
FROM companies
GROUP BY status
ORDER BY count DESC;

-- subscription_status 값 분포 확인
SELECT 
  subscription_status,
  COUNT(*) as count
FROM companies
GROUP BY subscription_status
ORDER BY count DESC;











