# API URL 문제 디버깅 가이드

## 🔍 현재 상황

- ✅ 프론트엔드가 `http://localhost:3000`에서 정상 실행 중
- ✅ `.env.development` 파일 존재하고 `REACT_APP_API_URL=http://localhost:5000/api` 설정됨
- ❌ 브라우저에서 여전히 `localhost:3001`로 연결 시도

---

## 🎯 문제 원인

### 가능한 원인들

1. **환경 변수가 빌드 시점에 로드되지 않음**
   - React는 빌드 시점에 환경 변수를 번들에 포함
   - 서버 재시작 후에도 이전 빌드가 사용될 수 있음

2. **브라우저 캐시 문제**
   - 이전 JavaScript 번들이 캐시되어 있음
   - 환경 변수가 포함된 새 번들을 로드하지 않음

3. **환경 변수 파일 이름 문제**
   - `.env.development` 파일이 제대로 인식되지 않음

---

## ✅ 해결 방법

### 방법 1: 브라우저 완전 새로고침 (가장 빠름)

**Windows/Linux:**
- `Ctrl + Shift + R` 또는 `Ctrl + F5`

**Mac:**
- `Cmd + Shift + R`

**또는:**
1. 브라우저 개발자 도구 (F12) 열기
2. Network 탭에서 "Disable cache" 체크
3. 페이지 새로고침

---

### 방법 2: 브라우저 Console에서 확인

**브라우저 개발자 도구 (F12) → Console 탭:**

다음 메시지들을 확인하세요:

```javascript
=== API Configuration ===
API Base URL: http://localhost:5000/api  // ✅ 정상
또는
API Base URL: http://localhost:3001/api  // ❌ 문제

REACT_APP_API_URL: http://localhost:5000/api  // ✅ 정상
또는
REACT_APP_API_URL: (not set)  // ❌ 문제

🔧 환경 변수에서 API URL 사용: http://localhost:5000/api  // ✅ 정상
또는
🌍 도메인 감지, API URL: http://localhost:3001/api  // ❌ 문제
```

---

### 방법 3: 프론트엔드 서버 완전 재시작

**1단계: 서버 중지**
- 터미널에서 `Ctrl + C`로 서버 중지

**2단계: 캐시 정리 (선택사항)**
```bash
cd daeheung-rt-one-web
# node_modules/.cache 삭제 (선택사항)
Remove-Item -Recurse -Force node_modules/.cache -ErrorAction SilentlyContinue
```

**3단계: 서버 재시작**
```bash
npm start
```

---

### 방법 4: 환경 변수 파일 확인

**확인:**
```powershell
cd daeheung-rt-one-web
Get-Content .env.development | Select-String "REACT_APP_API_URL"
```

**예상 출력:**
```
REACT_APP_API_URL=http://localhost:5000/api
```

**없다면:**
```powershell
# .env.development 파일 생성
@"
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_WS_URL=ws://localhost:5000
"@ | Out-File -FilePath .env.development -Encoding utf8
```

---

## 🔧 즉시 확인 사항

### 1. 브라우저 Console 확인

**브라우저 개발자 도구 (F12) → Console 탭:**

다음 명령어를 실행하세요:
```javascript
// API Base URL 확인
console.log('API Base URL:', window.location.origin);

// 환경 변수 확인 (개발 환경에서만)
console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
```

---

### 2. Network 탭 확인

**브라우저 개발자 도구 (F12) → Network 탭:**

1. 로그인 시도
2. 실패한 요청 확인
3. Request URL 확인:
   - ✅ `http://localhost:5000/api/auth/login` (정상)
   - ❌ `http://localhost:3001/api/auth/login` (문제)

---

### 3. 백엔드 서버 확인

**백엔드가 실행 중인지 확인:**
```bash
# 다른 터미널에서
cd daeheung-rt-one-api
npm run dev
```

**확인:**
- 백엔드가 `http://localhost:5000`에서 실행 중인지
- 터미널에 "Server is running on port 5000" 메시지가 있는지

---

## 🎯 빠른 해결 체크리스트

### 즉시 시도
- [ ] 브라우저 완전 새로고침 (Ctrl+Shift+R)
- [ ] 브라우저 Console에서 API URL 확인
- [ ] 백엔드 서버가 실행 중인지 확인

### 문제가 계속되면
- [ ] 프론트엔드 서버 완전 재시작
- [ ] 브라우저 캐시 삭제
- [ ] `.env.development` 파일 확인

---

## 💡 예상되는 Console 출력

### 정상적인 경우
```javascript
=== API Configuration ===
API Base URL: http://localhost:5000/api
Environment: development
REACT_APP_API_URL: http://localhost:5000/api
Window location: http://localhost:3000/login
Hostname: localhost
Port: 3000
Protocol: http:
========================
🔧 환경 변수에서 API URL 사용: http://localhost:5000/api
```

### 문제가 있는 경우
```javascript
=== API Configuration ===
API Base URL: http://localhost:3001/api
Environment: development
REACT_APP_API_URL: (not set)
Window location: http://localhost:3001/login
Hostname: localhost
Port: 3001
Protocol: http:
========================
🌍 도메인 감지, API URL: http://localhost:3001/api
```

---

## 🚨 중요

**에러 메시지의 `localhost:3001`은:**
- `API_BASE_URL` 변수의 값입니다
- 실제로 API를 호출하는 URL입니다
- 환경 변수가 로드되지 않아서 잘못된 URL이 설정된 것입니다

**해결:**
1. 브라우저 완전 새로고침
2. 프론트엔드 서버 재시작
3. 브라우저 Console에서 실제 API URL 확인
