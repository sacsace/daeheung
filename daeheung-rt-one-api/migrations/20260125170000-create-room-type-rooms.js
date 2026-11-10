 'use strict';
 
 /** @type {import('sequelize-cli').Migration} */
 module.exports = {
   async up(queryInterface, Sequelize) {
     await queryInterface.createTable('room_type_rooms', {
       id: {
         type: Sequelize.INTEGER,
         autoIncrement: true,
         primaryKey: true
       },
       tenant_id: {
         type: Sequelize.INTEGER,
         allowNull: false,
         references: {
           model: 'tenants',
           key: 'id'
         }
       },
       company_id: {
         type: Sequelize.INTEGER,
         allowNull: false,
         references: {
           model: 'companies',
           key: 'id'
         }
       },
       room_type_id: {
         type: Sequelize.INTEGER,
         allowNull: false,
         references: {
           model: 'room_types',
           key: 'id'
         }
       },
       room_number: {
         type: Sequelize.STRING(50),
         allowNull: false
       },
       room_name: {
         type: Sequelize.STRING(200),
         allowNull: true
       },
       created_by: {
         type: Sequelize.INTEGER,
         allowNull: false,
         references: {
           model: 'users',
           key: 'id'
         }
       },
       created_at: {
         type: Sequelize.DATE,
         allowNull: false,
         defaultValue: Sequelize.NOW
       },
       updated_at: {
         type: Sequelize.DATE,
         allowNull: false,
         defaultValue: Sequelize.NOW
       }
     });
 
     await queryInterface.addIndex('room_type_rooms', ['tenant_id', 'company_id', 'room_type_id', 'room_number'], {
       unique: true,
       name: 'room_type_rooms_unique_room'
     });
   },
 
   async down(queryInterface) {
     await queryInterface.dropTable('room_type_rooms');
   }
 };
