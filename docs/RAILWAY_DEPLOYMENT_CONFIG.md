# Railway 배포 설정

## 🚂 Railway 서비스 구성

### 1. 백엔드 서비스 (API)
- **서비스명**: `mvs-backend`
- **Root Directory**: `daeheung-rt-one-api`
- **도메인**: `api.mvsystem.in`
- **포트**: Railway 자동 할당
- **환경변수**: `env.railway` 파일 사용

### 2. 프론트엔드 서비스 (Web)
- **서비스명**: `mvs-frontend`  
- **Root Directory**: `daeheung-rt-one-web`
- **도메인**: `www.mvsystem.in`
- **포트**: Railway 자동 할당
- **환경변수**: `env.railway` 파일 사용

### 3. 데이터베이스 서비스
- **PostgreSQL**: Railway PostgreSQL 서비스
- **Redis**: Railway Redis 서비스 (선택사항)

## 🔧 Railway 환경변수 설정

### 백엔드 환경변수
```bash
NODE_ENV=production
PORT=$PORT
HOST=0.0.0.0
DATABASE_URL=$DATABASE_URL
JWT_SECRET=[생성된 시크릿 키]
CORS_ORIGIN=https://www.mvsystem.in
```

### 프론트엔드 환경변수
```bash
REACT_APP_API_URL=https://api.mvsystem.in/api
REACT_APP_WS_URL=wss://api.mvsystem.in
REACT_APP_ENVIRONMENT=production
```

## 🌐 도메인 설정

### 1. DNS 설정
```
Type: CNAME
Name: www
Value: [Railway 제공 값]
TTL: 300

Type: CNAME  
Name: api
Value: [Railway 제공 값]
TTL: 300
```

### 2. Railway 도메인 연결
1. Railway 대시보드 → Settings → Domains
2. `www.mvsystem.in` 추가
3. `api.mvsystem.in` 추가
4. DNS 레코드 확인

## 🔒 SSL 인증서

- **자동 발급**: Railway가 Let's Encrypt로 자동 발급
- **자동 갱신**: 인증서 만료 시 자동 갱신
- **수동 설정 불필요**: 코드에서 SSL 관련 설정 제거됨

## 📋 배포 체크리스트

- [ ] Railway 프로젝트 생성
- [ ] PostgreSQL 서비스 추가
- [ ] 백엔드 서비스 배포
- [ ] 프론트엔드 서비스 배포
- [ ] 커스텀 도메인 연결
- [ ] DNS 설정 완료
- [ ] SSL 인증서 발급 확인
- [ ] 전체 애플리케이션 테스트
