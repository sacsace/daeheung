-- bank_address 컬럼 추가
ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_address TEXT;

-- 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'companies' 
AND column_name = 'bank_address';























