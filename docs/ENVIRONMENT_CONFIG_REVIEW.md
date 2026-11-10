# 환경 설정 검토 결과

## 🔍 현재 환경 설정 상태

### 프론트엔드 API URL 설정 (`daeheung-rt-one-web/src/services/api.ts`)

**코드 로직:**
1. **환경 변수 우선** (`REACT_APP_API_URL`)
2. **IP 주소인 경우**: `http://${hostname}:5000/api`
3. **localhost인 경우**: `http://localhost:5000/api`
4. **도메인인 경우**: `${protocol}//${hostname}${apiPort}/api` ⚠️ **문제 발견!**

---

## 🔴 문제 발견: 도메인인 경우 프론트엔드 포트 사용

**문제 코드 (42-45번째 줄):**
```typescript
// 프로덕션 환경 (도메인인 경우)
// 같은 호스트의 /api 경로 사용 (프론트엔드와 백엔드가 같은 도메인)
const apiPort = port ? `:${port}` : '';
const apiUrl = `${protocol}//${hostname}${apiPort}/api`;
```

**의미:**
- Railway에서 프론트엔드가 `https://mvs-frontend.railway.app:3001` (또는 다른 포트)로 실행되면
- `window.location.port`가 `3001`이 됨
- API URL이 `https://mvs-frontend.railway.app:3001/api`가 됨
- 하지만 백엔드는 별도 서비스이므로 이 URL은 작동하지 않음

---

## 📊 환경 변수 파일 확인

### 프론트엔드 (`daeheung-rt-one-web/env.development`)
```bash
REACT_APP_API_URL=http://localhost:5000/api
```

### 프론트엔드 (`daeheung-rt-one-web/env.railway`)
```bash
REACT_APP_API_URL=https://api.mvsystem.in/api
```

### 백엔드 (`daeheung-rt-one-api/env.development`)
```bash
PORT=5000
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:3002
```

### 백엔드 (`daeheung-rt-one-api/env.railway`)
```bash
PORT=$PORT  # Railway가 자동 설정
CORS_ORIGIN=https://www.mvsystem.in
```

---

## 🎯 왜 `localhost:3001`이 표시되는가?

### 시나리오 1: Railway 배포 환경

1. **프론트엔드가 Railway에서 실행 중**
   - URL: `https://mvs-frontend.railway.app` (또는 다른 포트)
   - `window.location.port`가 `3001` 또는 다른 값

2. **코드 실행 흐름:**
   - `REACT_APP_API_URL` 환경 변수가 설정되지 않음 (빌드 시점)
   - `hostname`이 도메인 (localhost가 아님)
   - `window.location.port`가 `3001`
   - API URL: `https://mvs-frontend.railway.app:3001/api` ❌

3. **결과:**
   - 프론트엔드가 자신의 포트로 API를 호출
   - 백엔드는 별도 서비스이므로 연결 실패
   - 에러: "백엔드 서버 (http://localhost:3001)에 연결할 수 없습니다"

---

### 시나리오 2: 로컬 개발 환경

1. **프론트엔드가 `localhost:3001`에서 실행 중**
   - `window.location.hostname` = `localhost`
   - `window.location.port` = `3001`

2. **코드 실행 흐름:**
   - `hostname === 'localhost'` 조건 충족
   - API URL: `http://localhost:5000/api` ✅

3. **결과:**
   - 정상 작동 (localhost는 항상 5000 포트 사용)

---

## ✅ 해결 방법

### 방법 1: 환경 변수 설정 (권장)

**Railway 대시보드에서:**
1. **mvs-frontend** 서비스 선택
2. **Variables** 탭 클릭
3. **New Variable** 클릭
4. 다음 설정:
   ```
   Name: REACT_APP_API_URL
   Value: https://mvs-backend-production.up.railway.app/api
   ```
   (실제 백엔드 URL로 변경)
5. **Save** 클릭
6. **재배포**

**결과:**
- 빌드 시점에 `REACT_APP_API_URL`이 번들에 포함됨
- 코드의 첫 번째 조건 (`process.env.REACT_APP_API_URL`)이 true가 됨
- 도메인 기반 로직을 건너뛰고 환경 변수 값 사용

---

### 방법 2: 코드 수정 (도메인 로직 개선)

**현재 문제:**
- 도메인인 경우 프론트엔드 포트를 사용
- Railway에서는 프론트엔드와 백엔드가 별도 서비스

**수정 방안:**
```typescript
// 프로덕션 환경 (도메인인 경우)
// Railway에서는 프론트엔드와 백엔드가 별도 서비스이므로
// 환경 변수 사용 필수 또는 백엔드 도메인 추론
if (hostname.includes('railway.app') || hostname.includes('railway.com')) {
  // Railway 환경에서는 환경 변수 필수
  console.error('⚠️ Railway 환경에서는 REACT_APP_API_URL 환경 변수가 필수입니다.');
  return 'http://localhost:5000/api'; // 기본값 (작동하지 않음)
}
// 같은 호스트의 /api 경로 사용 (프론트엔드와 백엔드가 같은 도메인)
const apiPort = port ? `:${port}` : '';
const apiUrl = `${protocol}//${hostname}${apiPort}/api`;
```

**하지만 이 방법은 권장하지 않음:**
- 환경 변수 설정이 더 명확하고 안전함
- 코드 수정 없이 해결 가능

---

## 📋 현재 설정 요약

### 백엔드 포트
- **개발**: `5000` (고정)
- **Railway**: `$PORT` (Railway가 자동 설정, 보통 5000 또는 다른 값)

### 프론트엔드 API URL
- **개발**: `http://localhost:5000/api` (고정)
- **Railway**: 환경 변수 필요 (`REACT_APP_API_URL`)

### 문제점
- ❌ Railway에서 `REACT_APP_API_URL` 환경 변수가 설정되지 않음
- ❌ 도메인 기반 로직이 프론트엔드 포트를 사용
- ❌ 프론트엔드가 `localhost:3001` 또는 자신의 포트로 API 호출

---

## 🎯 해결 체크리스트

### 즉시 해결 (필수)
- [ ] Railway 대시보드에서 백엔드 URL 확인
- [ ] 프론트엔드에 `REACT_APP_API_URL` 환경 변수 추가
- [ ] 재배포
- [ ] 브라우저에서 확인

### 확인 사항
- [ ] 백엔드 서비스가 "Online" 상태인지
- [ ] 백엔드 URL이 올바른지
- [ ] CORS 설정이 올바른지

---

## 💡 요약

**왜 `localhost:3001`이 표시되는가?**
1. Railway에서 `REACT_APP_API_URL` 환경 변수가 설정되지 않음
2. 코드가 도메인 기반 로직을 사용
3. `window.location.port`가 `3001` (또는 다른 값)
4. API URL이 `https://mvs-frontend.railway.app:3001/api`가 됨
5. 백엔드는 별도 서비스이므로 연결 실패

**해결:**
- Railway 대시보드에서 `REACT_APP_API_URL` 환경 변수 설정
- 재배포
- 확인
