-- MVS 데이터베이스 비밀번호 변경 스크립트
-- 사용법: psql -U postgres -f change-db-password.sql

-- 기존 사용자 비밀번호 변경
ALTER USER mvs_user WITH PASSWORD 'Korean@2026';

-- 변경 확인
SELECT usename, passwd FROM pg_shadow WHERE usename = 'mvs_user';

-- 완료 메시지
\echo '✅ 데이터베이스 비밀번호가 Korean@2026으로 변경되었습니다.'
