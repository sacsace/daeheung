-- enum_vacations_vacation_type에 누락된 값 추가
-- postgres 슈퍼유저로 실행: psql -U postgres -d mvs -f scripts/add-vacation-enum-values.sql
-- 참고: 마이그레이션으로 vacation_type이 VARCHAR인 환경에서는 이 스크립트가 불필요합니다.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'enum_vacations_vacation_type' AND e.enumlabel = 'study'
  ) THEN
    ALTER TYPE "enum_vacations_vacation_type" ADD VALUE 'study';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'enum_vacations_vacation_type' AND e.enumlabel = 'maternity'
  ) THEN
    ALTER TYPE "enum_vacations_vacation_type" ADD VALUE 'maternity';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'enum_vacations_vacation_type' AND e.enumlabel = 'paternity'
  ) THEN
    ALTER TYPE "enum_vacations_vacation_type" ADD VALUE 'paternity';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'enum_vacations_vacation_type' AND e.enumlabel = 'marriage'
  ) THEN
    ALTER TYPE "enum_vacations_vacation_type" ADD VALUE 'marriage';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'enum_vacations_vacation_type' AND e.enumlabel = 'bereavement'
  ) THEN
    ALTER TYPE "enum_vacations_vacation_type" ADD VALUE 'bereavement';
  END IF;
END
$$;
