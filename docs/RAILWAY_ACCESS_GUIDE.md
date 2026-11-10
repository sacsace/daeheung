# Railway 배포 후 접속 가이드

## 🌐 접속 방법

### 1단계: Railway 대시보드에서 URL 확인

#### 프론트엔드 URL 확인
1. Railway 대시보드 접속: https://railway.app
2. **daeheung-rt-one** 프로젝트 선택
3. **mvs-frontend** 서비스 클릭
4. **Settings** 탭 클릭
5. **"Generate Domain"** 버튼 클릭 (도메인이 없다면)
   - 또는 기존 도메인 확인
   - 예: `https://mvs-frontend-production.up.railway.app`

#### 백엔드 URL 확인
1. Railway 대시보드 → **mvs-backend** 서비스 클릭
2. **Settings** 탭 클릭
3. **"Generate Domain"** 버튼 클릭 (도메인이 없다면)
   - 또는 기존 도메인 확인
   - 예: `https://mvs-backend-production.up.railway.app`

---

## 🔍 접속 및 확인 방법

### 1. 프론트엔드 접속

**브라우저에서 접속:**
```
https://your-frontend-url.railway.app
```

**확인 사항:**
- ✅ 페이지가 로드되는지 확인
- ✅ 로그인 페이지가 표시되는지 확인
- ✅ 에러 메시지가 없는지 확인

**문제가 있다면:**
- 브라우저 개발자 도구 (F12) → Console 탭에서 오류 확인
- Network 탭에서 API 호출 확인

---

### 2. 백엔드 헬스체크

**브라우저에서 접속:**
```
https://your-backend-url.railway.app/health
```

**예상 응답:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "memory": {...},
  "environment": "production"
}
```

**확인 사항:**
- ✅ `status: "ok"` 응답 확인
- ✅ 타임스탬프가 최신인지 확인
- ✅ 에러 메시지가 없는지 확인

---

### 3. API 엔드포인트 확인

**API 헬스체크:**
```
https://your-backend-url.railway.app/api/health
```

**예상 응답:**
```json
{
  "status": "ok",
  "message": "API is healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## 🧪 기능 테스트

### 1. 프론트엔드-백엔드 연결 테스트

**브라우저 개발자 도구 사용:**
1. 프론트엔드 접속
2. F12 키로 개발자 도구 열기
3. **Network** 탭 선택
4. 페이지 새로고침 (F5)
5. API 호출 확인:
   - `https://your-backend-url.railway.app/api/...` 형태의 요청이 있는지 확인
   - 요청이 성공(200)하는지 확인
   - CORS 오류가 없는지 확인

**확인 사항:**
- ✅ API 호출이 올바른 백엔드 URL로 가는지
- ✅ 응답이 정상적으로 오는지 (200 OK)
- ✅ CORS 오류가 없는지

---

### 2. 로그인 기능 테스트

1. 프론트엔드 접속
2. 로그인 페이지 확인
3. 로그인 시도
4. 개발자 도구 → Network 탭에서 로그인 API 호출 확인

**확인 사항:**
- ✅ 로그인 API 호출이 성공하는지
- ✅ 토큰이 정상적으로 받아지는지
- ✅ 대시보드로 이동하는지

---

### 3. 데이터 조회 테스트

1. 로그인 후 대시보드 접속
2. 메뉴에서 데이터 조회 페이지 접속
3. 개발자 도구 → Network 탭에서 API 호출 확인

**확인 사항:**
- ✅ 데이터가 정상적으로 로드되는지
- ✅ API 응답이 정상인지
- ✅ 에러가 없는지

---

## 🚨 문제 해결

### 프론트엔드가 로드되지 않음

**확인 사항:**
1. Railway 대시보드에서 서비스 상태 확인
   - "Online" 상태인지 확인
   - "Crashed" 상태라면 로그 확인

2. 브라우저 콘솔 확인
   - F12 → Console 탭
   - 에러 메시지 확인

3. 네트워크 확인
   - F12 → Network 탭
   - 요청이 실패하는지 확인

---

### API 호출이 실패함

**확인 사항:**
1. 백엔드 헬스체크 확인
   - `/health` 엔드포인트가 정상인지

2. CORS 오류 확인
   - 브라우저 콘솔에서 CORS 관련 오류 확인
   - 백엔드 `CORS_ORIGIN` 환경 변수 확인

3. API URL 확인
   - 프론트엔드 `REACT_APP_API_URL` 환경 변수 확인
   - 올바른 백엔드 URL인지 확인

---

### 데이터베이스 연결 실패

**확인 사항:**
1. Postgres 서비스 상태 확인
   - Railway 대시보드에서 "Online" 상태인지

2. 백엔드 로그 확인
   - Railway 대시보드 → mvs-backend → Deployments → Logs
   - 데이터베이스 연결 오류 메시지 확인

3. 마이그레이션 실행 여부 확인
   - 테이블이 생성되었는지 확인

---

## 📱 접속 URL 요약

### 일반적인 Railway URL 형식

**프론트엔드:**
```
https://mvs-frontend-production.up.railway.app
```

**백엔드:**
```
https://mvs-backend-production.up.railway.app
```

**백엔드 헬스체크:**
```
https://mvs-backend-production.up.railway.app/health
```

**백엔드 API:**
```
https://mvs-backend-production.up.railway.app/api
```

---

## 🔗 빠른 접속 체크리스트

### 1. URL 확인
- [ ] Railway 대시보드에서 프론트엔드 URL 확인
- [ ] Railway 대시보드에서 백엔드 URL 확인

### 2. 프론트엔드 접속
- [ ] 브라우저에서 프론트엔드 URL 접속
- [ ] 페이지가 정상적으로 로드되는지 확인
- [ ] 에러 메시지가 없는지 확인

### 3. 백엔드 헬스체크
- [ ] 백엔드 `/health` 엔드포인트 접속
- [ ] `status: "ok"` 응답 확인

### 4. API 연결 확인
- [ ] 브라우저 개발자 도구 → Network 탭
- [ ] API 호출이 정상인지 확인
- [ ] CORS 오류가 없는지 확인

### 5. 기능 테스트
- [ ] 로그인 기능 테스트
- [ ] 데이터 조회 테스트
- [ ] 주요 기능 테스트

---

## 💡 팁

### Railway 대시보드에서 바로 접속
1. Railway 대시보드 → 서비스 선택
2. **Settings** 탭
3. 도메인 옆의 **"Open"** 버튼 클릭
4. 브라우저에서 자동으로 열림

### 커스텀 도메인 설정 (선택사항)
1. Railway 대시보드 → 서비스 → Settings
2. **"Custom Domain"** 추가
3. DNS 설정에서 CNAME 레코드 추가
4. SSL 인증서 자동 발급 (Railway가 처리)

---

## 🎯 다음 단계

접속이 성공하면:
1. ✅ 로그인 기능 테스트
2. ✅ 주요 기능 테스트
3. ✅ 데이터베이스 연결 확인
4. ✅ 성능 모니터링 설정

접속에 문제가 있다면:
1. Railway 로그 확인
2. 브라우저 콘솔 확인
3. 환경 변수 확인
4. 서비스 상태 확인
