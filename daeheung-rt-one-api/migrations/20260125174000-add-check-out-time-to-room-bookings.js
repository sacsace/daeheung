 'use strict';
 
 /** @type {import('sequelize-cli').Migration} */
 module.exports = {
   async up(queryInterface, Sequelize) {
     const table = await queryInterface.describeTable('room_bookings');
 
     if (!table.check_out_time) {
       await queryInterface.addColumn('room_bookings', 'check_out_time', {
         type: Sequelize.TIME,
         allowNull: true
       });
     }
   },
 
   async down(queryInterface) {
     const table = await queryInterface.describeTable('room_bookings');
 
     if (table.check_out_time) {
       await queryInterface.removeColumn('room_bookings', 'check_out_time');
     }
   }
 };
