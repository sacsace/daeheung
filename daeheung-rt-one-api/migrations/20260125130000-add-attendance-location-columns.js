 'use strict';
 
 /** @type {import('sequelize-cli').Migration} */
 module.exports = {
   async up(queryInterface, Sequelize) {
     const table = await queryInterface.describeTable('attendances');
 
     if (!table.check_in_lat) {
       await queryInterface.addColumn('attendances', 'check_in_lat', {
         type: Sequelize.DECIMAL(9, 6),
         allowNull: true
       });
     }
 
     if (!table.check_in_lng) {
       await queryInterface.addColumn('attendances', 'check_in_lng', {
         type: Sequelize.DECIMAL(9, 6),
         allowNull: true
       });
     }
 
     if (!table.check_in_accuracy) {
       await queryInterface.addColumn('attendances', 'check_in_accuracy', {
         type: Sequelize.DECIMAL(8, 2),
         allowNull: true
       });
     }
   },
 
   async down(queryInterface) {
     const table = await queryInterface.describeTable('attendances');
 
     if (table.check_in_accuracy) {
       await queryInterface.removeColumn('attendances', 'check_in_accuracy');
     }
 
     if (table.check_in_lng) {
       await queryInterface.removeColumn('attendances', 'check_in_lng');
     }
 
     if (table.check_in_lat) {
       await queryInterface.removeColumn('attendances', 'check_in_lat');
     }
   }
 };
