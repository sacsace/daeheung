import { connectDB } from '../src/models';
import { Menu } from '../src/models';

async function updateExpenseMenuName() {
  try {
    await connectDB();
    const [updated] = await Menu.update(
      { name_ko: '지출결의서' },
      {
        where: {
          route: '/accounting/expense'
        }
      }
    );

    const fallbackUpdated = await Menu.update(
      { name_ko: '지출결의서' },
      {
        where: {
          name_ko: '지출보고서'
        }
      }
    );

    console.log(`✅ 업데이트 완료: route 기준 ${updated}건, 이름 기준 ${fallbackUpdated[0]}건`);
    process.exit(0);
  } catch (error: any) {
    console.error('❌ 메뉴명 업데이트 실패:', error);
    process.exit(1);
  }
}

updateExpenseMenuName();
