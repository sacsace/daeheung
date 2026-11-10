-- ================================================
-- company_gst_numbers 테이블 인덱스 구성 SQL
-- ================================================

-- 1. company_id 인덱스 (외래 키, 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_company_gst_numbers_company_id 
ON company_gst_numbers(company_id);

-- 2. gst_number 인덱스 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_company_gst_numbers_gst_number 
ON company_gst_numbers(gst_number);

-- 3. status 인덱스 (활성/비활성 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_company_gst_numbers_status 
ON company_gst_numbers(status);

-- 4. 복합 인덱스: company_id + status (특정 회사의 활성 GST 번호 조회)
CREATE INDEX IF NOT EXISTS idx_company_gst_numbers_company_status 
ON company_gst_numbers(company_id, status);

-- 5. gst_number 고유 인덱스 (중복 방지)
-- 주의: 중복 데이터가 있으면 생성할 수 없습니다.
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_gst_numbers_gst_number_unique 
ON company_gst_numbers(gst_number);

-- 인덱스 확인
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
AND tablename = 'company_gst_numbers'
ORDER BY indexname;























