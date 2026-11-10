import { sequelize } from '../src/models';
import { QueryTypes } from 'sequelize';
import bcrypt from 'bcrypt';

// 사용자 정보 확인 및 비밀번호 재설정
const checkUserPassword = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ 데이터베이스 연결 성공\n');

    const userId = process.argv[2] || 'ydi';
    
    // 사용자 정보 조회
    const [user] = await sequelize.query(`
      SELECT 
        id, 
        userid, 
        username, 
        email, 
        role, 
        status,
        password_hash,
        company_id,
        tenant_id
      FROM users 
      WHERE userid = :userId
    `, {
      replacements: { userId },
      type: QueryTypes.SELECT
    }) as any[];

    if (!user || user.length === 0) {
      console.log(`❌ 사용자 ID '${userId}'를 찾을 수 없습니다.`);
      return;
    }

    console.log('📋 사용자 정보:');
    console.log(`   ID: ${user.id}`);
    console.log(`   User ID: ${user.userid}`);
    console.log(`   이름: ${user.username}`);
    console.log(`   이메일: ${user.email}`);
    console.log(`   역할: ${user.role}`);
    console.log(`   상태: ${user.status}`);
    console.log(`   비밀번호 해시: ${user.password_hash}`);
    console.log('');

    // 비밀번호 해시 형식 확인
    if (user.password_hash.startsWith('$2b$') || user.password_hash.startsWith('$2a$')) {
      console.log('✅ 비밀번호는 bcrypt로 해시되어 있습니다 (안전함).');
      console.log('⚠️  bcrypt 해시는 원본을 확인할 수 없습니다.');
    } else {
      console.log('⚠️  비밀번호가 base64로 인코딩되어 있습니다 (보안 취약).');
      console.log('   bcrypt로 재해싱하는 것을 권장합니다.');
      try {
        const decoded = Buffer.from(user.password_hash, 'base64').toString();
        console.log(`🔓 디코딩된 비밀번호: ${decoded}`);
      } catch (e) {
        // 디코딩 실패
      }
    }
    console.log('');

    // 비밀번호 재설정 옵션
    const resetPassword = process.argv[3];
    if (resetPassword) {
      console.log(`🔄 비밀번호를 '${resetPassword}'로 재설정합니다...`);
      
      // bcrypt로 비밀번호 해싱
      const hashedPassword = await bcrypt.hash(resetPassword, 10);
      
      await sequelize.query(`
        UPDATE users 
        SET password_hash = :hashedPassword,
            updated_at = NOW()
        WHERE id = :userId
      `, {
        replacements: { 
          hashedPassword,
          userId: user.id
        },
        type: QueryTypes.UPDATE
      });

      console.log(`✅ 비밀번호가 성공적으로 재설정되었습니다.`);
      console.log(`   새 비밀번호: ${resetPassword}`);
    } else {
      console.log('💡 비밀번호를 재설정하려면 다음 명령을 사용하세요:');
      console.log(`   npx ts-node scripts/check-user-password.ts ${userId} <새비밀번호>`);
      console.log('');
      console.log('⚠️  보안상 비밀번호는 해시로 저장되어 있어 원본을 확인할 수 없습니다.');
      console.log('   비밀번호를 잊으셨다면 위 명령으로 재설정하세요.');
    }

  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
  } finally {
    await sequelize.close();
  }
};

checkUserPassword();

