import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

const checkCompanyGstJoin = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ 데이터베이스 연결 성공\n');
    console.log('📊 companies 테이블과 company_gst_numbers 테이블 조인 조회\n');

    // 1. 모든 회사와 GST 번호 조회 (LEFT JOIN)
    console.log('1️⃣ 모든 회사와 GST 번호 조회 (LEFT JOIN):');
    console.log('─'.repeat(80));
    const allCompanies = await sequelize.query(`
      SELECT 
        c.id AS company_id,
        c.name AS company_name,
        c.business_number,
        c.tenant_id,
        gst.id AS gst_id,
        gst.gst_number,
        gst.state_code,
        gst.registration_date,
        gst.status AS gst_status,
        gst.created_at AS gst_created_at
      FROM companies c
      LEFT JOIN company_gst_numbers gst ON c.id = gst.company_id
      ORDER BY c.id, gst.id;
    `, { type: QueryTypes.SELECT }) as any[];

    allCompanies.forEach((row: any) => {
      console.log(`회사 ID: ${row.company_id}, 이름: ${row.company_name}, GST: ${row.gst_number || '(없음)'}`);
    });
    console.log('─'.repeat(80));
    console.log(`총 ${allCompanies.length}개 행\n`);

    // 2. 회사별 GST 번호 개수 집계
    console.log('2️⃣ 회사별 GST 번호 개수 집계:');
    console.log('─'.repeat(80));
    const gstCounts = await sequelize.query(`
      SELECT 
        c.id AS company_id,
        c.name AS company_name,
        COUNT(gst.id) AS gst_count,
        STRING_AGG(gst.gst_number, ', ') AS gst_numbers
      FROM companies c
      LEFT JOIN company_gst_numbers gst ON c.id = gst.company_id
      GROUP BY c.id, c.name
      ORDER BY c.id;
    `, { type: QueryTypes.SELECT }) as any[];

    gstCounts.forEach((row: any) => {
      console.log(`회사 ID: ${row.company_id}, 이름: ${row.company_name}`);
      console.log(`  GST 개수: ${row.gst_count}, GST 번호: ${row.gst_numbers || '(없음)'}`);
    });
    console.log('─'.repeat(80));
    console.log(`총 ${gstCounts.length}개 회사\n`);

    // 3. 모든 회사의 GST 번호를 배열로 조회
    console.log('3️⃣ 모든 회사의 GST 번호를 배열로 조회:');
    console.log('─'.repeat(80));
    const gstArrays = await sequelize.query(`
      SELECT 
        c.id AS company_id,
        c.name AS company_name,
        ARRAY_AGG(gst.gst_number) FILTER (WHERE gst.gst_number IS NOT NULL) AS gst_numbers
      FROM companies c
      LEFT JOIN company_gst_numbers gst ON c.id = gst.company_id
      GROUP BY c.id, c.name
      ORDER BY c.id;
    `, { type: QueryTypes.SELECT }) as any[];

    gstArrays.forEach((row: any) => {
      console.log(`회사 ID: ${row.company_id}, 이름: ${row.company_name}`);
      console.log(`  GST 번호 배열: ${JSON.stringify(row.gst_numbers || [])}`);
    });
    console.log('─'.repeat(80));
    console.log(`총 ${gstArrays.length}개 회사\n`);

    // 4. 특정 회사 (ID=1)의 GST 번호 조회
    console.log('4️⃣ 특정 회사 (ID=1)의 GST 번호 조회:');
    console.log('─'.repeat(80));
    const company1 = await sequelize.query(`
      SELECT 
        c.id AS company_id,
        c.name AS company_name,
        gst.gst_number,
        gst.state_code,
        gst.status AS gst_status
      FROM companies c
      LEFT JOIN company_gst_numbers gst ON c.id = gst.company_id
      WHERE c.id = 1
      ORDER BY gst.id;
    `, { type: QueryTypes.SELECT }) as any[];

    if (company1.length > 0) {
      console.log(`회사: ${company1[0].company_name} (ID: ${company1[0].company_id})`);
      company1.forEach((row: any) => {
        if (row.gst_number) {
          console.log(`  GST 번호: ${row.gst_number}, 상태: ${row.gst_status || 'N/A'}`);
        } else {
          console.log(`  GST 번호: (없음)`);
        }
      });
    } else {
      console.log('회사 ID=1을 찾을 수 없습니다.');
    }
    console.log('─'.repeat(80));
    console.log(`총 ${company1.length}개 행\n`);

    // 5. GST 번호가 있는 회사만 조회 (INNER JOIN)
    console.log('5️⃣ GST 번호가 있는 회사만 조회 (INNER JOIN):');
    console.log('─'.repeat(80));
    const companiesWithGst = await sequelize.query(`
      SELECT 
        c.id AS company_id,
        c.name AS company_name,
        c.business_number,
        gst.gst_number,
        gst.status AS gst_status
      FROM companies c
      INNER JOIN company_gst_numbers gst ON c.id = gst.company_id
      WHERE gst.status = 'active'
      ORDER BY c.id, gst.id;
    `, { type: QueryTypes.SELECT }) as any[];

    companiesWithGst.forEach((row: any) => {
      console.log(`회사: ${row.company_name} (ID: ${row.company_id}), GST: ${row.gst_number}`);
    });
    console.log('─'.repeat(80));
    console.log(`총 ${companiesWithGst.length}개 행\n`);

  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    if (error.code) {
      console.error('   오류 코드:', error.code);
    }
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
};

checkCompanyGstJoin();























