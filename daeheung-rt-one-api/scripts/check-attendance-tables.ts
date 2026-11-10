import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function checkAttendanceTables() {
  try {
    console.log('🔍 근태 관리 관련 테이블 확인 중...\n');

    // 1. attendance_records 테이블 존재 여부 확인
    const attendanceTableExists = await sequelize.query(
      `SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'attendance_records'
      ) as table_exists;`,
      { type: QueryTypes.SELECT }
    ) as any[];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. attendance_records 테이블 존재 여부');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('테이블 존재:', attendanceTableExists[0]?.table_exists ? '✅ 있음' : '❌ 없음');
    console.log('');

    if (attendanceTableExists[0]?.table_exists) {
      // 테이블 구조 확인
      const attendanceColumns = await sequelize.query(
        `SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'attendance_records'
        ORDER BY ordinal_position;`,
        { type: QueryTypes.SELECT }
      ) as any[];

      console.log('테이블 구조:');
      attendanceColumns.forEach((col: any) => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
      });
      console.log('');

      // 데이터 개수 확인
      const attendanceCount = await sequelize.query(
        `SELECT COUNT(*) as count FROM attendance_records;`,
        { type: QueryTypes.SELECT }
      ) as any[];

      console.log(`데이터 개수: ${attendanceCount[0]?.count || 0}개`);
      console.log('');
    }

    // 2. leave_requests 테이블 존재 여부 확인
    const leaveTableExists = await sequelize.query(
      `SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'leave_requests'
      ) as table_exists;`,
      { type: QueryTypes.SELECT }
    ) as any[];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2. leave_requests 테이블 존재 여부');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('테이블 존재:', leaveTableExists[0]?.table_exists ? '✅ 있음' : '❌ 없음');
    console.log('');

    if (leaveTableExists[0]?.table_exists) {
      // 테이블 구조 확인
      const leaveColumns = await sequelize.query(
        `SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'leave_requests'
        ORDER BY ordinal_position;`,
        { type: QueryTypes.SELECT }
      ) as any[];

      console.log('테이블 구조:');
      leaveColumns.forEach((col: any) => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
      });
      console.log('');

      // 데이터 개수 확인
      const leaveCount = await sequelize.query(
        `SELECT COUNT(*) as count FROM leave_requests;`,
        { type: QueryTypes.SELECT }
      ) as any[];

      console.log(`데이터 개수: ${leaveCount[0]?.count || 0}개`);
      console.log('');
    }

    // 3. 모든 근태 관련 테이블 목록
    const allAttendanceTables = await sequelize.query(
      `SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' 
      AND (
        table_name LIKE '%attendance%' 
        OR table_name LIKE '%leave%'
      )
      ORDER BY table_name;`,
      { type: QueryTypes.SELECT }
    ) as any[];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3. 모든 근태 관련 테이블 목록');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (allAttendanceTables.length > 0) {
      allAttendanceTables.forEach((table: any) => {
        console.log(`  - ${table.table_name}`);
      });
    } else {
      console.log('  (근태 관련 테이블 없음)');
    }
    console.log('');

    // 요약
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 요약');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`attendance_records: ${attendanceTableExists[0]?.table_exists ? '✅' : '❌'}`);
    console.log(`leave_requests: ${leaveTableExists[0]?.table_exists ? '✅' : '❌'}`);
    console.log('');

  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

checkAttendanceTables();












