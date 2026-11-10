'use strict';

/** 견적서 고객 이메일: 다중 수신자(쉼표 구분) 저장을 위해 길이 확장 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('quotations', 'customer_email', {
      type: Sequelize.STRING(2000),
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('quotations', 'customer_email', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
  }
};
