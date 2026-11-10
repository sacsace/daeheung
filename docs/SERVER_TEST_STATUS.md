# 서버 시작 및 테스트 상태 리포트

**작성일**: 2025-01-XX

## 🚀 서버 시작

### 백엔드 서버 (daeheung-rt-one-api)
- **상태**: 백그라운드에서 실행 중
- **포트**: 5000 (기본값)
- **명령어**: `npm run dev`
- **환경**: 개발 모드 (nodemon 사용)

### 서버 확인 방법
```bash
# 서버 상태 확인
curl http://localhost:5000/health

# 또는 브라우저에서 접속
http://localhost:5000/health
```

## 🧪 테스트 실행

### 테스트 파일
- `src/controllers/__tests__/authController.test.ts` - 인증 컨트롤러 테스트

### 테스트 실행 명령어
```bash
# 모든 테스트 실행
npm test

# 특정 테스트 파일 실행
npx jest src/controllers/__tests__/authController.test.ts

# 커버리지 포함
npm run test:coverage

# Watch 모드
npm run test:watch
```

### 테스트 설정
- **프레임워크**: Jest
- **환경**: Node.js
- **타임아웃**: 10초
- **설정 파일**: `jest.config.js`
- **Setup 파일**: `src/__tests__/setup.ts`

## 📋 다음 단계

1. **서버 상태 확인**
   - 브라우저에서 `http://localhost:5000/health` 접속
   - 또는 `curl http://localhost:5000/health` 실행

2. **API 테스트**
   - `http://localhost:5000/api/health` - API 헬스체크
   - `http://localhost:5000/api/menus` - 메뉴 조회
   - `http://localhost:5000/api/company` - 회사 정보 조회

3. **데이터베이스 연결 확인**
   - 서버 로그에서 "Database connection successful" 메시지 확인
   - 데이터베이스 마이그레이션 실행 여부 확인

4. **테스트 실행**
   - `npm test` 명령어로 모든 테스트 실행
   - 테스트 결과 확인 및 실패한 테스트 수정

## ⚠️ 주의사항

1. **데이터베이스 연결**
   - `.env` 파일에 올바른 데이터베이스 설정이 있는지 확인
   - 데이터베이스가 실행 중인지 확인

2. **포트 충돌**
   - 포트 5000이 이미 사용 중인 경우 다른 포트 사용
   - `PORT` 환경 변수로 포트 변경 가능

3. **환경 변수**
   - `.env` 파일이 올바르게 설정되어 있는지 확인
   - `env.example` 파일 참조

## 🔧 문제 해결

### 서버가 시작되지 않는 경우
1. 포트 충돌 확인: `netstat -ano | findstr :5000`
2. 데이터베이스 연결 확인
3. 환경 변수 확인
4. 로그 확인

### 테스트가 실행되지 않는 경우
1. Jest 설치 확인: `npm list jest`
2. 테스트 파일 경로 확인
3. 설정 파일 확인: `jest.config.js`
4. TypeScript 컴파일 확인

