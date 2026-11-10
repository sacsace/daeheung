-- ================================================
-- companies 테이블 컬럼 길이 수정 SQL
-- ================================================

-- 모델에 정의된 길이에 맞게 컬럼 길이 수정
-- 주의: 데이터가 현재 컬럼 길이보다 길면 오류가 발생할 수 있습니다.

-- business_number: VARCHAR(20) -> VARCHAR(50)
ALTER TABLE companies ALTER COLUMN business_number TYPE VARCHAR(50);

-- phone: VARCHAR(20) -> VARCHAR(50)
ALTER TABLE companies ALTER COLUMN phone TYPE VARCHAR(50);

-- subscription_status: VARCHAR(20) -> VARCHAR(50)
ALTER TABLE companies ALTER COLUMN subscription_status TYPE VARCHAR(50);

-- subscription_plan: VARCHAR(50) 확인 (이미 충분할 수 있음)
-- ALTER TABLE companies ALTER COLUMN subscription_plan TYPE VARCHAR(50);

-- name: VARCHAR(255) 확인
-- ALTER TABLE companies ALTER COLUMN name TYPE VARCHAR(255);

-- ceo_name: VARCHAR(100) 확인
-- ALTER TABLE companies ALTER COLUMN ceo_name TYPE VARCHAR(100);

-- email: VARCHAR(100) -> VARCHAR(255)
ALTER TABLE companies ALTER COLUMN email TYPE VARCHAR(255);

-- website: VARCHAR(100) -> VARCHAR(255)
ALTER TABLE companies ALTER COLUMN website TYPE VARCHAR(255);

-- industry: VARCHAR(100) 확인
-- ALTER TABLE companies ALTER COLUMN industry TYPE VARCHAR(100);

-- 컬럼 정보 확인
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'companies'
AND column_name IN ('business_number', 'phone', 'subscription_status', 'subscription_plan', 'name', 'ceo_name', 'email', 'website', 'industry')
ORDER BY column_name;























