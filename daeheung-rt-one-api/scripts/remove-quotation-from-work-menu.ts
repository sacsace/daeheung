import sequelize from '../src/config/database';
import { Menu } from '../src/models';
import { QueryTypes } from 'sequelize';

async function removeQuotationFromWorkMenu() {
  try {
    console.log('📋 업무관리 메뉴에서 견적서 관리 메뉴 제거 중...');

    // 업무관리 부모 메뉴 찾기
    const [workParent] = await sequelize.query(`
      SELECT id FROM menus 
      WHERE tenant_id = 1 
      AND (name_ko = '업무관리' OR name_en = 'Work Management' OR route = '/work')
      AND level = 1
      LIMIT 1
    `, { type: QueryTypes.SELECT });

    if (!workParent || (workParent as any).length === 0) {
      console.log('⚠️  업무관리 부모 메뉴를 찾을 수 없습니다.');
      return;
    }

    const workParentId = (workParent as any).id;
    console.log(`✅ 업무관리 부모 메뉴 ID: ${workParentId}`);

    // 견적서 관리 메뉴 찾기
    const [quotationMenu] = await sequelize.query(`
      SELECT id, name_ko, name_en, route FROM menus 
      WHERE tenant_id = 1 
      AND parent_id = ${workParentId}
      AND (name_ko LIKE '%견적서%' OR name_en LIKE '%Quotation%' OR route LIKE '%quotation%')
      LIMIT 1
    `, { type: QueryTypes.SELECT });

    if (!quotationMenu || (quotationMenu as any).length === 0) {
      console.log('⚠️  업무관리 하위에 견적서 관리 메뉴를 찾을 수 없습니다.');
      return;
    }

    const quotationMenuId = (quotationMenu as any).id;
    const quotationMenuName = (quotationMenu as any).name_ko || (quotationMenu as any).name_en;
    console.log(`✅ 견적서 관리 메뉴 찾음: ID=${quotationMenuId}, 이름=${quotationMenuName}`);

    // 메뉴 비활성화 (삭제 대신 비활성화)
    await Menu.update(
      { is_active: false },
      { where: { id: quotationMenuId } }
    );

    console.log(`✅ 견적서 관리 메뉴가 비활성화되었습니다. (ID: ${quotationMenuId})`);

    // 다른 메뉴들의 order 값 조정 (선택사항)
    const otherMenusResult = await sequelize.query(`
      SELECT id, "order" FROM menus 
      WHERE tenant_id = 1 
      AND parent_id = ${workParentId}
      AND id != ${quotationMenuId}
      AND is_active = true
      ORDER BY "order" ASC
    `, { type: QueryTypes.SELECT });

    const otherMenus = otherMenusResult as any[];

    // order 값 재정렬
    let newOrder = 1;
    for (const menu of otherMenus) {
      await Menu.update(
        { order: newOrder },
        { where: { id: menu.id } }
      );
      newOrder++;
    }

    console.log('✅ 다른 메뉴들의 순서가 재정렬되었습니다.');
    console.log('\n✅ 작업 완료!');

  } catch (error: any) {
    console.error('❌ 오류 발생:', error);
    throw error;
  } finally {
    // sequelize.close();
  }
}

removeQuotationFromWorkMenu();

