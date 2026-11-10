-- ================================================
-- Company 테이블 컬럼 추가 및 수정 SQL
-- ================================================

-- 1. 누락된 컬럼 추가
ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_address TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS swift_code VARCHAR(11);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS msme_number VARCHAR(50);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS iec_number VARCHAR(50);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS pan_number VARCHAR(50);

-- 2. 이미지 컬럼 타입을 BYTEA로 변경 (VARCHAR에서 BYTEA로)
DO $$
BEGIN
    -- company_logo
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'companies' 
        AND column_name = 'company_logo' 
        AND data_type != 'bytea'
    ) THEN
        ALTER TABLE companies ALTER COLUMN company_logo TYPE BYTEA USING NULL;
    END IF;

    -- company_seal
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'companies' 
        AND column_name = 'company_seal' 
        AND data_type != 'bytea'
    ) THEN
        ALTER TABLE companies ALTER COLUMN company_seal TYPE BYTEA USING NULL;
    END IF;

    -- ceo_signature
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'companies' 
        AND column_name = 'ceo_signature' 
        AND data_type != 'bytea'
    ) THEN
        ALTER TABLE companies ALTER COLUMN ceo_signature TYPE BYTEA USING NULL;
    END IF;
END $$;

-- 3. company_gst_numbers 테이블 생성 (존재하지 않는 경우)
CREATE TABLE IF NOT EXISTS company_gst_numbers (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    gst_number VARCHAR(50) NOT NULL,
    state_code VARCHAR(10),
    registration_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. 인덱스 생성 (존재하지 않는 경우)
CREATE INDEX IF NOT EXISTS idx_company_gst_numbers_company_id ON company_gst_numbers(company_id);
CREATE INDEX IF NOT EXISTS idx_company_gst_numbers_gst_number ON company_gst_numbers(gst_number);

-- 5. 컬럼 확인 쿼리
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'companies'
AND column_name IN ('bank_address', 'swift_code', 'msme_number', 'iec_number', 'pan_number', 'company_logo', 'company_seal', 'ceo_signature')
ORDER BY column_name;

-- 6. company_gst_numbers 테이블 확인
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'company_gst_numbers'
ORDER BY ordinal_position;























