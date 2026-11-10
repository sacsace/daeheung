-- 일용직(daily) ENUM 값 추가 — 타입 소유자 또는 슈퍼유저(postgres)로 실행하세요.
-- 예: psql -U postgres -d mvs -f scripts/sql/add-user-employment-daily-enum.sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'user_employment_type_enum'
      AND e.enumlabel = 'daily'
  ) THEN
    ALTER TYPE public.user_employment_type_enum ADD VALUE 'daily';
    RAISE NOTICE 'Added enum label: daily';
  ELSE
    RAISE NOTICE 'Enum label daily already exists — no change';
  END IF;
END
$$;
