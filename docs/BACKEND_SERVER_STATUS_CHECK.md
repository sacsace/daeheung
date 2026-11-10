# 백엔드 서버 상태 확인 및 로그

## 🔍 현재 상황

프론트엔드에서 `localhost:3001`로 연결하려고 하는데, 실제 백엔드는 `localhost:5000`에서 실행되어야 합니다.

---

## ✅ 백엔드 서버 확인 방법

### 1단계: 백엔드 서버 실행 확인

**터미널에서 확인:**
```bash
cd daeheung-rt-one-api
npm run dev
```

**예상 출력:**
```
🚀 MVS Backend Server running on 0.0.0.0:5000
📊 Health check: http://0.0.0.0:5000/health
🌐 API base URL: http://0.0.0.0:5000/api
```

---

### 2단계: 포트 사용 확인

**Windows PowerShell:**
```powershell
netstat -ano | findstr :5000
```

**예상 출력:**
```
TCP    0.0.0.0:5000           0.0.0.0:0              LISTENING       12345
```

---

### 3단계: 헬스체크 테스트

**브라우저에서:**
```
http://localhost:5000/health
```

**또는 PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/health" -UseBasicParsing
```

**예상 응답:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45
}
```

---

## 🔴 백엔드 서버가 실행되지 않는 경우

### 문제 1: 포트 5000이 이미 사용 중

**오류 메시지:**
```
❌ 서버 시작 실패: Error: listen EADDRINUSE: address already in use :::5000
⚠️  포트 5000이 이미 사용 중입니다.
```

**해결:**
```powershell
# 포트 5000을 사용하는 프로세스 확인
netstat -ano | findstr :5000

# PID 확인 후 프로세스 종료
taskkill /PID <PID번호> /F
```

---

### 문제 2: 데이터베이스 연결 실패

**오류 메시지:**
```
Database connection error: ...
```

**해결:**
1. PostgreSQL이 실행 중인지 확인
2. 데이터베이스 설정 확인 (`daeheung-rt-one-api/env.development`)
3. 데이터베이스 연결 정보 확인

---

### 문제 3: 환경 변수 문제

**확인:**
```powershell
cd daeheung-rt-one-api
Get-Content env.development
```

**필수 환경 변수:**
- `PORT=5000`
- `DB_HOST=localhost`
- `DB_NAME=mvs`
- `DB_USER=mvs_user`
- `DB_PASSWORD=Korean@2026`

---

## 🎯 백엔드 서버 시작 방법

### 방법 1: 개발 모드로 시작

```bash
cd daeheung-rt-one-api
npm run dev
```

**특징:**
- 파일 변경 시 자동 재시작 (nodemon)
- 상세한 로그 출력
- 개발 환경 설정 사용

---

### 방법 2: 프로덕션 모드로 시작

```bash
cd daeheung-rt-one-api
npm run build
npm start
```

**특징:**
- 빌드된 파일 사용
- 프로덕션 환경 설정 사용

---

## 📊 백엔드 로그 확인

### 실시간 로그 확인

**터미널에서:**
- 백엔드 서버를 실행한 터미널에서 로그 확인
- 요청이 들어올 때마다 로그 출력

---

### 로그 파일 확인

**파일 위치:**
```
daeheung-rt-one-api/server-log.txt
```

**최근 로그 확인:**
```powershell
Get-Content daeheung-rt-one-api/server-log.txt -Tail 50
```

---

## 🔧 백엔드 서버 디버깅

### 1. 서버 시작 로그 확인

**정상적인 경우:**
```
Environment PORT: undefined
Final PORT: 5000
Host: 0.0.0.0
🌐 HTTP server mode
🚀 MVS Backend Server running on 0.0.0.0:5000
```

**문제가 있는 경우:**
```
❌ 서버 시작 실패: ...
```

---

### 2. 데이터베이스 연결 확인

**정상적인 경우:**
```
✅ 데이터베이스 연결 성공
```

**문제가 있는 경우:**
```
❌ Database connection error: ...
```

---

### 3. API 요청 로그 확인

**정상적인 경우:**
```
POST /api/auth/login 200
```

**문제가 있는 경우:**
```
POST /api/auth/login 404
또는
POST /api/auth/login ERR_CONNECTION_REFUSED
```

---

## 🎯 체크리스트

### 백엔드 서버
- [ ] 백엔드 서버가 실행 중인지 확인
- [ ] 포트 5000이 사용 중인지 확인
- [ ] 헬스체크 엔드포인트 테스트
- [ ] 로그에서 오류 메시지 확인

### 데이터베이스
- [ ] PostgreSQL이 실행 중인지 확인
- [ ] 데이터베이스 연결 정보 확인
- [ ] 데이터베이스 연결 성공 메시지 확인

### 환경 변수
- [ ] `env.development` 파일 확인
- [ ] 필수 환경 변수 설정 확인
- [ ] 포트 설정 확인 (5000)

---

## 💡 요약

**백엔드 오류의 주요 원인:**
1. 백엔드 서버가 실행되지 않음
2. 포트 5000이 이미 사용 중
3. 데이터베이스 연결 실패
4. 환경 변수 설정 문제

**확인 방법:**
1. 백엔드 서버 실행 확인
2. 포트 5000 사용 확인
3. 헬스체크 테스트
4. 로그 확인

**해결:**
1. 백엔드 서버 시작 (`npm run dev`)
2. 포트 충돌 해결
3. 데이터베이스 연결 확인
4. 환경 변수 설정 확인
