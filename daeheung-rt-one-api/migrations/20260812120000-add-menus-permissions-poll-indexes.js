'use strict';

/**
 * 메뉴·권한·투표 조회 성능 인덱스 + notice_polls 활성 행 부분 UNIQUE 수리
 * - menus (tenant_id, route) unique 전에 중복 route 정리
 */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    // 동일 tenant+route 중복: 가장 작은 id 유지, 나머지 soft-deactivate + 권한 이전
    await sequelize.query(`
      WITH dups AS (
        SELECT tenant_id, route, MIN(id) AS keep_id, ARRAY_AGG(id ORDER BY id) AS ids
        FROM menus
        GROUP BY tenant_id, route
        HAVING COUNT(*) > 1
      ),
      victims AS (
        SELECT d.keep_id, unnest(d.ids) AS victim_id
        FROM dups d
      )
      UPDATE user_permissions up
      SET menu_id = v.keep_id, updated_at = NOW()
      FROM victims v
      WHERE up.menu_id = v.victim_id
        AND v.victim_id <> v.keep_id
        AND NOT EXISTS (
          SELECT 1 FROM user_permissions x
          WHERE x.user_id = up.user_id AND x.menu_id = v.keep_id
        )
    `);

    await sequelize.query(`
      WITH dups AS (
        SELECT tenant_id, route, MIN(id) AS keep_id, ARRAY_AGG(id ORDER BY id) AS ids
        FROM menus
        GROUP BY tenant_id, route
        HAVING COUNT(*) > 1
      ),
      victims AS (
        SELECT d.keep_id, unnest(d.ids) AS victim_id
        FROM dups d
      )
      DELETE FROM user_permissions up
      USING victims v
      WHERE up.menu_id = v.victim_id AND v.victim_id <> v.keep_id
    `);

    await sequelize.query(`
      WITH dups AS (
        SELECT tenant_id, route, MIN(id) AS keep_id
        FROM menus
        GROUP BY tenant_id, route
        HAVING COUNT(*) > 1
      )
      UPDATE menus m
      SET route = m.route || '__dup_' || m.id::text,
          is_active = false,
          updated_at = NOW()
      FROM dups d
      WHERE m.tenant_id = d.tenant_id
        AND m.route = d.route
        AND m.id <> d.keep_id
    `);

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS menus_tenant_id_route_uq
      ON menus (tenant_id, route)
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS menus_tenant_parent_order_idx
      ON menus (tenant_id, parent_id, "order")
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS user_permissions_menu_id_idx
      ON user_permissions (menu_id)
    `);

    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE tablename = 'user_permissions'
            AND indexdef ILIKE '%UNIQUE%'
            AND indexdef ILIKE '%user_id%'
            AND indexdef ILIKE '%menu_id%'
        ) THEN
          CREATE UNIQUE INDEX user_permissions_user_id_menu_id_uq
          ON user_permissions (user_id, menu_id);
        END IF;
      END $$;
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS notice_poll_votes_poll_tenant_company_idx
      ON notice_poll_votes (poll_id, tenant_id, company_id)
    `);

    await sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE tablename = 'notice_polls' AND indexname = 'notice_polls_notice_id_uq'
        ) THEN
          DROP INDEX IF EXISTS notice_polls_notice_id_uq;
        END IF;
      END $$;
    `);

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS notice_polls_notice_id_active_uq
      ON notice_polls (notice_id)
      WHERE is_active = true
    `);
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    await sequelize.query(`DROP INDEX IF EXISTS notice_polls_notice_id_active_uq`);
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS notice_polls_notice_id_uq
      ON notice_polls (notice_id)
    `);
    await sequelize.query(`DROP INDEX IF EXISTS notice_poll_votes_poll_tenant_company_idx`);
    await sequelize.query(`DROP INDEX IF EXISTS menus_tenant_parent_order_idx`);
    await sequelize.query(`DROP INDEX IF EXISTS menus_tenant_id_route_uq`);
    await sequelize.query(`DROP INDEX IF EXISTS user_permissions_menu_id_idx`);
  },
};
