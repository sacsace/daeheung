-- 근태 관리 관련 테이블 존재 여부 확인

-- 1. attendance_records 테이블 확인
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'attendance_records'
ORDER BY ordinal_position;

-- 2. leave_requests 테이블 확인
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'leave_requests'
ORDER BY ordinal_position;

-- 3. 모든 근태 관련 테이블 목록 확인
SELECT 
    table_name
FROM information_schema.tables
WHERE table_schema = 'public' 
    AND (
        table_name LIKE '%attendance%' 
        OR table_name LIKE '%leave%'
        OR table_name LIKE '%근태%'
        OR table_name LIKE '%출근%'
        OR table_name LIKE '%휴가%'
    )
ORDER BY table_name;

-- 4. attendance_records 테이블에 데이터가 있는지 확인
SELECT COUNT(*) as record_count
FROM attendance_records;

-- 5. leave_requests 테이블에 데이터가 있는지 확인
SELECT COUNT(*) as record_count
FROM leave_requests;












