'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('room_bookings');

    if (!table.airport_pickup) {
      await queryInterface.addColumn('room_bookings', 'airport_pickup', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }

    if (!table.airport_arrival_time) {
      await queryInterface.addColumn('room_bookings', 'airport_arrival_time', {
        type: Sequelize.TIME,
        allowNull: true
      });
    }

    if (!table.flight_number) {
      await queryInterface.addColumn('room_bookings', 'flight_number', {
        type: Sequelize.STRING(50),
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('room_bookings');

    if (table.flight_number) {
      await queryInterface.removeColumn('room_bookings', 'flight_number');
    }
    if (table.airport_arrival_time) {
      await queryInterface.removeColumn('room_bookings', 'airport_arrival_time');
    }
    if (table.airport_pickup) {
      await queryInterface.removeColumn('room_bookings', 'airport_pickup');
    }
  }
};
