 'use strict';
 
 /** @type {import('sequelize-cli').Migration} */
 module.exports = {
   async up(queryInterface, Sequelize) {
     const table = await queryInterface.describeTable('quotations');
 
     if (!table.is_active) {
       await queryInterface.addColumn('quotations', 'is_active', {
         type: Sequelize.BOOLEAN,
         allowNull: false,
         defaultValue: true
       });
     }
   },
 
   async down(queryInterface) {
     const table = await queryInterface.describeTable('quotations');
 
     if (table.is_active) {
       await queryInterface.removeColumn('quotations', 'is_active');
     }
   }
 };
