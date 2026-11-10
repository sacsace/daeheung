import sequelize from '../src/config/database';
import Attendance from '../src/models/Attendance';

const run = async () => {
  try {
    await sequelize.authenticate();
    const deleted = await Attendance.destroy({
      where: {},
      truncate: true,
      cascade: true
    });
    console.log(`✅ 근태 데이터 삭제 완료 (deleted=${deleted})`);
  } catch (error) {
    console.error('❌ 근태 데이터 삭제 실패:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

run();
