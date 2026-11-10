import { connectDB } from '../src/models';
import { Menu } from '../src/models';
import sequelize from '../src/config/database';

async function addSubMenus() {
  try {
    console.log('🚀 Adding submenus...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Database connected');
    
    // Find parent menus - check both level 0 and level 1
    const [parentMenus] = await sequelize.query(`
      SELECT id, name_ko, route, level, "order"
      FROM menus 
      WHERE tenant_id = 1 AND (level = 0 OR level = 1) AND parent_id IS NULL
      ORDER BY "order" ASC
    `);
    
    console.log('\nParent menus found:');
    (parentMenus as any[]).forEach((menu: any) => {
      console.log(`  ID: ${menu.id}, Name: ${menu.name_ko}, Route: ${menu.route}, Level: ${menu.level}, Order: ${menu.order}`);
    });
    
    const parents = (parentMenus as any[]).reduce((acc, menu) => {
      if (menu.route === '/basic-info') acc.basicInfo = menu.id;
      if (menu.route === '/hr') acc.hr = menu.id;
      if (menu.route === '/work') acc.work = menu.id;
      if (menu.route === '/inventory') acc.inventory = menu.id;
      if (menu.route === '/customers') acc.customers = menu.id;
      if (menu.route === '/accounting') acc.accounting = menu.id;
      return acc;
    }, {} as any);
    
    console.log('\nParent menu IDs:', parents);
    
    if (!parents.basicInfo || !parents.hr || !parents.work) {
      console.error('❌ Could not find parent menus!');
      console.error('Expected routes: /basic-info, /hr, /work');
      process.exit(1);
    }
    
    // Check if submenus already exist for basic-info
    const [basicInfoSubmenus] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM menus 
      WHERE tenant_id = 1 AND parent_id = ${parents.basicInfo}
    `);
    const basicInfoCount = parseInt((basicInfoSubmenus as any[])[0].count);
    console.log(`\nBasic-info submenus: ${basicInfoCount}`);
    
    // 기본정보관리 하위 메뉴
    if (parents.basicInfo) {
      console.log(`\nEnsuring basic-info submenus (parent ID: ${parents.basicInfo})...`);
      const basicInfoSubmenus = [
        { name_ko: '회사 정보 관리', name_en: 'Company Information Management', route: '/basic-info/company', icon: 'business', order: 1 },
        { name_ko: '파트너 업체 관리', name_en: 'Partner Company Management', route: '/basic-info/partners', icon: 'business', order: 2 },
        { name_ko: '조직도 관리', name_en: 'Organization Chart Management', route: '/basic-info/organization', icon: 'account_tree', order: 3 },
        { name_ko: '메뉴권한관리', name_en: 'Menu Permission Management', route: '/basic-info/menu-permissions', icon: 'lock', order: 4 },
        { name_ko: '로그인 정보 관리', name_en: 'Login Information Management', route: '/basic-info/login-info', icon: 'person', order: 5 },
        { name_ko: '시스템 설정', name_en: 'System Settings', route: '/basic-info/system-settings', icon: 'settings', order: 6 },
      ];
      
      for (const submenu of basicInfoSubmenus) {
        const [menu, created] = await Menu.findOrCreate({
          where: { tenant_id: 1, route: submenu.route },
          defaults: {
            tenant_id: 1,
            parent_id: parents.basicInfo,
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
        if (created) {
          console.log(`  ✅ Created: ${submenu.name_ko}`);
        } else {
          console.log(`  ⚠️  Already exists: ${submenu.name_ko}`);
        }
      }
    } else {
      console.error('❌ Could not find basic-info parent menu!');
    }
    
    // 인사관리 하위 메뉴
    const [hrSubmenus] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM menus 
      WHERE tenant_id = 1 AND parent_id = ${parents.hr}
    `);
    const hrCount = parseInt((hrSubmenus as any[])[0].count);
    console.log(`\nHR submenus: ${hrCount}`);
    
    if (hrCount === 0 && parents.hr) {
      console.log(`\nAdding hr submenus (parent ID: ${parents.hr})...`);
      const hrSubmenus = [
        { name_ko: '사용자 관리', name_en: 'User Management', route: '/hr/users', icon: 'people', order: 1 },
        { name_ko: '전자근로계약', name_en: 'Employment Contracts', route: '/hr/employment-contracts', icon: 'description', order: 2 },
        { name_ko: '근태 관리', name_en: 'Attendance Management', route: '/hr/attendance', icon: 'schedule', order: 3 },
        { name_ko: '근태 통계', name_en: 'Attendance Statistics', route: '/hr/attendance/statistics', icon: 'assessment', order: 4 },
        { name_ko: '휴가 관리', name_en: 'Leave Management', route: '/hr/leave', icon: 'event', order: 5 },
        { name_ko: '급여 관리', name_en: 'Payroll Management', route: '/hr/payroll', icon: 'payments', order: 6 }
      ];
      
      for (const submenu of hrSubmenus) {
        const [menu, created] = await Menu.findOrCreate({
          where: { tenant_id: 1, route: submenu.route },
          defaults: {
            tenant_id: 1,
            parent_id: parents.hr,
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
        if (created) {
          console.log(`  ✅ Created: ${submenu.name_ko}`);
        } else {
          console.log(`  ⚠️  Already exists: ${submenu.name_ko}`);
        }
      }
    } else {
      console.log(`  HR submenus already exist (${hrCount} items)`);
    }
    
    // 업무관리 하위 메뉴
    const [workSubmenus] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM menus 
      WHERE tenant_id = 1 AND parent_id = ${parents.work}
    `);
    const workCount = parseInt((workSubmenus as any[])[0].count);
    console.log(`\nWork submenus: ${workCount}`);
    
    if (workCount === 0 && parents.work) {
      console.log(`\nAdding work submenus (parent ID: ${parents.work})...`);
      const workSubmenus = [
        { name_ko: '업무 관리', name_en: 'Work Management', route: '/work/projects', icon: 'view_kanban', order: 1 },
        { name_ko: '전자결재', name_en: 'Electronic Approval', route: '/work/approval', icon: 'approval', order: 2 },
        { name_ko: '업무 통계', name_en: 'Task Statistics', route: '/work/statistics', icon: 'bar_chart', order: 3 },
        { name_ko: '업무 보고서', name_en: 'Work Report', route: '/work/reports', icon: 'assessment', order: 4 },
        { name_ko: '객실 예약 관리', name_en: 'Room Reservation Management', route: '/work/room-reservation', icon: 'hotel', order: 5 }
      ];
      
      for (const submenu of workSubmenus) {
        const [menu, created] = await Menu.findOrCreate({
          where: { tenant_id: 1, route: submenu.route },
          defaults: {
            tenant_id: 1,
            parent_id: parents.work,
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
        if (created) {
          console.log(`  ✅ Created: ${submenu.name_ko}`);
        } else {
          console.log(`  ⚠️  Already exists: ${submenu.name_ko}`);
        }
      }
    } else {
      console.log(`  Work submenus already exist (${workCount} items)`);
    }
    
    console.log('\n✅ Submenus check completed!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to add submenus:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    });
    process.exit(1);
  }
}

addSubMenus();
