# 3000 포트만 사용하도록 수정

## ✅ 수정 완료

3001, 3002 포트 사용을 제거하고 **3000 포트만** 사용하도록 설정을 변경했습니다.

---

## 🔧 수정된 파일

### 1. `daeheung-rt-one-api/env.development`
```diff
- CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:3002
+ CORS_ORIGIN=http://localhost:3000
```

### 2. `daeheung-rt-one-api/src/index.ts`
```diff
- return ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
+ return ['http://localhost:3000'];
```

### 3. `daeheung-rt-one-api/src/config/constants.ts`
```diff
- DEFAULT_CORS_ORIGIN: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
+ DEFAULT_CORS_ORIGIN: ['http://localhost:3000'],
```

---

## 🎯 현재 설정

### 프론트엔드
- **포트**: `3000` (고정)
- **설정**: `package.json`의 `start` 스크립트에 `PORT=3000` 설정됨

### 백엔드
- **포트**: `5000` (고정)
- **CORS**: `http://localhost:3000`만 허용

---

## 🔍 3001 포트 문제 해결

### 문제 원인
- 프론트엔드가 3001 포트에서 실행되고 있었음
- 이는 3000 포트가 사용 중이거나 React가 자동으로 포트를 변경했을 수 있음

### 해결 방법

**1. 3000 포트를 사용하는 프로세스 확인:**
```powershell
# Windows PowerShell
netstat -ano | findstr :3000
```

**2. 프로세스 종료 (필요한 경우):**
```powershell
# PID 확인 후
taskkill /PID <PID번호> /F
```

**3. 프론트엔드 재시작:**
```bash
cd daeheung-rt-one-web
npm start
```

**4. 백엔드 재시작 (CORS 설정 적용):**
```bash
cd daeheung-rt-one-api
npm run dev
```

---

## ✅ 확인 사항

### 프론트엔드
- [ ] `http://localhost:3000`에서 실행 중인지 확인
- [ ] 브라우저에서 `http://localhost:3000` 접속 가능한지 확인

### 백엔드
- [ ] `http://localhost:5000`에서 실행 중인지 확인
- [ ] CORS 설정이 `http://localhost:3000`만 허용하는지 확인

### 연결 확인
- [ ] 브라우저 Console에서 API URL이 `http://localhost:5000/api`인지 확인
- [ ] 로그인 시도 시 오류가 없는지 확인

---

## 💡 참고

**프론트엔드 포트 설정:**
- `daeheung-rt-one-web/package.json`의 `start` 스크립트: `set PORT=3000 && react-scripts start`
- 이 설정으로 프론트엔드는 항상 3000 포트에서 실행됩니다

**3000 포트가 사용 중인 경우:**
- React가 자동으로 3001로 변경하려고 할 수 있음
- 3000 포트를 사용하는 다른 프로세스를 종료해야 함

---

## 🎯 요약

- ✅ 3001, 3002 포트 사용 제거
- ✅ CORS 설정을 3000 포트만 허용하도록 변경
- ✅ 프론트엔드는 3000 포트에서만 실행
- ✅ 백엔드는 5000 포트에서 실행

**다음 단계:**
1. 3000 포트를 사용하는 프로세스 확인 및 종료
2. 프론트엔드 재시작
3. 백엔드 재시작
4. `http://localhost:3000`에서 접속 확인
