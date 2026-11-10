import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

async function checkUserMenuPermission() {
  try {
    const username = process.argv[2] || 'ydi';
    const menuRoute = process.argv[3] || '/accounting/e-invoice';

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 사용자 메뉴 권한 확인');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`사용자명: ${username}`);
    console.log(`메뉴 경로: ${menuRoute}`);
    console.log('');

    // 1. 사용자 정보 조회 (username 또는 userid로 검색)
    const [user] = await sequelize.query(`
      SELECT id, userid, username, email, role, tenant_id, company_id, status
      FROM users
      WHERE username = :username OR userid = :username
      LIMIT 1
    `, {
      replacements: { username },
      type: QueryTypes.SELECT
    }) as any[];

    if (!user) {
      console.log('❌ 사용자를 찾을 수 없습니다.');
      return;
    }

    console.log('✅ 사용자 정보:');
    console.log(`  - ID: ${user.id}`);
    console.log(`  - 사용자명: ${user.username}`);
    console.log(`  - 이메일: ${user.email}`);
    console.log(`  - 역할: ${user.role}`);
    console.log(`  - Tenant ID: ${user.tenant_id}`);
    console.log(`  - Company ID: ${user.company_id}`);
    console.log(`  - 상태: ${user.status}`);
    console.log('');

    // root나 admin 역할이면 모든 권한 있음
    if (user.role === 'root' || user.role === 'admin') {
      console.log('✅ root/admin 역할이므로 모든 메뉴에 접근 가능합니다.');
      return;
    }

    // 2. 메뉴 정보 조회
    const [menu] = await sequelize.query(`
      SELECT id, name_ko, name_en, route, parent_id, level
      FROM menus
      WHERE route = :route
      AND tenant_id = :tenant_id
      AND is_active = true
      LIMIT 1
    `, {
      replacements: { route: menuRoute, tenant_id: user.tenant_id },
      type: QueryTypes.SELECT
    }) as any[];

    if (!menu) {
      console.log('❌ 메뉴를 찾을 수 없습니다.');
      console.log(`  경로: ${menuRoute}`);
      return;
    }

    console.log('✅ 메뉴 정보:');
    console.log(`  - ID: ${menu.id}`);
    console.log(`  - 이름 (한글): ${menu.name_ko}`);
    console.log(`  - 이름 (영문): ${menu.name_en}`);
    console.log(`  - 경로: ${menu.route}`);
    console.log(`  - 부모 ID: ${menu.parent_id}`);
    console.log(`  - 레벨: ${menu.level}`);
    console.log('');

    // 3. 사용자 메뉴 권한 조회
    const [permission] = await sequelize.query(`
      SELECT 
        id,
        user_id,
        menu_id,
        can_view,
        can_create,
        can_edit,
        can_delete,
        created_at,
        updated_at
      FROM user_permissions
      WHERE user_id = :user_id
      AND menu_id = :menu_id
      LIMIT 1
    `, {
      replacements: { user_id: user.id, menu_id: menu.id },
      type: QueryTypes.SELECT
    }) as any[];

    if (!permission) {
      console.log('❌ 권한이 없습니다.');
      console.log(`  사용자 ID: ${user.id}`);
      console.log(`  메뉴 ID: ${menu.id}`);
      console.log('');
      console.log('📋 권한 상세:');
      console.log('  - 보기 (can_view): 없음');
      console.log('  - 등록 (can_create): 없음');
      console.log('  - 수정 (can_edit): 없음');
      console.log('  - 삭제 (can_delete): 없음');
      return;
    }

    console.log('✅ 권한이 있습니다.');
    console.log('');
    console.log('📋 권한 상세:');
    console.log(`  - 보기 (can_view): ${permission.can_view ? '✅ 있음' : '❌ 없음'}`);
    console.log(`  - 등록 (can_create): ${permission.can_create ? '✅ 있음' : '❌ 없음'}`);
    console.log(`  - 수정 (can_edit): ${permission.can_edit ? '✅ 있음' : '❌ 없음'}`);
    console.log(`  - 삭제 (can_delete): ${permission.can_delete ? '✅ 있음' : '❌ 없음'}`);
    console.log('');
    console.log('📅 권한 정보:');
    console.log(`  - 권한 ID: ${permission.id}`);
    console.log(`  - 생성일: ${permission.created_at}`);
    console.log(`  - 수정일: ${permission.updated_at}`);

    // 4. 부모 메뉴 권한도 확인
    if (menu.parent_id) {
      console.log('');
      console.log('🔍 부모 메뉴 권한 확인 중...');
      const [parentMenu] = await sequelize.query(`
        SELECT id, name_ko, name_en, route
        FROM menus
        WHERE id = :parent_id
        LIMIT 1
      `, {
        replacements: { parent_id: menu.parent_id },
        type: QueryTypes.SELECT
      }) as any[];

      if (parentMenu) {
        console.log(`부모 메뉴: ${parentMenu.name_ko} (${parentMenu.route})`);
        
        const [parentPermission] = await sequelize.query(`
          SELECT can_view, can_create, can_edit, can_delete
          FROM user_permissions
          WHERE user_id = :user_id
          AND menu_id = :menu_id
          LIMIT 1
        `, {
          replacements: { user_id: user.id, menu_id: menu.parent_id },
          type: QueryTypes.SELECT
        }) as any[];

        if (parentPermission) {
          console.log(`부모 메뉴 권한 - 보기: ${parentPermission.can_view ? '✅' : '❌'}`);
        } else {
          console.log('부모 메뉴 권한: 없음');
        }
      }
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    console.error('상세 오류:', error);
    throw error;
  }
}

// 스크립트 실행
checkUserMenuPermission()
  .then(() => {
    console.log('✅ 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });

