-- ================================================
-- companies 테이블과 company_gst_numbers 테이블 조인 쿼리
-- ================================================

-- 1. 모든 회사와 GST 번호 조회 (LEFT JOIN)
SELECT 
    c.id AS company_id,
    c.name AS company_name,
    c.business_number,
    c.tenant_id,
    gst.id AS gst_id,
    gst.gst_number,
    gst.state_code,
    gst.registration_date,
    gst.status AS gst_status,
    gst.created_at AS gst_created_at
FROM companies c
LEFT JOIN company_gst_numbers gst ON c.id = gst.company_id
ORDER BY c.id, gst.id;

-- 2. 특정 회사의 GST 번호만 조회
SELECT 
    c.id AS company_id,
    c.name AS company_name,
    gst.gst_number,
    gst.state_code,
    gst.status AS gst_status
FROM companies c
LEFT JOIN company_gst_numbers gst ON c.id = gst.company_id
WHERE c.id = 1  -- 회사 ID 변경 가능
ORDER BY gst.id;

-- 3. GST 번호가 있는 회사만 조회 (INNER JOIN)
SELECT 
    c.id AS company_id,
    c.name AS company_name,
    c.business_number,
    gst.gst_number,
    gst.status AS gst_status
FROM companies c
INNER JOIN company_gst_numbers gst ON c.id = gst.company_id
WHERE gst.status = 'active'
ORDER BY c.id, gst.id;

-- 4. 회사별 GST 번호 개수 집계
SELECT 
    c.id AS company_id,
    c.name AS company_name,
    COUNT(gst.id) AS gst_count,
    STRING_AGG(gst.gst_number, ', ') AS gst_numbers
FROM companies c
LEFT JOIN company_gst_numbers gst ON c.id = gst.company_id
GROUP BY c.id, c.name
ORDER BY c.id;

-- 5. 특정 회사의 모든 GST 번호를 배열로 조회 (PostgreSQL 배열)
SELECT 
    c.id AS company_id,
    c.name AS company_name,
    ARRAY_AGG(gst.gst_number) FILTER (WHERE gst.gst_number IS NOT NULL) AS gst_numbers
FROM companies c
LEFT JOIN company_gst_numbers gst ON c.id = gst.company_id
WHERE c.id = 1  -- 회사 ID 변경 가능
GROUP BY c.id, c.name;

-- 6. 모든 회사의 GST 번호를 배열로 조회
SELECT 
    c.id AS company_id,
    c.name AS company_name,
    ARRAY_AGG(gst.gst_number) FILTER (WHERE gst.gst_number IS NOT NULL) AS gst_numbers
FROM companies c
LEFT JOIN company_gst_numbers gst ON c.id = gst.company_id
GROUP BY c.id, c.name
ORDER BY c.id;

-- 7. 테이블 구조 확인
SELECT 
    'companies' AS table_name,
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'companies'
ORDER BY ordinal_position;

SELECT 
    'company_gst_numbers' AS table_name,
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'company_gst_numbers'
ORDER BY ordinal_position;























