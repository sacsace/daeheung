-- business_number 컬럼 길이를 VARCHAR(20)에서 VARCHAR(50)으로 변경

-- 1. 현재 컬럼 정보 확인
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'companies' 
AND column_name = 'business_number';

-- 2. business_number 컬럼 길이 변경
ALTER TABLE companies 
ALTER COLUMN business_number TYPE VARCHAR(50);

-- 3. 변경 후 확인
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'companies' 
AND column_name = 'business_number';























