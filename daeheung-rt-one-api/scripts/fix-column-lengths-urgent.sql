-- ================================================
-- companies 테이블 컬럼 길이 긴급 수정 SQL
-- business_number가 21자인데 VARCHAR(20)으로 제한되어 오류 발생
-- ================================================

-- business_number: VARCHAR(20) -> VARCHAR(50) (21자 데이터 저장 가능하도록)
ALTER TABLE companies ALTER COLUMN business_number TYPE VARCHAR(50);

-- phone: VARCHAR(20) -> VARCHAR(50) (향후 확장 대비)
ALTER TABLE companies ALTER COLUMN phone TYPE VARCHAR(50);

-- subscription_status: VARCHAR(20) -> VARCHAR(50) (향후 확장 대비)
ALTER TABLE companies ALTER COLUMN subscription_status TYPE VARCHAR(50);

-- 확인
SELECT 
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'companies'
AND column_name IN ('business_number', 'phone', 'subscription_status')
ORDER BY column_name;























