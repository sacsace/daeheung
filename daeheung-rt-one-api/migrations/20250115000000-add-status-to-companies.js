'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const hasCompanies = tables.some((t) => String(t).toLowerCase() === 'companies');
    if (!hasCompanies) {
      console.log('companies 테이블 없음 — create-all-tables 이후 재실행 예정, 건너뜀');
      return;
    }

    // companies 테이블에 status 컬럼이 있는지 확인
    const tableDescription = await queryInterface.describeTable('companies');
    
    // status 컬럼이 없으면 추가
    if (!tableDescription.status) {
      // PostgreSQL의 경우 ENUM 타입을 먼저 생성해야 할 수 있음
      // 하지만 Sequelize가 자동으로 처리하므로 STRING으로 추가 후 제약조건 추가
      await queryInterface.addColumn('companies', 'status', {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'active'
      });
      
      // 기존 데이터가 있으면 모두 'active'로 설정
      await queryInterface.sequelize.query(`
        UPDATE companies 
        SET status = 'active' 
        WHERE status IS NULL;
      `);
      
      // CHECK 제약조건 추가 (PostgreSQL)
      await queryInterface.sequelize.query(`
        ALTER TABLE companies 
        ADD CONSTRAINT companies_status_check 
        CHECK (status IN ('active', 'inactive', 'suspended'));
      `).catch(() => {
        // 제약조건이 이미 있거나 실패해도 계속 진행
        console.log('제약조건 추가는 선택사항입니다.');
      });
      
      console.log('✅ companies 테이블에 status 컬럼이 추가되었습니다.');
    } else {
      console.log('ℹ️  companies 테이블에 이미 status 컬럼이 존재합니다.');
    }
  },

  async down (queryInterface, Sequelize) {
    // status 컬럼 제거
    const tableDescription = await queryInterface.describeTable('companies');
    
    if (tableDescription.status) {
      // 제약조건 제거 시도
      await queryInterface.sequelize.query(`
        ALTER TABLE companies 
        DROP CONSTRAINT IF EXISTS companies_status_check;
      `).catch(() => {
        // 제약조건이 없어도 계속 진행
      });
      
      await queryInterface.removeColumn('companies', 'status');
      console.log('✅ companies 테이블에서 status 컬럼이 제거되었습니다.');
    }
  }
};

