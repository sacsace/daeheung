-- ================================================
-- Company 테이블 컬럼 확인 및 추가 스크립트
-- ================================================

-- 1. companies 테이블 존재 여부 확인
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'companies'
) as table_exists;

-- 2. 현재 companies 테이블의 모든 컬럼 확인
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'companies'
ORDER BY ordinal_position;

-- 3. 누락된 컬럼 확인 및 추가
-- status 컬럼 추가 (ENUM 타입)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'companies' 
        AND column_name = 'status'
    ) THEN
        -- ENUM 타입이 없으면 생성
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_status_enum') THEN
            CREATE TYPE company_status_enum AS ENUM ('active', 'inactive', 'suspended');
        END IF;
        
        ALTER TABLE companies 
        ADD COLUMN status company_status_enum NOT NULL DEFAULT 'active';
        
        RAISE NOTICE 'status 컬럼이 추가되었습니다.';
    ELSE
        RAISE NOTICE 'status 컬럼이 이미 존재합니다.';
    END IF;
END $$;

-- bank_address 컬럼 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'companies' 
        AND column_name = 'bank_address'
    ) THEN
        ALTER TABLE companies ADD COLUMN bank_address TEXT;
        RAISE NOTICE 'bank_address 컬럼이 추가되었습니다.';
    ELSE
        RAISE NOTICE 'bank_address 컬럼이 이미 존재합니다.';
    END IF;
END $$;

-- swift_code 컬럼 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'companies' 
        AND column_name = 'swift_code'
    ) THEN
        ALTER TABLE companies ADD COLUMN swift_code VARCHAR(11);
        RAISE NOTICE 'swift_code 컬럼이 추가되었습니다.';
    ELSE
        RAISE NOTICE 'swift_code 컬럼이 이미 존재합니다.';
    END IF;
END $$;

-- msme_number 컬럼 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'companies' 
        AND column_name = 'msme_number'
    ) THEN
        ALTER TABLE companies ADD COLUMN msme_number VARCHAR(50);
        RAISE NOTICE 'msme_number 컬럼이 추가되었습니다.';
    ELSE
        RAISE NOTICE 'msme_number 컬럼이 이미 존재합니다.';
    END IF;
END $$;

-- iec_number 컬럼 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'companies' 
        AND column_name = 'iec_number'
    ) THEN
        ALTER TABLE companies ADD COLUMN iec_number VARCHAR(50);
        RAISE NOTICE 'iec_number 컬럼이 추가되었습니다.';
    ELSE
        RAISE NOTICE 'iec_number 컬럼이 이미 존재합니다.';
    END IF;
END $$;

-- pan_number 컬럼 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'companies' 
        AND column_name = 'pan_number'
    ) THEN
        ALTER TABLE companies ADD COLUMN pan_number VARCHAR(50);
        RAISE NOTICE 'pan_number 컬럼이 추가되었습니다.';
    ELSE
        RAISE NOTICE 'pan_number 컬럼이 이미 존재합니다.';
    END IF;
END $$;

-- 4. 추가된 컬럼 확인
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

-- 5. 최종 테이블 구조 확인
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'companies'
ORDER BY ordinal_position;

