# Railway A1 경고 해결 가이드

## 🔍 A1 경고 의미

**Railway에서 "A1" 경고:**
- **A** = Application-level warning (애플리케이션 레벨 경고)
- **1** = 경고 번호 또는 심각도

**의미:**
- ✅ 빌드 실패가 아님
- ✅ 배포 실패가 아님
- ⚠️ 애플리케이션이 실행 중이지만 문제가 있음

---

## 📊 현재 상태 분석

### 스크린샷에서 확인된 사항

**성공한 것들:**
- ✅ 배포 성공 ("Deployment successful")
- ✅ 빌드 성공 (04:08 소요)
- ✅ 서비스 "Online" 상태
- ✅ 모든 배포 단계 완료 (Initialization, Build, Deploy, Post-deploy)

**경고:**
- ⚠️ 노란색 경고 삼각형 "A1" 표시

---

## 🔍 A1 경고의 일반적인 원인

### 1. 애플리케이션 시작 오류
- 서비스는 시작되었지만 내부 오류 발생
- 예: API 연결 실패, 환경 변수 누락

### 2. 헬스체크 실패
- 애플리케이션이 응답하지 않음
- 예: 잘못된 포트, 라우팅 오류

### 3. 메모리/리소스 경고
- 메모리 사용량이 높음
- 예: 메모리 누수, 리소스 부족

### 4. 로그 오류
- 애플리케이션 로그에 오류 메시지
- 예: API 연결 실패, 데이터베이스 연결 실패

---

## 🔧 확인 방법

### 1단계: 배포 로그 확인

**Railway 대시보드에서:**
1. **mvs-frontend** 서비스 선택
2. **Deployments** 탭 (이미 열려있음)
3. 최신 배포의 **"View logs"** 버튼 클릭
4. 다음 확인:

**정상적인 경우:**
```
[start]
Serving!
- Local:    http://localhost:3000
- Network:  http://0.0.0.0:3000
```

**문제가 있는 경우:**
```
[start]
Error: ENOENT: no such file or directory, open 'build/index.html'
또는
Cannot find module 'serve'
또는
Port 3000 is already in use
```

---

### 2단계: 런타임 로그 확인

**Railway 대시보드에서:**
1. **mvs-frontend** 서비스 선택
2. **Deployments** 탭
3. 최신 배포의 **"..." 메뉴** (세로 점 3개) 클릭
4. **"View Logs"** 또는 **"Runtime Logs"** 클릭
5. 오류 메시지 확인

---

### 3단계: Metrics 확인

**Railway 대시보드에서:**
1. **mvs-frontend** 서비스 선택
2. **Metrics** 탭 클릭
3. 다음 확인:
   - CPU 사용량
   - 메모리 사용량
   - 네트워크 트래픽
   - 요청 수

**문제 징후:**
- 메모리 사용량이 계속 증가
- CPU 사용량이 비정상적으로 높음
- 요청 수가 0이거나 매우 낮음

---

## 🎯 현재 상황에 맞는 확인

### 이전 문제와의 연관성

**이전에 발견된 문제:**
- 프론트엔드가 `localhost:3001`로 API 호출
- `REACT_APP_API_URL` 환경 변수 미설정

**A1 경고의 가능한 원인:**
1. **API 연결 실패**
   - 프론트엔드가 백엔드에 연결할 수 없음
   - 브라우저에서 API 호출 실패
   - CORS 오류

2. **환경 변수 미설정**
   - `REACT_APP_API_URL`이 설정되지 않음
   - 빌드 시점에 잘못된 URL 사용

---

## ✅ 해결 방법

### 방법 1: 배포 로그 확인 (우선)

**Railway 대시보드에서:**
1. **mvs-frontend** 서비스 선택
2. **Deployments** 탭
3. 최신 배포의 **"View logs"** 클릭
4. 오류 메시지 확인

**확인할 내용:**
- 빌드 로그에 오류가 있는지
- 시작 명령이 올바르게 실행되었는지
- "Serving!" 메시지가 있는지

---

### 방법 2: 런타임 로그 확인

**Railway 대시보드에서:**
1. **mvs-frontend** 서비스 선택
2. **Deployments** 탭
3. 최신 배포의 **"..." 메뉴** 클릭
4. **"View Logs"** 클릭
5. 런타임 오류 확인

---

### 방법 3: 환경 변수 확인

**Railway 대시보드에서:**
1. **mvs-frontend** 서비스 선택
2. **Variables** 탭 클릭
3. 다음 확인:
   - `REACT_APP_API_URL`이 설정되어 있는지
   - 값이 올바른 백엔드 URL인지

**설정되어 있지 않다면:**
1. **New Variable** 클릭
2. 다음 설정:
   ```
   Name: REACT_APP_API_URL
   Value: https://mvs-backend-production.up.railway.app/api
   ```
   (실제 백엔드 URL로 변경)
3. **Save** 클릭
4. 재배포

---

### 방법 4: 브라우저에서 확인

**브라우저 개발자 도구:**
1. 프론트엔드 URL 접속
2. 개발자 도구 (F12) 열기
3. **Console** 탭 확인
4. **Network** 탭 확인

**확인할 내용:**
- API 호출이 올바른 URL로 가는지
- `localhost`가 아닌 실제 Railway URL인지
- CORS 오류가 있는지
- 404 또는 500 오류가 있는지

---

## 📋 체크리스트

### 즉시 확인
- [ ] 배포 로그 확인 ("View logs" 클릭)
- [ ] 런타임 로그 확인
- [ ] 환경 변수 확인 (`REACT_APP_API_URL`)

### 문제 발견 시
- [ ] 환경 변수 설정
- [ ] 재배포
- [ ] 브라우저에서 확인

---

## 💡 예상되는 문제와 해결

### 문제 1: API 연결 실패

**증상:**
- 배포는 성공했지만 브라우저에서 API 호출 실패
- A1 경고 표시

**해결:**
1. `REACT_APP_API_URL` 환경 변수 설정
2. 재배포
3. 확인

---

### 문제 2: 빌드 파일 누락

**증상:**
- 배포 로그에 "ENOENT: no such file or directory, open 'build/index.html'" 오류

**해결:**
1. 배포 로그 확인
2. 빌드 단계가 성공했는지 확인
3. Root Directory 설정 확인 (`daeheung-rt-one-web`)

---

### 문제 3: 포트 충돌

**증상:**
- 배포 로그에 "Port 3000 is already in use" 오류

**해결:**
1. `nixpacks.toml`의 포트 설정 확인
2. Railway의 `PORT` 환경 변수 사용 확인

---

## 🎯 요약

**현재 상태:**
- ✅ 빌드 성공
- ✅ 배포 성공
- ✅ 서비스 "Online"
- ⚠️ A1 경고 (애플리케이션 레벨 경고)

**다음 단계:**
1. 배포 로그 확인 ("View logs" 클릭)
2. 런타임 로그 확인
3. 환경 변수 확인 (`REACT_APP_API_URL`)
4. 브라우저에서 확인

**빌드 실패가 아닙니다!** 배포는 성공했지만, 애플리케이션이 실행 중에 문제가 있을 수 있습니다. 로그를 확인하여 정확한 원인을 파악하세요.
