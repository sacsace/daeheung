 'use strict';
 
 module.exports = {
   up: async (queryInterface, Sequelize) => {
     const table = await queryInterface.describeTable('attendances');
 
     if (!table.check_in_client_time) {
       await queryInterface.addColumn('attendances', 'check_in_client_time', {
         type: Sequelize.STRING,
         allowNull: true
       });
     }
 
     if (!table.check_out_client_time) {
       await queryInterface.addColumn('attendances', 'check_out_client_time', {
         type: Sequelize.STRING,
         allowNull: true
       });
     }
   },
 
   down: async (queryInterface) => {
     const table = await queryInterface.describeTable('attendances');
 
     if (table.check_in_client_time) {
       await queryInterface.removeColumn('attendances', 'check_in_client_time');
     }
 
     if (table.check_out_client_time) {
       await queryInterface.removeColumn('attendances', 'check_out_client_time');
     }
   }
 };
