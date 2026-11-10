# 3001 포트 용도 설명

## 🔍 3001 포트 사용 현황

### 1. CORS 설정에서 사용 (백엔드)

**위치:**
- `daeheung-rt-one-api/env.development`
- `daeheung-rt-one-api/src/index.ts`
- `daeheung-rt-one-api/src/config/constants.ts`

**설정:**
```typescript
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:3002
```

**의미:**
- 백엔드가 여러 프론트엔드 포트에서 오는 요청을 허용
- 개발 환경에서 프론트엔드가 다른 포트에서 실행될 수 있음을 대비

---

## 🎯 3001 포트의 실제 용도

### 용도 1: 프론트엔드 개발 서버의 대체 포트

**상황:**
- React 개발 서버는 기본적으로 `3000` 포트 사용
- `3000` 포트가 이미 사용 중이면 자동으로 `3001`로 변경
- `3001`도 사용 중이면 `3002`로 변경

**예시:**
```bash
# 3000 포트가 사용 중일 때
npm start

# React가 자동으로 3001 포트 사용
Compiled successfully!

You can now view daeheung-rt-one-web in the browser.

  Local:            http://localhost:3001
  On Your Network:  http://192.168.0.109:3001
```

**이유:**
- 여러 React 앱을 동시에 개발할 때
- 다른 서비스가 3000 포트를 사용할 때
- 포트 충돌을 방지하기 위해

---

### 용도 2: CORS 허용 포트 (백엔드 설정)

**백엔드 CORS 설정:**
```typescript
// 개발 환경 기본값
return ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
```

**의미:**
- 백엔드가 이 포트들에서 오는 요청을 허용
- 프론트엔드가 어떤 포트에서 실행되든 API 호출 가능

**왜 필요한가?**
- 프론트엔드가 3000, 3001, 3002 중 어떤 포트에서든 실행 가능
- CORS 오류를 방지하기 위해 미리 허용

---

## 📊 포트 사용 현황 요약

| 포트 | 용도 | 서비스 |
|------|------|--------|
| **3000** | 프론트엔드 기본 포트 | React 개발 서버 |
| **3001** | 프론트엔드 대체 포트 | React 개발 서버 (3000 사용 중일 때) |
| **3002** | 프론트엔드 대체 포트 | React 개발 서버 (3000, 3001 사용 중일 때) |
| **5000** | 백엔드 포트 | Node.js/Express 서버 |

---

## 🔴 현재 오류와의 관계

### 오류 메시지
```
네트워크 오류: 백엔드 서버 (http://localhost:3001)에 연결할 수 없습니다.
```

### 문제 원인

**1. 프론트엔드가 3001 포트에서 실행 중**
- `3000` 포트가 사용 중이어서 React가 자동으로 `3001`로 변경
- 프론트엔드 URL: `http://localhost:3001`

**2. API URL 결정 로직 문제**
- 환경 변수가 로드되지 않아서 도메인 기반 로직 사용
- `window.location.port`가 `3001`
- API URL이 `http://localhost:3001/api`로 잘못 결정됨

**3. 올바른 동작**
- localhost인 경우 코드가 `http://localhost:5000/api`를 사용해야 함
- 하지만 환경 변수가 없어서 도메인 로직으로 넘어감

---

## ✅ 해결 방법

### 방법 1: 환경 변수 파일 확인

**확인:**
- `daeheung-rt-one-web/.env.development` 파일이 있는지
- `REACT_APP_API_URL=http://localhost:5000/api` 설정이 있는지

**재시작:**
```bash
# 프론트엔드 서버 재시작
cd daeheung-rt-one-web
npm start
```

---

### 방법 2: 브라우저 Console 확인

**브라우저 개발자 도구 (F12) → Console 탭:**
```javascript
// 다음 메시지 확인:
📍 현재 위치: { protocol: 'http:', hostname: 'localhost', port: '3001' }
🏠 localhost 감지, API URL: http://localhost:5000/api  // ✅ 정상
```

**문제가 있는 경우:**
```javascript
🌍 도메인 감지, API URL: http://localhost:3001/api  // ❌ 문제
```

---

## 💡 요약

**3001 포트의 용도:**
1. ✅ **프론트엔드 개발 서버의 대체 포트** (3000이 사용 중일 때)
2. ✅ **CORS 허용 포트** (백엔드가 여러 포트 허용)

**3001 포트는 백엔드 포트가 아님:**
- ❌ 백엔드는 **5000** 포트 사용
- ❌ 3001은 프론트엔드 포트

**현재 오류:**
- 프론트엔드가 3001 포트에서 실행 중
- API URL이 잘못 결정되어 `localhost:3001/api`로 호출
- 올바른 API URL: `localhost:5000/api`

**해결:**
- `.env.development` 파일 확인
- 프론트엔드 서버 재시작
- 브라우저 Console에서 API URL 확인
