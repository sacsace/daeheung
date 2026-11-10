'use strict';

/** 업무관리: 회의실 예약 메뉴(/work/meeting-room) 제거 및 나머지 업무 하위 순번 정리 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM user_permissions
      WHERE menu_id IN (SELECT id FROM menus WHERE route = '/work/meeting-room')
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM menus WHERE route = '/work/meeting-room'
    `);

    await queryInterface.sequelize.query(`
      UPDATE menus
      SET
        "order" = CASE route
          WHEN '/work/projects' THEN 1
          WHEN '/work/approval' THEN 2
          WHEN '/work/statistics' THEN 3
          WHEN '/work/reports' THEN 4
          WHEN '/work/room-reservation' THEN 5
          WHEN '/work/quotation' THEN 6
        END,
        updated_at = NOW()
      WHERE route IN (
        '/work/projects', '/work/approval', '/work/statistics', '/work/reports',
        '/work/room-reservation', '/work/quotation'
      )
    `);
  },

  async down() {}
};
