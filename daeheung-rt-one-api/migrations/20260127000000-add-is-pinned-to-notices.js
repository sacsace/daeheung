'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // is_pinned 컬럼이 이미 존재하는지 확인
    const tableDescription = await queryInterface.describeTable('notices');
    
    if (!tableDescription.is_pinned) {
      await queryInterface.addColumn('notices', 'is_pinned', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('notices');
    
    if (tableDescription.is_pinned) {
      await queryInterface.removeColumn('notices', 'is_pinned');
    }
  }
};
