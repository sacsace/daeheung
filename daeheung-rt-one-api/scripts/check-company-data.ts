import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function checkCompanyData() {
  try {
    console.log('🔍 회사정보 관리 테이블 데이터 확인 중...\n');

    // 1. companies 테이블 존재 여부 확인
    const tableExists = await sequelize.query(
      `SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'companies'
      ) as table_exists;`,
      { type: QueryTypes.SELECT }
    ) as any[];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. companies 테이블 존재 여부');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('테이블 존재:', tableExists[0]?.table_exists ? '✅ 있음' : '❌ 없음');
    console.log('');

    if (!tableExists[0]?.table_exists) {
      console.log('❌ companies 테이블이 존재하지 않습니다.');
      await sequelize.close();
      return;
    }

    // 2. 테이블 구조 확인
    const columns = await sequelize.query(
      `SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'companies'
      ORDER BY ordinal_position;`,
      { type: QueryTypes.SELECT }
    ) as any[];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2. companies 테이블 구조');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    columns.forEach((col: any) => {
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      console.log(`  - ${col.column_name}: ${col.data_type}${length} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });
    console.log('');

    // 3. 데이터 개수 확인
    const countResult = await sequelize.query(
      `SELECT COUNT(*) as count FROM companies;`,
      { type: QueryTypes.SELECT }
    ) as any[];

    const totalCount = countResult[0]?.count || 0;
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3. 데이터 개수');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`전체 회사 수: ${totalCount}개`);
    console.log('');

    if (totalCount === 0) {
      console.log('⚠️  companies 테이블에 데이터가 없습니다.');
      console.log('');
    } else {
      // 4. 데이터 상세 확인
      const companies = await sequelize.query(
        `SELECT 
          id,
          tenant_id,
          name,
          business_number,
          ceo_name,
          status,
          created_at,
          updated_at
        FROM companies
        ORDER BY id
        LIMIT 10;`,
        { type: QueryTypes.SELECT }
      ) as any[];

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('4. 회사 데이터 (최대 10개)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      if (companies.length > 0) {
        companies.forEach((company: any, index: number) => {
          console.log(`\n[${index + 1}]`);
          console.log(`  ID: ${company.id}`);
          console.log(`  테넌트 ID: ${company.tenant_id}`);
          console.log(`  회사명: ${company.name || '(없음)'}`);
          console.log(`  사업자번호: ${company.business_number || '(없음)'}`);
          console.log(`  대표자: ${company.ceo_name || '(없음)'}`);
          console.log(`  상태: ${company.status || '(없음)'}`);
          console.log(`  생성일: ${company.created_at || '(없음)'}`);
        });
      } else {
        console.log('  (데이터 없음)');
      }
      console.log('');

      // 5. 상태별 통계
      const statusStats = await sequelize.query(
        `SELECT 
          status,
          COUNT(*) as count
        FROM companies
        GROUP BY status
        ORDER BY count DESC;`,
        { type: QueryTypes.SELECT }
      ) as any[];

      if (statusStats.length > 0) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('5. 상태별 통계');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        statusStats.forEach((stat: any) => {
          console.log(`  ${stat.status || '(null)'}: ${stat.count}개`);
        });
        console.log('');
      }
    }

    // 요약
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 요약');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`테이블 존재: ${tableExists[0]?.table_exists ? '✅' : '❌'}`);
    console.log(`데이터 개수: ${totalCount}개`);
    if (totalCount === 0) {
      console.log('⚠️  데이터가 없습니다. 회사를 추가해야 합니다.');
    } else {
      console.log('✅ 데이터가 있습니다.');
    }
    console.log('');

  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

checkCompanyData();
