-- ================================================
-- login_period_start, login_period_end 컬럼 수정
-- ================================================

-- 1. 현재 컬럼 속성 확인
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'companies'
AND column_name IN ('login_period_start', 'login_period_end')
ORDER BY column_name;

-- 2. 컬럼 타입이 DATE가 아닌 경우 DATE로 변경
-- (PostgreSQL에서 DATE 타입은 DATEONLY와 동일하지만 명시적으로 DATE로 설정)
DO $$
BEGIN
    -- login_period_start 컬럼 타입 확인 및 수정
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'companies' 
        AND column_name = 'login_period_start'
        AND data_type != 'date'
    ) THEN
        ALTER TABLE companies 
        ALTER COLUMN login_period_start TYPE DATE USING login_period_start::date;
        RAISE NOTICE 'login_period_start 컬럼 타입을 DATE로 변경했습니다.';
    ELSE
        RAISE NOTICE 'login_period_start 컬럼이 이미 DATE 타입입니다.';
    END IF;
    
    -- login_period_end 컬럼 타입 확인 및 수정
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'companies' 
        AND column_name = 'login_period_end'
        AND data_type != 'date'
    ) THEN
        ALTER TABLE companies 
        ALTER COLUMN login_period_end TYPE DATE USING login_period_end::date;
        RAISE NOTICE 'login_period_end 컬럼 타입을 DATE로 변경했습니다.';
    ELSE
        RAISE NOTICE 'login_period_end 컬럼이 이미 DATE 타입입니다.';
    END IF;
END $$;

-- 3. 수정 후 컬럼 속성 확인
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'companies'
AND column_name IN ('login_period_start', 'login_period_end')
ORDER BY column_name;

-- 4. 실제 데이터 확인
SELECT 
  id,
  name,
  login_period_start,
  login_period_end,
  login_period_start::text as login_period_start_text,
  login_period_end::text as login_period_end_text
FROM companies
WHERE login_period_start IS NOT NULL OR login_period_end IS NOT NULL
ORDER BY id;

