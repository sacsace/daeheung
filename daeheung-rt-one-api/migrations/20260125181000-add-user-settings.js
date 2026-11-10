 'use strict';
 
 /** @type {import('sequelize-cli').Migration} */
 module.exports = {
   async up(queryInterface, Sequelize) {
     const table = await queryInterface.describeTable('users');
 
     if (!table.settings) {
       await queryInterface.addColumn('users', 'settings', {
         type: Sequelize.JSON,
         allowNull: true
       });
     }
   },
 
   async down(queryInterface) {
     const table = await queryInterface.describeTable('users');
 
     if (table.settings) {
       await queryInterface.removeColumn('users', 'settings');
     }
   }
 };
