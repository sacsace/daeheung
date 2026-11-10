# 프론트엔드 크래시 원인 분석

## 🔴 현재 상태

**문제:**
- mvs-frontend 서비스가 "Crashed in 1 second" 상태
- 1초 만에 크래시되었다는 것은 서비스가 시작되자마자 즉시 종료되었다는 의미

---

## 🔍 1초 만에 크래시되는 일반적인 원인

### 1. 빌드 폴더 없음 (가장 가능성 높음)

**문제:**
- `build` 폴더가 생성되지 않았음
- `npx serve -s build` 명령이 `build` 폴더를 찾지 못해 즉시 종료

**확인 방법:**
Railway 로그에서:
```
Error: ENOENT: no such file or directory, open 'build/index.html'
```

**원인:**
- 빌드가 실패했거나
- 빌드가 실행되지 않았거나
- 빌드 폴더가 다른 위치에 생성됨

---

### 2. 빌드 실패

**문제:**
- `npm run build`가 실패
- ESLint 경고가 오류로 처리되어 빌드 실패
- TypeScript 컴파일 오류

**확인 방법:**
Railway 로그에서:
```
Failed to compile.
Treating warnings as errors because process.env.CI = true.
```

---

### 3. 시작 명령 오류

**문제:**
- `npm run start:railway` 명령이 실패
- `serve` 패키지가 없음
- 포트 바인딩 실패

**확인 방법:**
Railway 로그에서:
```
Error: Cannot find module 'serve'
Error: listen EADDRINUSE: address already in use
```

---

### 4. 의존성 문제

**문제:**
- `npm ci`가 실패
- 필수 패키지가 설치되지 않음

**확인 방법:**
Railway 로그에서:
```
npm ERR! code ERESOLVE
npm ERR! Cannot find module
```

---

## 🔧 확인 방법

### Railway 배포 로그 확인 (가장 중요!)

1. Railway 대시보드 → **mvs-frontend** 서비스
2. **Deployments** 탭 클릭
3. 최신 배포 (CRASHED 상태) 클릭
4. **"View Logs"** 또는 **"Logs"** 클릭
5. 다음을 확인:

#### 빌드 단계 로그 확인
```
[phases.build]
✅ "Compiled successfully!" 메시지 확인
❌ "Failed to compile" 메시지 확인
❌ 에러 메시지 확인
```

#### 시작 단계 로그 확인
```
[start]
✅ "Serving!" 메시지 확인
❌ "Error: ENOENT" 메시지 확인
❌ "Cannot find module" 메시지 확인
```

---

## 🚨 일반적인 오류 메시지와 해결 방법

### 오류 1: 빌드 폴더 없음
```
Error: ENOENT: no such file or directory, open 'build/index.html'
```

**원인:**
- 빌드가 실패했거나 실행되지 않음

**해결:**
1. 빌드 로그 확인
2. 빌드가 성공했는지 확인
3. `build` 폴더가 생성되었는지 확인

---

### 오류 2: 빌드 실패 (CI=true)
```
Failed to compile.
Treating warnings as errors because process.env.CI = true.
```

**원인:**
- Railway가 자동으로 `CI=true` 설정
- ESLint 경고가 오류로 처리됨

**해결:**
- `CI=false` 환경 변수 확인
- 빌드 스크립트에서 `CI=false` 설정 확인

---

### 오류 3: serve 패키지 없음
```
Error: Cannot find module 'serve'
```

**원인:**
- `serve` 패키지가 설치되지 않음
- `npm ci`가 실패했을 수 있음

**해결:**
- `package.json`에 `serve` 패키지가 있는지 확인
- `npm ci` 로그 확인

---

### 오류 4: 포트 바인딩 실패
```
Error: listen EADDRINUSE: address already in use :::3000
```

**원인:**
- 포트가 이미 사용 중이거나
- `PORT` 환경 변수가 제대로 전달되지 않음

**해결:**
- `PORT` 환경 변수 확인
- 시작 명령에서 포트 설정 확인

---

## 🔍 단계별 진단

### 1단계: 배포 로그 확인
- Railway 대시보드 → mvs-frontend → Deployments → Logs
- 구체적인 오류 메시지 확인

### 2단계: 빌드 성공 여부 확인
- 로그에서 "Compiled successfully!" 메시지 확인
- 빌드 단계에서 에러가 없는지 확인

### 3단계: 시작 명령 확인
- 로그에서 "Serving!" 메시지 확인
- 시작 단계에서 에러가 없는지 확인

### 4단계: 환경 변수 확인
- `CI=false` 설정 확인
- `PORT` 환경 변수 확인
- `REACT_APP_API_URL` 설정 확인

---

## 💡 빠른 해결 방법

### 방법 1: Railway 로그 확인 후 문제 해결
1. Railway 로그에서 구체적인 오류 확인
2. 오류에 따라 수정
3. 재배포

### 방법 2: 빌드 확인
- 로컬에서 빌드 테스트:
  ```bash
  cd daeheung-rt-one-web
  npm run build
  ```
- `build` 폴더가 생성되는지 확인

### 방법 3: 시작 명령 테스트
- 로컬에서 시작 명령 테스트:
  ```bash
  cd daeheung-rt-one-web
  npm run build
  npm run start:railway
  ```
- 정상 작동하는지 확인

---

## 📝 체크리스트

### 배포 로그 확인
- [ ] Railway 배포 로그 확인
- [ ] 빌드 단계 로그 확인
- [ ] 시작 단계 로그 확인
- [ ] 구체적인 오류 메시지 확인

### 설정 확인
- [ ] `CI=false` 환경 변수 설정
- [ ] `PORT` 환경 변수 설정
- [ ] `REACT_APP_API_URL` 환경 변수 설정
- [ ] `package.json`의 `start:railway` 스크립트 확인

### 빌드 확인
- [ ] 빌드가 성공했는지 확인
- [ ] `build` 폴더가 생성되었는지 확인
- [ ] ESLint 경고가 오류로 처리되지 않는지 확인

---

## 🎯 다음 단계

1. **Railway 배포 로그 확인** (가장 중요!)
   - 구체적인 오류 메시지 확인
   - 어느 단계에서 실패했는지 확인

2. **오류에 따라 수정**
   - 빌드 실패 → 빌드 설정 수정
   - 빌드 폴더 없음 → 빌드 명령 확인
   - 시작 실패 → 시작 명령 확인

3. **재배포**
   - 수정 후 자동 재배포 또는 수동 재배포
   - 로그에서 성공 메시지 확인

---

## 💬 로그 확인 후 알려주세요

Railway 배포 로그를 확인한 후, 구체적인 오류 메시지를 알려주시면 정확한 해결 방법을 제시할 수 있습니다.

특히 다음을 확인해주세요:
- 빌드 단계에서 어떤 메시지가 나오는지
- 시작 단계에서 어떤 오류가 나오는지
- 마지막 오류 메시지가 무엇인지
