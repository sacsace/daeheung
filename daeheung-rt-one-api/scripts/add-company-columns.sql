-- ================================================
-- Company 테이블 누락 컬럼 추가 쿼리
-- ================================================

-- 1. status 컬럼 추가 (ENUM 타입)
-- ENUM 타입이 없으면 먼저 생성
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_status_enum') THEN
        CREATE TYPE company_status_enum AS ENUM ('active', 'inactive', 'suspended');
    END IF;
END $$;

-- status 컬럼 추가 (없는 경우에만)
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS status company_status_enum NOT NULL DEFAULT 'active';

-- 2. bank_address 컬럼 추가
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS bank_address TEXT;

-- 3. swift_code 컬럼 추가
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS swift_code VARCHAR(11);

-- 4. msme_number 컬럼 추가
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS msme_number VARCHAR(50);

-- 5. iec_number 컬럼 추가
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS iec_number VARCHAR(50);

-- 6. pan_number 컬럼 추가
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS pan_number VARCHAR(50);

-- ================================================
-- 추가된 컬럼 확인
-- ================================================
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'companies'
AND column_name IN ('status', 'bank_address', 'swift_code', 'msme_number', 'iec_number', 'pan_number')
ORDER BY column_name;

