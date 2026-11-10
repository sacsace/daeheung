# MVS Railway 배포 가이드

## 개요
MVS 프로젝트를 Railway 플랫폼에 배포하는 방법을 설명합니다.

## 배포 구조
- **Backend**: Node.js/Express API 서버
- **Frontend**: React 애플리케이션
- **Database**: PostgreSQL (Railway 제공)
- **Cache**: Redis (Railway 제공)

## 1. Railway 프로젝트 생성

### 1.1 Railway 계정 생성 및 로그인
1. [Railway.app](https://railway.app)에 접속
2. GitHub 계정으로 로그인
3. "New Project" 클릭

### 1.2 프로젝트 생성
1. "Deploy from GitHub repo" 선택
2. MVS 저장소 선택
3. 프로젝트 이름: `daeheung-rt-one`

## 2. 백엔드 배포

### 2.1 백엔드 서비스 생성
1. Railway 대시보드에서 "New Service" 클릭
2. "GitHub Repo" 선택
3. 저장소 선택 후 **Root Directory**를 `daeheung-rt-one-api`로 설정
4. 서비스 이름: `mvs-backend`

### 2.2 데이터베이스 연결
1. "Add Database" → "PostgreSQL" 선택
2. 데이터베이스 이름: `mvs-db`
3. 자동으로 `DATABASE_URL` 환경변수 생성됨

### 2.3 Redis 연결
1. "Add Database" → "Redis" 선택
2. Redis 이름: `mvs-redis`
3. 자동으로 `REDIS_URL` 환경변수 생성됨

### 2.4 환경변수 설정
Railway 대시보드의 Variables 탭에서 다음 환경변수들을 설정:

```bash
# 서버 설정
NODE_ENV=production
PORT=$PORT
HOST=0.0.0.0

# 데이터베이스 (자동 생성됨)
DATABASE_URL=$DATABASE_URL
PGDATABASE=$PGDATABASE
PGUSER=$PGUSER
PGPASSWORD=$PGPASSWORD

# Redis (자동 생성됨)
REDIS_URL=$REDIS_URL

# JWT 설정
JWT_SECRET=your-super-secret-jwt-key-here
SESSION_SECRET=your-super-secret-session-key-here

# CORS 설정
FRONTEND_URL=https://your-frontend-url.railway.app

# 이메일 설정 (선택사항)
SMTP_HOST=your-smtp-host
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
```

### 2.5 배포
1. "Deploy" 버튼 클릭
2. 빌드 로그 확인
3. 배포 완료 후 URL 확인

## 3. 프론트엔드 배포

### 3.1 프론트엔드 서비스 생성
1. Railway 대시보드에서 "New Service" 클릭
2. "GitHub Repo" 선택
3. 저장소 선택 후 **Root Directory**를 `daeheung-rt-one-web`로 설정
4. 서비스 이름: `mvs-frontend`

### 3.2 환경변수 설정
```bash
# API 설정
BACKEND_URL=https://your-backend-url.railway.app
BACKEND_WS_URL=wss://your-backend-url.railway.app

# 앱 설정
REACT_APP_NAME=MVS
REACT_APP_VERSION=3.0.0
REACT_APP_ENVIRONMENT=production

# 기능 플래그
REACT_APP_ENABLE_DEBUG=false
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_SENTRY=true

# 외부 서비스 (선택사항)
SENTRY_DSN=your-sentry-dsn
GA_TRACKING_ID=your-google-analytics-id
```

### 3.3 배포
1. "Deploy" 버튼 클릭
2. 빌드 로그 확인
3. 배포 완료 후 URL 확인

## 4. 도메인 설정 (선택사항)

### 4.1 커스텀 도메인 연결
1. Railway 대시보드에서 서비스 선택
2. "Settings" → "Domains" 탭
3. "Custom Domain" 추가
4. DNS 설정에서 CNAME 레코드 추가

### 4.2 SSL 인증서
- Railway에서 자동으로 Let's Encrypt SSL 인증서 제공
- HTTPS 자동 활성화

## 5. 모니터링 및 로그

### 5.1 로그 확인
1. Railway 대시보드에서 서비스 선택
2. "Deployments" 탭에서 로그 확인
3. 실시간 로그 스트리밍 가능

### 5.2 메트릭 모니터링
1. "Metrics" 탭에서 CPU, 메모리 사용량 확인
2. 응답 시간 및 에러율 모니터링

## 6. 환경변수 관리

### 6.1 보안
- 민감한 정보는 Railway의 환경변수로 관리
- `.env` 파일은 Git에 커밋하지 않음

### 6.2 환경별 설정
- 개발: `env.development`
- 프로덕션: `env.railway`

## 7. 트러블슈팅

### 7.1 일반적인 문제
1. **빌드 실패**: 로그에서 의존성 설치 오류 확인
2. **데이터베이스 연결 실패**: `DATABASE_URL` 환경변수 확인
3. **CORS 오류**: `CORS_ORIGIN` 설정 확인

### 7.2 로그 확인 방법
```bash
# Railway CLI 사용
railway logs --service mvs-backend
railway logs --service mvs-frontend
```

## 8. 자동 배포 설정

### 8.1 GitHub 연동
1. GitHub 저장소와 연결
2. `main` 브랜치에 푸시 시 자동 배포
3. Pull Request 생성 시 프리뷰 배포

### 8.2 배포 전략
- **Blue-Green 배포**: 무중단 배포
- **롤백**: 이전 버전으로 즉시 롤백 가능

## 9. 비용 최적화

### 9.1 리소스 관리
- 사용하지 않는 서비스 정지
- 적절한 인스턴스 크기 선택
- 데이터베이스 연결 풀 최적화

### 9.2 모니터링
- 월별 사용량 확인
- 비용 알림 설정

## 10. 보안 고려사항

### 10.1 환경변수 보안
- JWT 시크릿 키 강력하게 설정
- 데이터베이스 비밀번호 복잡하게 설정
- 정기적인 키 로테이션

### 10.2 네트워크 보안
- CORS 설정 적절히 구성
- Rate Limiting 활성화
- HTTPS 강제 사용

## 11. 백업 및 복구

### 11.1 데이터베이스 백업
- Railway에서 자동 백업 제공
- 수동 백업 스크립트 실행 가능

### 11.2 코드 백업
- GitHub에 모든 코드 저장
- 태그를 통한 버전 관리

## 12. 성능 최적화

### 12.1 프론트엔드 최적화
- 빌드 최적화 활성화
- CDN 사용 고려
- 이미지 최적화

### 12.2 백엔드 최적화
- 데이터베이스 쿼리 최적화
- 캐싱 전략 구현
- 로드 밸런싱 고려

이 가이드를 따라하면 MVS 애플리케이션을 Railway에 성공적으로 배포할 수 있습니다.
