'use strict';

/**
 * 최상위 메뉴 순서: 「내 정보·업무」를 맨 왼쪽(1번)으로 고정.
 * - myWorkspaceMenus / daeheungSeed 설계와 일치
 * - 과거 reorder·수동 시드로 /basic-info 가 앞선 환경 수리
 */
const ROOT_MENU_ORDER = [
  ['/my', 1],
  ['/basic-info', 2],
  ['/hr', 3],
  ['/work', 4],
  ['/sales', 5],
  ['/inventory', 6],
  ['/accounting', 7],
  ['/communication', 8],
  ['/ai', 9],
  ['/reports', 10],
  ['/hotel', 11],
  ['/system', 12],
  ['/customers', 98],
];

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    for (const [route, order] of ROOT_MENU_ORDER) {
      await sequelize.query(
        `
        UPDATE menus
        SET "order" = $1, updated_at = NOW()
        WHERE parent_id IS NULL AND route = $2 AND is_active = true
        `,
        { bind: [order, route] }
      );
    }

    // 레거시 최상위 /dashboard 가 남아 있으면 맨 뒤로 (실제 진입은 /my 하위)
    await sequelize.query(
      `
      UPDATE menus
      SET "order" = 99, updated_at = NOW()
      WHERE parent_id IS NULL AND route = '/dashboard' AND is_active = true
      `
    );

    await sequelize.query(
      `
      UPDATE menus
      SET name_ko = '내 정보·업무', name_en = 'My Info & Work', updated_at = NOW()
      WHERE parent_id IS NULL AND route = '/my' AND is_active = true
        AND (name_ko IS DISTINCT FROM '내 정보·업무' OR name_en IS DISTINCT FROM 'My Info & Work')
      `
    );
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const previous = [
      ['/basic-info', 1],
      ['/my', 2],
      ['/work', 3],
      ['/hr', 4],
      ['/sales', 5],
      ['/inventory', 6],
      ['/accounting', 7],
      ['/communication', 8],
      ['/ai', 9],
      ['/reports', 10],
      ['/hotel', 11],
      ['/system', 12],
      ['/customers', 98],
    ];
    for (const [route, order] of previous) {
      await sequelize.query(
        `
        UPDATE menus
        SET "order" = $1, updated_at = NOW()
        WHERE parent_id IS NULL AND route = $2 AND is_active = true
        `,
        { bind: [order, route] }
      );
    }
  },
};
