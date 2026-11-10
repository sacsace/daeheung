-- ================================================
-- company_gst_numbers 테이블 생성 SQL
-- ================================================

-- 테이블 생성
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

-- 인덱스 생성
-- 1. company_id 인덱스 (외래 키, 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_company_gst_numbers_company_id ON company_gst_numbers(company_id);

-- 2. gst_number 인덱스 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_company_gst_numbers_gst_number ON company_gst_numbers(gst_number);

-- 3. status 인덱스 (활성/비활성 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_company_gst_numbers_status ON company_gst_numbers(status);

-- 4. 복합 인덱스: company_id + status (특정 회사의 활성 GST 번호 조회)
CREATE INDEX IF NOT EXISTS idx_company_gst_numbers_company_status ON company_gst_numbers(company_id, status);

-- 5. gst_number 고유 인덱스 (중복 방지)
-- 주의: 중복 데이터가 있으면 생성할 수 없습니다.
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_gst_numbers_gst_number_unique ON company_gst_numbers(gst_number);

-- 테이블 확인
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'company_gst_numbers'
ORDER BY ordinal_position;

