# 환경 변수가 로드되지 않는 문제 해결

## 🔴 문제

Console에서 API URL이 `http://localhost:3001`로 표시됨
- `.env.development` 파일은 존재하고 올바르게 설정됨
- `REACT_APP_API_URL=http://localhost:5000/api` 설정됨
- 하지만 환경 변수가 로드되지 않음

---

## 🔍 원인

### React 환경 변수 로드 규칙

React는 다음 파일들을 **자동으로** 로드합니다:
1. `.env` - 모든 환경
2. `.env.local` - 모든 환경 (git에 커밋하지 않음)
3. `.env.development` - 개발 환경만
4. `.env.development.local` - 개발 환경만 (git에 커밋하지 않음)

**중요:**
- 파일 이름은 **반드시 `.env`로 시작**해야 함
- `env.development`는 인식하지 않음
- 서버를 **재시작**해야 환경 변수가 로드됨

---

## ✅ 해결 방법

### 방법 1: 프론트엔드 서버 완전 재시작

**1단계: 서버 중지**
- 터미널에서 `Ctrl + C`로 서버 중지

**2단계: 서버 재시작**
```bash
cd daeheung-rt-one-web
npm start
```

**3단계: 브라우저 새로고침**
- `Ctrl + Shift + R` (완전 새로고침)

---

### 방법 2: 환경 변수 파일 확인

**확인:**
```powershell
cd daeheung-rt-one-web
# 파일 이름 확인
Get-ChildItem .env*

# 파일 내용 확인
Get-Content .env.development | Select-String "REACT_APP_API_URL"
```

**예상 출력:**
```
REACT_APP_API_URL=http://localhost:5000/api
```

---

### 방법 3: 브라우저 Console에서 확인

**브라우저 개발자 도구 (F12) → Console 탭:**

다음 메시지가 나와야 합니다:
```javascript
🔧 환경 변수에서 API URL 사용: http://localhost:5000/api
```

**만약 이 메시지가 없다면:**
```javascript
REACT_APP_API_URL: (not set)
📍 현재 위치: { protocol: 'http:', hostname: 'localhost', port: '3000' }
🌍 도메인 감지, API URL: http://localhost:3001/api  // ❌ 문제
```

---

## 🎯 현재 상황 분석

### Console 로그 분석

**보이는 것:**
- API Base URL: `http://localhost:3001` ❌
- Window location: `http://localhost:3000/login` ✅
- Port: `3000` ✅

**의미:**
- 환경 변수가 로드되지 않음
- 코드가 도메인 기반 로직으로 넘어감
- `window.location.port`가 `3000`인데 API URL이 `3001`인 것은 이상함

**가능한 원인:**
1. 이전에 빌드된 번들이 캐시되어 있음
2. 환경 변수가 빌드 시점에 포함되지 않음
3. 브라우저가 이전 JavaScript를 사용 중

---

## 🔧 즉시 해결 단계

### 1단계: 프론트엔드 서버 중지 및 재시작

```bash
# 터미널에서 Ctrl+C로 서버 중지
# 그 다음
cd daeheung-rt-one-web
npm start
```

### 2단계: 브라우저 캐시 삭제

**방법 A: 완전 새로고침**
- `Ctrl + Shift + R` 또는 `Ctrl + F5`

**방법 B: 개발자 도구 사용**
1. F12로 개발자 도구 열기
2. Network 탭 클릭
3. "Disable cache" 체크
4. 페이지 새로고침

**방법 C: 브라우저 캐시 삭제**
1. Chrome 설정 → 개인정보 및 보안 → 인터넷 사용 기록 삭제
2. "캐시된 이미지 및 파일" 선택
3. 삭제

### 3단계: Console에서 확인

**브라우저 개발자 도구 (F12) → Console 탭:**

다음 메시지 확인:
```javascript
=== API Configuration ===
API Base URL: http://localhost:5000/api  // ✅ 정상
REACT_APP_API_URL: http://localhost:5000/api  // ✅ 정상
🔧 환경 변수에서 API URL 사용: http://localhost:5000/api  // ✅ 정상
```

---

## 🚨 중요 사항

### React 환경 변수 동작 방식

1. **빌드 시점에 번들에 포함됨**
   - 환경 변수는 JavaScript 번들에 포함됨
   - 런타임에 변경할 수 없음
   - 서버를 재시작해야 새 환경 변수가 반영됨

2. **파일 이름 규칙**
   - `.env.development` ✅ (인식됨)
   - `env.development` ❌ (인식 안 됨)

3. **변수 이름 규칙**
   - `REACT_APP_` 접두사 필수
   - `REACT_APP_API_URL` ✅
   - `API_URL` ❌ (무시됨)

---

## 📋 체크리스트

### 환경 변수 파일
- [ ] `.env.development` 파일이 존재하는지 확인
- [ ] 파일 이름이 `.env`로 시작하는지 확인
- [ ] `REACT_APP_API_URL=http://localhost:5000/api` 설정 확인

### 서버 재시작
- [ ] 프론트엔드 서버를 완전히 중지
- [ ] 프론트엔드 서버를 재시작
- [ ] 서버가 정상적으로 시작되었는지 확인

### 브라우저
- [ ] 브라우저 완전 새로고침 (Ctrl+Shift+R)
- [ ] 개발자 도구 Console에서 환경 변수 확인
- [ ] API URL이 `http://localhost:5000/api`인지 확인

---

## 💡 요약

**문제:**
- 환경 변수가 로드되지 않아서 API URL이 `localhost:3001`로 설정됨

**원인:**
- React가 환경 변수를 빌드 시점에 번들에 포함
- 서버를 재시작하지 않으면 새 환경 변수가 반영되지 않음
- 브라우저 캐시가 이전 번들을 사용 중일 수 있음

**해결:**
1. 프론트엔드 서버 완전 재시작
2. 브라우저 완전 새로고침 (Ctrl+Shift+R)
3. Console에서 환경 변수 확인

**확인:**
- Console에 `🔧 환경 변수에서 API URL 사용: http://localhost:5000/api` 메시지가 나와야 함
