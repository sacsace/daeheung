# Railway 루트 디렉토리 배포 문제

## 🔴 문제 발견

**로그 메시지:**
```
"This is a monorepo root. Please deploy daeheung-rt-one-api or daeheung-rt-one-web services separately."
```

**의미:**
- Railway가 **루트 디렉토리**를 배포하려고 하고 있음
- 서비스가 **Root Directory**를 제대로 지정하지 않음
- 실제로는 **`daeheung-rt-one-api` / `daeheung-rt-one-web` 디렉토리**를 배포해야 함

---

## 🔍 원인

### Railway 서비스 설정 문제

**문제:**
- Railway 대시보드에서 서비스의 **Root Directory**가 설정되지 않았거나
- 루트 디렉토리(`/`)로 설정되어 있음
- 실제로는 `daeheung-rt-one-api` 또는 `daeheung-rt-one-web`로 설정되어야 함

**루트 `railway.toml` 파일:**
- 루트 디렉토리에 `railway.toml` 파일이 있음
- 이 파일이 루트 디렉토리 배포를 방지하는 메시지를 출력
- 하지만 Railway가 여전히 루트를 배포하려고 함

---

## ✅ 해결 방법

### 방법 1: Railway 대시보드에서 루트 디렉토리 설정 (권장)

1. **Railway 대시보드 접속**
2. **mvs-backend** 또는 **mvs-frontend** 서비스 선택
3. **Settings** 탭 클릭
4. **"Root Directory"** 또는 **"Source"** 섹션 찾기
5. 루트 디렉토리를 다음 중 하나로 설정
   - 백엔드: `daeheung-rt-one-api`
   - 프론트엔드: `daeheung-rt-one-web`

**확인:**
- 서비스가 해당 디렉토리에서 배포되는지 확인
- 배포 로그에서 `daeheung-rt-one-api` 또는 `daeheung-rt-one-web` 경로 확인

---

### 방법 2: 루트 railway.toml 파일 삭제 또는 수정

**옵션 A: 삭제**
- 루트 `railway.toml` 파일 삭제
- Railway가 각 서비스의 `railway.toml`을 사용하도록 함

**옵션 B: 수정**
- 루트 `railway.toml`을 더 명확하게 수정
- 또는 서비스별 설정으로 이동

---

## 🔧 Railway 대시보드 설정 확인

### 서비스별 루트 디렉토리 확인

**mvs-backend:**
- Root Directory: `daeheung-rt-one-api`

**mvs-frontend:**
- Root Directory: `daeheung-rt-one-web` ← **이것이 설정되어야 함!**

**Postgres:**
- Root Directory: 설정 불필요 (Railway 관리 서비스)

---

## 📝 설정 방법 (단계별)

### 1. Railway 대시보드에서

1. **mvs-backend** 또는 **mvs-frontend** 서비스 선택
2. **Settings** 탭 클릭
3. **"Source"** 또는 **"Root Directory"** 섹션 찾기
4. 값 입력: `daeheung-rt-one-api` 또는 `daeheung-rt-one-web`
5. **Save** 클릭

### 2. 재배포

- 설정 저장 후 자동 재배포 또는
- 수동으로 **"Redeploy"** 클릭

### 3. 로그 확인

- 배포 로그에서 다음을 확인:
  - `daeheung-rt-one-web` 디렉토리에서 빌드가 시작되는지
  - 루트 디렉토리 메시지가 사라졌는지
  - 정상적인 빌드 로그가 나오는지

---

## 🎯 예상 결과

### 수정 전 (현재)
```
Starting Container
Monorepo root detected. Set Root Directory to daeheung-rt-one-api or daeheung-rt-one-web in Railway service settings.
Crashed
```

### 수정 후 (예상)
```
Starting Container
[phases.setup] Installing Node.js...
[phases.install] npm ci...
[phases.build] Building React app...
Compiled successfully!
[start] Serving static files...
Serving!
```

---

## 💡 추가 확인 사항

### Railway 서비스 생성 시 확인

새로운 서비스를 생성할 때:
1. **"New Service"** 클릭
2. **"GitHub Repo"** 선택
3. 저장소 선택 후
4. **"Root Directory"** 또는 **"Source Path"** 설정
5. 백엔드면 `daeheung-rt-one-api`, 프론트엔드면 `daeheung-rt-one-web` 입력

### 기존 서비스 수정

기존 서비스의 루트 디렉토리를 변경하려면:
1. 서비스 → Settings
2. Source 또는 Root Directory 섹션
3. 값 변경: `daeheung-rt-one-api` 또는 `daeheung-rt-one-web`
4. Save

---

## 🚨 주의사항

### 루트 railway.toml 파일

- 루트 `railway.toml` 파일은 루트 디렉토리 배포를 방지하기 위해 만든 것
- 하지만 Railway가 루트를 배포하려고 하면 이 메시지가 출력됨
- **근본적인 해결책은 Railway 대시보드에서 Root Directory를 올바르게 설정하는 것**

---

## 📋 체크리스트

### Railway 대시보드 설정
- [ ] mvs-backend 또는 mvs-frontend 서비스 선택
- [ ] Settings 탭 확인
- [ ] Root Directory 또는 Source Path 확인
- [ ] `daeheung-rt-one-api` 또는 `daeheung-rt-one-web`로 설정
- [ ] Save 클릭

### 재배포
- [ ] 자동 재배포 대기 또는 수동 재배포
- [ ] 배포 로그 확인
- [ ] 루트 디렉토리 메시지가 사라졌는지 확인
- [ ] 정상적인 빌드 로그 확인

---

## 🎯 요약

**문제:**
- Railway가 루트 디렉토리를 배포하려고 함
- 서비스의 Root Directory가 설정되지 않음

**해결:**
- Railway 대시보드 → 서비스 → Settings
- Root Directory를 `daeheung-rt-one-api` 또는 `daeheung-rt-one-web`로 설정
- 재배포

**결과:**
- 해당 디렉토리에서 정상적으로 배포
- 빌드 및 시작 성공
