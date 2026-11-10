const { User, Menu, UserPermission } = require('../dist/models');

async function setUserPermissions() {
  try {
    console.log('🚀 사용자 권한 설정 시작...');
    
    // 모든 사용자와 메뉴 조회
    const users = await User.findAll();
    const menus = await Menu.findAll();
    
    console.log(`📊 사용자 ${users.length}명, 메뉴 ${menus.length}개 발견`);
    
    // 각 사용자에게 모든 메뉴에 대한 권한 부여
    for (const user of users) {
      console.log(`👤 ${user.username} 사용자 권한 설정 중...`);
      
      // 기존 권한 삭제
      await UserPermission.destroy({
        where: { user_id: user.id }
      });
      
      // 새 권한 생성
      const permissions = menus.map(menu => ({
        user_id: user.id,
        menu_id: menu.id,
        can_view: true,
        can_create: user.role === 'admin' || user.role === 'root',
        can_edit: user.role === 'admin' || user.role === 'root',
        can_delete: user.role === 'admin' || user.role === 'root'
      }));
      
      await UserPermission.bulkCreate(permissions);
      console.log(`✅ ${user.username} 사용자 권한 설정 완료`);
    }
    
    console.log('✅ 모든 사용자 권한 설정 완료!');
    process.exit(0);
  } catch (error) {
    console.error('❌ 사용자 권한 설정 실패:', error);
    process.exit(1);
  }
}

setUserPermissions();
