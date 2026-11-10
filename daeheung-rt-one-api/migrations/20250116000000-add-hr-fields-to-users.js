'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');

    // 인사관리 필드 추가
    if (!table.employee_number) {
      await queryInterface.addColumn('users', 'employee_number', {
        type: Sequelize.STRING(50),
        allowNull: true
      });
    }

    if (!table.birth_date) {
      await queryInterface.addColumn('users', 'birth_date', {
        type: Sequelize.DATEONLY,
        allowNull: true
      });
    }

    if (!table.gender) {
      await queryInterface.addColumn('users', 'gender', {
        type: Sequelize.ENUM('male', 'female', 'other'),
        allowNull: true
      });
    }

    if (!table.phone) {
      await queryInterface.addColumn('users', 'phone', {
        type: Sequelize.STRING(50),
        allowNull: true
      });
    }

    if (!table.address) {
      await queryInterface.addColumn('users', 'address', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }

    if (!table.emergency_contact) {
      await queryInterface.addColumn('users', 'emergency_contact', {
        type: Sequelize.STRING(100),
        allowNull: true
      });
    }

    if (!table.emergency_phone) {
      await queryInterface.addColumn('users', 'emergency_phone', {
        type: Sequelize.STRING(50),
        allowNull: true
      });
    }

    if (!table.hire_date) {
      await queryInterface.addColumn('users', 'hire_date', {
        type: Sequelize.DATEONLY,
        allowNull: true
      });
    }

    if (!table.employment_type) {
      await queryInterface.addColumn('users', 'employment_type', {
        type: Sequelize.ENUM('fulltime', 'contract', 'parttime', 'intern'),
        allowNull: true
      });
    }

    if (!table.salary) {
      await queryInterface.addColumn('users', 'salary', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      });
    }

    // 인덱스 추가
    const indexes = await queryInterface.showIndex('users');
    const hasEmployeeNumberIndex = indexes.some(
      (index) => index.name === 'users_employee_number_idx'
    );
    if (!hasEmployeeNumberIndex) {
      await queryInterface.addIndex('users', ['employee_number'], {
        name: 'users_employee_number_idx'
      });
    }
  },

  async down (queryInterface, Sequelize) {
    // 인덱스 제거
    await queryInterface.removeIndex('users', 'users_employee_number_idx');

    // 컬럼 제거
    await queryInterface.removeColumn('users', 'salary');
    await queryInterface.removeColumn('users', 'employment_type');
    await queryInterface.removeColumn('users', 'hire_date');
    await queryInterface.removeColumn('users', 'emergency_phone');
    await queryInterface.removeColumn('users', 'emergency_contact');
    await queryInterface.removeColumn('users', 'address');
    await queryInterface.removeColumn('users', 'phone');
    await queryInterface.removeColumn('users', 'gender');
    await queryInterface.removeColumn('users', 'birth_date');
    await queryInterface.removeColumn('users', 'employee_number');
  }
};







