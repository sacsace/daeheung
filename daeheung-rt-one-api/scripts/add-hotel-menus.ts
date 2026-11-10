import { connectDB } from '../src/models';
import { Menu } from '../src/models';
import sequelize from '../src/config/database';

const TENANT_ID = 1;

async function addHotelMenus() {
  try {
    console.log('🚀 호텔 관리 메뉴 추가 시작...');
    await connectDB();
    console.log('✅ Database connected');

    const [topOrderRows] = await sequelize.query(`
      SELECT COALESCE(MAX("order"), 0) as max_order
      FROM menus
      WHERE tenant_id = ${TENANT_ID} AND parent_id IS NULL
    `);

    const maxOrder = parseInt((topOrderRows as any[])[0].max_order, 10) || 0;
    const defaultTopOrder = maxOrder + 1;

    const [hotelMenu, createdHotel] = await Menu.findOrCreate({
      where: { tenant_id: TENANT_ID, route: '/hotel' },
      defaults: {
        tenant_id: TENANT_ID,
        parent_id: null,
        name_ko: '기숙사 관리',
        name_en: 'Dormitory Management',
        route: '/hotel',
        icon: 'hotel',
        order: defaultTopOrder,
        level: 0,
        is_active: true,
        description: '기숙사 관리'
      }
    });

    if (!createdHotel) {
      await hotelMenu.update({
        parent_id: null,
        name_ko: '기숙사 관리',
        name_en: 'Dormitory Management',
        icon: 'hotel',
        level: 0,
        is_active: true
      });
      console.log('ℹ️  기존 호텔 관리 메뉴가 있어 업데이트했습니다.');
    } else {
      console.log('✅ 호텔 관리 메뉴 생성 완료');
    }

    const hotelSubmenus = [
      { name_ko: '프론트데스크', name_en: 'Front Desk', route: '/hotel/front-desk', icon: 'desk', order: 1 },
      { name_ko: '예약 현황 관리', name_en: 'Reservation Status', route: '/hotel/reservations', icon: 'event_available', order: 3 },
      { name_ko: '객실 유형 관리', name_en: 'Room Type Management', route: '/hotel/room-types', icon: 'category', order: 4 }
    ];

    for (const submenu of hotelSubmenus) {
      const [menu, created] = await Menu.findOrCreate({
        where: { tenant_id: TENANT_ID, route: submenu.route },
        defaults: {
          tenant_id: TENANT_ID,
          parent_id: hotelMenu.id,
          name_ko: submenu.name_ko,
          name_en: submenu.name_en,
          route: submenu.route,
          icon: submenu.icon,
          order: submenu.order,
          level: 2,
          is_active: true,
          description: submenu.name_ko
        }
      });

      if (!created) {
        await menu.update({
          parent_id: hotelMenu.id,
          name_ko: submenu.name_ko,
          name_en: submenu.name_en,
          icon: submenu.icon,
          order: submenu.order,
          level: 2,
          is_active: true
        });
        console.log(`ℹ️  기존 메뉴 업데이트: ${submenu.name_ko}`);
      } else {
        console.log(`✅ 하위 메뉴 생성: ${submenu.name_ko}`);
      }
    }

    const roomReservation = await Menu.findOne({
      where: { tenant_id: TENANT_ID, route: '/work/room-reservation' }
    });

    if (roomReservation) {
      await roomReservation.update({
        parent_id: hotelMenu.id,
        order: 6,
        level: 2,
        is_active: true
      });
      console.log('✅ 객실 예약 관리 메뉴를 호텔 관리 하위로 이동했습니다.');
    } else {
      console.log('⚠️  객실 예약 관리 메뉴를 찾지 못했습니다. 수동 확인이 필요합니다.');
    }

    console.log('🎉 호텔 관리 메뉴 추가 완료');
    process.exit(0);
  } catch (error) {
    console.error('❌ 호텔 관리 메뉴 추가 실패:', error);
    process.exit(1);
  }
}

addHotelMenus();
