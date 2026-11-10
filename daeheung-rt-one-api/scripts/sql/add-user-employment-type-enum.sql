-- employment_type ENUM: daily / service 추가 — 타입 소유자 또는 슈퍼유저(postgres)로 실행하세요.
-- 예: psql -U postgres -d mvs -f scripts/sql/add-user-employment-type-enum.sql
DO $$
DECLARE
  labels text[] := ARRAY['daily', 'service'];
  lab text;
BEGIN
  FOREACH lab IN ARRAY labels LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = 'user_employment_type_enum'
        AND e.enumlabel = lab
    ) THEN
      EXECUTE format('ALTER TYPE public.user_employment_type_enum ADD VALUE %L', lab);
      RAISE NOTICE 'Added enum label: %', lab;
    ELSE
      RAISE NOTICE 'Enum label % already exists — no change', lab;
    END IF;
  END LOOP;
END
$$;
