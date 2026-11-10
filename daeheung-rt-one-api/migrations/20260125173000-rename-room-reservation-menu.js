 'use strict';
 
 /** @type {import('sequelize-cli').Migration} */
 module.exports = {
   async up(queryInterface) {
     await queryInterface.sequelize.query(`
       UPDATE menus
       SET name_ko = '투숙객 명단',
           name_en = 'Guest List'
       WHERE name_ko = '객실 예약 관리'
          OR route IN ('/work/room-reservation', '/hotel/room-reservation')
     `);
   },
 
   async down(queryInterface) {
     await queryInterface.sequelize.query(`
       UPDATE menus
       SET name_ko = '객실 예약 관리',
           name_en = 'Room Booking Management'
       WHERE name_ko = '투숙객 명단'
          OR route IN ('/work/room-reservation', '/hotel/room-reservation')
     `);
   }
 };
