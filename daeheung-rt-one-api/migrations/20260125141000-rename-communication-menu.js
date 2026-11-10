 'use strict';
 
 /** @type {import('sequelize-cli').Migration} */
 module.exports = {
   async up(queryInterface) {
     await queryInterface.sequelize.query(`
       UPDATE menus
       SET name_ko = '공지사항',
           name_en = 'Notices',
           description = COALESCE(description, '공지 및 알림 관리')
       WHERE route = '/communication'
          OR name_ko = '커뮤니케이션'
          OR name_en = 'Communication'
     `);
   },
 
   async down(queryInterface) {
     await queryInterface.sequelize.query(`
       UPDATE menus
       SET name_ko = '커뮤니케이션',
           name_en = 'Communication',
           description = COALESCE(description, '커뮤니케이션 관리')
       WHERE route = '/communication'
          OR name_ko = '공지사항'
          OR name_en = 'Notices'
     `);
   }
 };
