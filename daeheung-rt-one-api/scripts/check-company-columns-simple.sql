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

-- 누락된 컬럼 확인 (Company 모델 기준)
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'companies' 
      AND column_name = 'status'
    ) THEN '✓ status'
    ELSE '✗ status (누락)'
  END as status_check,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'companies' 
      AND column_name = 'bank_address'
    ) THEN '✓ bank_address'
    ELSE '✗ bank_address (누락)'
  END as bank_address_check,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'companies' 
      AND column_name = 'swift_code'
    ) THEN '✓ swift_code'
    ELSE '✗ swift_code (누락)'
  END as swift_code_check,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'companies' 
      AND column_name = 'msme_number'
    ) THEN '✓ msme_number'
    ELSE '✗ msme_number (누락)'
  END as msme_number_check,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'companies' 
      AND column_name = 'iec_number'
    ) THEN '✓ iec_number'
    ELSE '✗ iec_number (누락)'
  END as iec_number_check,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'companies' 
      AND column_name = 'pan_number'
    ) THEN '✓ pan_number'
    ELSE '✗ pan_number (누락)'
  END as pan_number_check;

