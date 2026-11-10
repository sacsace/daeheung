# Railway 배포 후 체크리스트

## ✅ 현재 상태
- ✅ mvs-backend: Online
- ✅ mvs-frontend: Online  
- ⏳ Postgres: Building

## 🔧 필수 환경 변수 설정

### 백엔드 (mvs-backend) 환경 변수
Railway 대시보드 → mvs-backend → Variables에서 다음 변수들을 설정하세요:

```bash
# 필수 보안 설정
JWT_SECRET=<최소 32자 이상의 랜덤 문자열>
SESSION_SECRET=<최소 32자 이상의 랜덤 문자열>

# CORS 설정 (프론트엔드 URL)
CORS_ORIGIN=https://your-frontend-url.railway.app
# 또는 여러 도메인 허용
CORS_ORIGIN=https://your-frontend-url.railway.app,https://your-custom-domain.com

# 데이터베이스 (Railway가 자동 생성하지만 확인 필요)
DATABASE_URL=$DATABASE_URL  # PostgreSQL 서비스 연결 시 자동 생성
```

### 프론트엔드 (mvs-frontend) 환경 변수
Railway 대시보드 → mvs-frontend → Variables에서 다음 변수들을 설정하세요:

```bash
# API URL (백엔드 URL)
REACT_APP_API_URL=https://your-backend-url.railway.app/api

# 또는 Railway가 자동 생성한 백엔드 URL 사용
REACT_APP_API_URL=${{mvs-backend.RAILWAY_PUBLIC_DOMAIN}}/api
```

## 📊 데이터베이스 설정

### 1. 데이터베이스 마이그레이션 실행
Postgres 서비스가 완료되면 마이그레이션을 실행하세요:

```bash
# Railway CLI 사용
railway run --service mvs-backend npm run db:migrate

# 또는 Railway 대시보드에서 터미널 접속 후
cd daeheung-rt-one-api
npm run db:migrate
```

### 2. 초기 데이터 시딩 (선택사항)
```bash
railway run --service mvs-backend npm run db:seed
```

## 🔗 서비스 연결 확인

### 1. 백엔드 헬스체크
브라우저에서 다음 URL 접속:
```
https://your-backend-url.railway.app/health
```

예상 응답:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "memory": {...},
  "environment": "production"
}
```

### 2. 프론트엔드 접속
```
https://your-frontend-url.railway.app
```

### 3. API 연결 확인
프론트엔드에서 백엔드 API 호출이 정상적으로 작동하는지 확인:
- 로그인 기능 테스트
- 데이터 로드 테스트

## 🔒 보안 설정 확인

### 1. JWT_SECRET 생성
강력한 JWT_SECRET 생성:
```bash
# Node.js로 생성
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 또는 온라인 생성기 사용
# https://randomkeygen.com/
```

### 2. SESSION_SECRET 생성
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🌐 CORS 설정 확인

백엔드에서 프론트엔드 도메인을 허용했는지 확인:
- Railway 대시보드에서 프론트엔드 URL 확인
- 백엔드 `CORS_ORIGIN` 환경 변수에 추가

## 📝 로그 확인

### 1. 백엔드 로그
Railway 대시보드 → mvs-backend → Deployments → Logs

확인 사항:
- ✅ 데이터베이스 연결 성공
- ✅ 서버 시작 성공
- ❌ 에러 메시지 없음

### 2. 프론트엔드 로그
Railway 대시보드 → mvs-frontend → Deployments → Logs

확인 사항:
- ✅ 빌드 성공
- ✅ 정적 파일 서빙 시작

## 🧪 기능 테스트

### 필수 테스트 항목
- [ ] 로그인 기능
- [ ] 데이터 조회 (대시보드, 목록 등)
- [ ] 데이터 생성/수정/삭제
- [ ] 파일 업로드 (있는 경우)
- [ ] 실시간 기능 (Socket.IO, 있는 경우)

## 🚨 문제 해결

### 백엔드 연결 실패
1. `DATABASE_URL` 환경 변수 확인
2. PostgreSQL 서비스가 실행 중인지 확인
3. 데이터베이스 마이그레이션 실행 여부 확인

### 프론트엔드 API 호출 실패
1. `REACT_APP_API_URL` 환경 변수 확인
2. 백엔드 CORS 설정 확인
3. 브라우저 콘솔에서 에러 확인

### CORS 오류
1. 백엔드 `CORS_ORIGIN`에 프론트엔드 URL 추가
2. 백엔드 재배포

## 📈 모니터링 설정

### 1. Railway Metrics 확인
- CPU 사용량
- 메모리 사용량
- 네트워크 트래픽

### 2. 에러 알림 설정
Railway 대시보드에서 알림 설정 활성화

## 🎯 다음 단계

1. ✅ 모든 환경 변수 설정 완료
2. ✅ 데이터베이스 마이그레이션 실행
3. ✅ 헬스체크 통과
4. ✅ 기능 테스트 완료
5. ⏭️ 커스텀 도메인 설정 (선택사항)
6. ⏭️ SSL 인증서 확인 (Railway 자동 제공)
7. ⏭️ 백업 설정 확인

## 💡 추가 권장 사항

### 1. 커스텀 도메인 설정
- Railway 대시보드 → Settings → Domains
- DNS CNAME 레코드 추가

### 2. 환경 변수 백업
- 중요한 환경 변수는 별도로 문서화
- `.env.example` 파일 업데이트

### 3. 모니터링 도구 연동
- Sentry (에러 추적)
- Google Analytics (사용자 분석)
- 등등
