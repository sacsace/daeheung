import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function checkAndAddRoomBookingsTable() {
  try {
    console.log('📋 room_bookings 테이블 확인 중...');

    // 테이블 존재 여부 확인
    const tableExists = await sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'room_bookings'
      );`,
      { type: QueryTypes.SELECT }
    );

    const exists = (tableExists[0] as any).exists;

    if (exists) {
      console.log('✅ room_bookings 테이블이 이미 존재합니다.');
      
      // is_active 컬럼 존재 확인
      const columnExists = await sequelize.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'room_bookings' 
          AND column_name = 'is_active'
        );`,
        { type: QueryTypes.SELECT }
      );

      if ((columnExists[0] as any).exists) {
        console.log('✅ room_bookings 테이블에 is_active 컬럼이 이미 존재합니다.');
      } else {
        console.log('⚠️  is_active 컬럼이 없습니다. 추가 중...');
        await sequelize.query(`
          ALTER TABLE room_bookings 
          ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
        `);
        console.log('✅ is_active 컬럼이 추가되었습니다.');
      }
      return;
    }

    console.log('⚠️  room_bookings 테이블이 없습니다. 생성 중...');

    // ENUM 타입 생성
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_room_bookings_status" AS ENUM('confirmed', 'pending', 'cancelled', 'checked_in', 'checked_out', 'no_show');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE "enum_room_bookings_payment_status" AS ENUM('pending', 'paid', 'refunded', 'partial');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // room_bookings 테이블 생성
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS room_bookings (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        booking_id VARCHAR(100) NOT NULL UNIQUE,
        room_id INTEGER NOT NULL,
        room_number VARCHAR(50) NOT NULL,
        room_type VARCHAR(50) NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        guest_name VARCHAR(255) NOT NULL,
        guest_email VARCHAR(255),
        guest_phone VARCHAR(50),
        check_in_date DATE NOT NULL,
        check_out_date DATE NOT NULL,
        number_of_guests INTEGER NOT NULL DEFAULT 1,
        total_nights INTEGER NOT NULL DEFAULT 1,
        total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
        status "enum_room_bookings_status" NOT NULL DEFAULT 'pending',
        payment_status "enum_room_bookings_payment_status" NOT NULL DEFAULT 'pending',
        payment_method VARCHAR(50),
        special_requests TEXT,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 인덱스 생성
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS room_bookings_tenant_company_idx ON room_bookings(tenant_id, company_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS room_bookings_booking_id_idx ON room_bookings(booking_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS room_bookings_room_id_idx ON room_bookings(room_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS room_bookings_user_id_idx ON room_bookings(user_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS room_bookings_dates_idx ON room_bookings(check_in_date, check_out_date);
    `);

    console.log('✅ room_bookings 테이블이 생성되었습니다.');
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

checkAndAddRoomBookingsTable();



