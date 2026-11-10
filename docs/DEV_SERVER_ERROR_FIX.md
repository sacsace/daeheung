# 개발 서버 오류 해결 가이드

## 🔴 문제: `localhost:3001`로 연결 시도

**에러 메시지:**
```
네트워크 오류: 백엔드 서버 (http://localhost:3001)에 연결할 수 없습니다.
```

---

## 🔍 원인 분석

### 현재 설정 확인

**프론트엔드 포트 설정 (`daeheung-rt-one-web/package.json`):**
```json
"start": "set PORT=3000 && react-scripts start"
```

**환경 변수 설정 (`daeheung-rt-one-web/env.development`):**
```bash
REACT_APP_API_URL=http://localhost:5000/api
```

**API URL 로직 (`daeheung-rt-one-web/src/services/api.ts`):**
- localhost인 경우: `http://localhost:5000/api` ✅

---

## 🎯 가능한 원인

### 원인 1: 프론트엔드가 3001 포트에서 실행 중

**상황:**
- `PORT=3000`으로 설정했지만 3000 포트가 이미 사용 중
- React가 자동으로 3001 포트로 변경
- 프론트엔드가 `localhost:3001`에서 실행됨

**확인 방법:**
1. 터미널에서 프론트엔드 시작 메시지 확인
   ```
   Compiled successfully!
   
   You can now view daeheung-rt-one-web in the browser.
   
     Local:            http://localhost:3001
     On Your Network:  http://192.168.0.109:3001
   ```

2. 브라우저 주소창 확인
   - `http://localhost:3001`로 접속되어 있는지 확인

**해결 방법:**
- 코드는 이미 localhost인 경우 5000 포트를 사용하도록 되어 있음
- 하지만 환경 변수가 제대로 로드되지 않았을 수 있음

---

### 원인 2: 환경 변수가 로드되지 않음

**상황:**
- `env.development` 파일이 있지만 React가 인식하지 못함
- React는 `.env`, `.env.local`, `.env.development.local` 파일만 자동 로드
- `env.development`는 커스텀 파일명이므로 자동 로드되지 않음

**확인 방법:**
1. 브라우저 개발자 도구 (F12) → Console 탭
2. 다음 메시지 확인:
   ```
   REACT_APP_API_URL: (not set)
   ```
   또는
   ```
   REACT_APP_API_URL: http://localhost:5000/api
   ```

**해결 방법:**
- `.env.development` 파일로 이름 변경 또는
- `.env` 파일 생성

---

### 원인 3: 백엔드 서버가 실행되지 않음

**상황:**
- 프론트엔드는 정상 작동하지만 백엔드가 실행되지 않음
- API 호출이 실패하여 에러 메시지 표시

**확인 방법:**
1. 백엔드 서버가 실행 중인지 확인
2. `http://localhost:5000/health` 접속 테스트
3. 터미널에서 백엔드 로그 확인

---

## ✅ 해결 방법

### 방법 1: 환경 변수 파일 이름 변경 (권장)

**현재:**
- `daeheung-rt-one-web/env.development` ❌ (React가 인식하지 못함)

**변경:**
- `daeheung-rt-one-web/.env.development` ✅ (React가 자동 로드)

**단계:**
1. `daeheung-rt-one-web/env.development` 파일을 `.env.development`로 이름 변경
2. 프론트엔드 서버 재시작
3. 브라우저에서 확인

---

### 방법 2: .env 파일 생성

**단계:**
1. `daeheung-rt-one-web/.env` 파일 생성
2. 다음 내용 추가:
   ```bash
   REACT_APP_API_URL=http://localhost:5000/api
   REACT_APP_WS_URL=ws://localhost:5000
   ```
3. 프론트엔드 서버 재시작

---

### 방법 3: 백엔드 서버 확인

**단계:**
1. 백엔드 서버가 실행 중인지 확인
   ```bash
   cd daeheung-rt-one-api
   npm run dev
   ```

2. 백엔드가 5000 포트에서 실행 중인지 확인
   - 터미널 메시지: `Server is running on port 5000`

3. 헬스체크 테스트
   - 브라우저에서 `http://localhost:5000/health` 접속
   - `{"status":"ok"}` 응답 확인

---

## 🔧 즉시 확인 사항

### 1. 프론트엔드 포트 확인

**터미널에서:**
```bash
cd daeheung-rt-one-web
npm start
```

**확인:**
- 어떤 포트에서 실행되는지 확인
- `Local: http://localhost:3000` 또는 `http://localhost:3001`

---

### 2. 환경 변수 로드 확인

**브라우저 개발자 도구 (F12) → Console 탭:**
```javascript
// 다음 메시지 확인:
REACT_APP_API_URL: http://localhost:5000/api  // ✅ 정상
또는
REACT_APP_API_URL: (not set)  // ❌ 문제
```

---

### 3. API URL 결정 확인

**브라우저 개발자 도구 (F12) → Console 탭:**
```javascript
// 다음 메시지 확인:
🏠 localhost 감지, API URL: http://localhost:5000/api  // ✅ 정상
또는
🌍 도메인 감지, API URL: http://localhost:3001/api  // ❌ 문제
```

---

## 📋 체크리스트

### 환경 변수 설정
- [ ] `daeheung-rt-one-web/.env.development` 파일 존재 확인
- [ ] `REACT_APP_API_URL=http://localhost:5000/api` 설정 확인
- [ ] 프론트엔드 서버 재시작

### 백엔드 서버
- [ ] 백엔드 서버가 실행 중인지 확인
- [ ] 백엔드가 5000 포트에서 실행 중인지 확인
- [ ] `http://localhost:5000/health` 접속 테스트

### 프론트엔드
- [ ] 프론트엔드가 실행 중인지 확인
- [ ] 브라우저 Console에서 환경 변수 확인
- [ ] 브라우저 Console에서 API URL 확인

---

## 🎯 빠른 해결

### 1단계: 환경 변수 파일 이름 변경

```bash
cd daeheung-rt-one-web
# Windows PowerShell
Rename-Item env.development .env.development

# 또는 수동으로 파일 이름 변경
```

### 2단계: 프론트엔드 재시작

```bash
# 프론트엔드 서버 중지 (Ctrl+C)
# 다시 시작
npm start
```

### 3단계: 브라우저에서 확인

1. 브라우저 개발자 도구 (F12) → Console 탭
2. 다음 메시지 확인:
   ```
   🔧 환경 변수에서 API URL 사용: http://localhost:5000/api
   ```
   또는
   ```
   🏠 localhost 감지, API URL: http://localhost:5000/api
   ```

---

## 💡 요약

**문제:**
- 프론트엔드가 `localhost:3001`로 API 호출
- 환경 변수가 로드되지 않았을 가능성

**해결:**
1. `env.development` → `.env.development` 파일 이름 변경
2. 프론트엔드 서버 재시작
3. 브라우저 Console에서 확인

**확인:**
- 백엔드 서버가 5000 포트에서 실행 중인지
- 환경 변수가 제대로 로드되었는지
- API URL이 올바르게 결정되었는지
