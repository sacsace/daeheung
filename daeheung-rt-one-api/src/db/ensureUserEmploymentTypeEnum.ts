import type { Sequelize } from 'sequelize';

/** 소유권 부족으로 스킵한 뒤 프로세스당 1번만 안내 (로그 스팸 방지) */
let warnedEmploymentTypePermission = false;

const REQUIRED_LABELS = ['daily', 'service'] as const;

/**
 * users.employment_type ENUM에 필요한 값(daily, service 등)이 없으면 추가합니다.
 * 마이그레이션 누락 시에도 사용자 수정이 실패하지 않도록 기동 시 1회 보정합니다.
 */
export async function ensureUserEmploymentTypeEnum(sequelize: Sequelize): Promise<void> {
  if (sequelize.getDialect() !== 'postgres') {
    return;
  }

  try {
    const [rows] = await sequelize.query(`
      SELECT udt_name AS name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'employment_type'
    `);
    const typeName = (rows as Array<{ name: string }>)?.[0]?.name;
    if (!typeName || !/^[a-zA-Z0-9_]+$/.test(String(typeName))) {
      return;
    }

    const safeType = String(typeName).replace(/'/g, "''");

    const [perm] = await sequelize.query(`
      SELECT
        (SELECT rolname FROM pg_roles WHERE oid = t.typowner) AS type_owner,
        current_user AS current_role,
        (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_super
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = '${safeType}'
    `);
    const p = (perm as Array<{ type_owner: string; current_role: string; is_super: boolean }>)?.[0];
    const canAlter =
      p?.is_super === true ||
      (p?.type_owner && p?.current_role && p.type_owner === p.current_role);

    for (const label of REQUIRED_LABELS) {
      const [already] = await sequelize.query(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public'
            AND t.typname = '${safeType}'
            AND e.enumlabel = '${label}'
        ) AS ex
      `);
      if ((already as Array<{ ex: boolean }>)?.[0]?.ex) {
        continue;
      }

      if (!canAlter) {
        if (!warnedEmploymentTypePermission) {
          warnedEmploymentTypePermission = true;
          console.warn(
            `[DB] employment_type ENUM에 "${label}"이(가) 없고, 현재 DB 계정은 타입 소유자가 아닙니다. ` +
              'postgres(또는 소유자)로 한 번만 실행하세요: `daeheung-rt-one-api/scripts/sql/add-user-employment-type-enum.sql` ' +
              `또는 \`ALTER TYPE public.user_employment_type_enum ADD VALUE '${label}';\``
          );
        }
        return;
      }

      await sequelize.query(`
        DO $$
        DECLARE
          typ CONSTANT text := '${safeType}';
          lab CONSTANT text := '${label}';
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public'
              AND t.typname = typ
              AND e.enumlabel = lab
          ) THEN
            EXECUTE format('ALTER TYPE %I.%I ADD VALUE %L', 'public', typ, lab);
          END IF;
        END
        $$;
      `);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isOwnerError = /소유|must be owner|permission denied/i.test(msg);
    if (!warnedEmploymentTypePermission) {
      warnedEmploymentTypePermission = true;
      const hint = isOwnerError
        ? ' postgres로 `scripts/sql/add-user-employment-type-enum.sql` 실행'
        : ' 위 SQL을 타입 소유자 계정으로 실행하세요.';
      console.warn(`[DB] employment_type ENUM 보정 실패.${hint} 원문: ${msg}`);
    }
  }
}

/** @deprecated use ensureUserEmploymentTypeEnum */
export async function ensureUserEmploymentDailyEnum(sequelize: Sequelize): Promise<void> {
  return ensureUserEmploymentTypeEnum(sequelize);
}
