# Railway 프론트엔드 크래시 근본 원인 분석

## 🔴 문제 발견

**Nixpacks 설정 확인:**
```
║ start      │ echo 'This is a monorepo root. Please deploy daeheung-rt-one-api or msv- ║
║            │ frontend services separately.' && exit 1                        ║
```

**의미:**
- Railway가 **루트 디렉토리**를 배포하려고 하고 있음
- 루트 `railway.toml`의 `startCommand`가 실행되고 있음
- 이 명령이 `exit 1`로 종료하므로 서비스가 즉시 크래시됨

---

## 🔍 근본 원인

### 1. Railway가 루트 디렉토리를 배포하려고 함

**문제:**
- `mvs-frontend` 서비스가 **루트 디렉토리(`/`)**를 가리키고 있음
- 실제로는 **`daeheung-rt-one-web` 디렉토리**를 배포해야 함

**증거:**
- Nixpacks가 루트 `railway.toml`을 읽고 있음
- 루트 `railway.toml`의 `startCommand`가 실행됨
- `daeheung-rt-one-web/railway.toml`이나 `daeheung-rt-one-web/nixpacks.toml`이 사용되지 않음

---

### 2. 빌드는 성공했지만 시작 명령이 실패

**로그 분석:**
- ✅ `npm ci` 성공
- ✅ `npm run build` 성공 (ESLint 경고는 있지만 빌드는 성공)
- ✅ "=== Successfully Built! ===" 메시지
- ❌ 시작 명령이 루트 `railway.toml`의 명령을 실행
- ❌ `exit 1`로 즉시 종료

---

## ✅ 해결 방법

### 방법 1: Railway 대시보드에서 Root Directory 설정 (권장)

**Railway 대시보드에서:**
1. **mvs-frontend** 서비스 선택
2. **Settings** 탭 클릭
3. **"Root Directory"** 또는 **"Source"** 섹션 찾기
4. 루트 디렉토리를 **`daeheung-rt-one-web`**로 설정
   - 입력: `daeheung-rt-one-web`
   - 또는: `./daeheung-rt-one-web`
5. **Save** 클릭
6. **재배포** (자동 또는 수동)

**결과:**
- Railway가 `daeheung-rt-one-web` 디렉토리에서 배포
- `daeheung-rt-one-web/railway.toml` 또는 `daeheung-rt-one-web/nixpacks.toml` 사용
- 올바른 시작 명령 실행

---

### 방법 2: 루트 railway.toml 파일 삭제 또는 수정

**옵션 A: 삭제**
- 루트 `railway.toml` 파일 삭제
- Railway가 각 서비스의 `railway.toml`을 사용하도록 함

**옵션 B: 수정**
- 루트 `railway.toml`을 더 명확하게 수정
- 또는 서비스별 설정으로 이동

---

## 🔧 확인 방법

### Railway 대시보드에서 확인

1. **mvs-frontend** 서비스 선택
2. **Settings** 탭 클릭
3. **"Source"** 또는 **"Root Directory"** 섹션 확인
4. 현재 값이 비어있거나 `/`인지 확인
5. `daeheung-rt-one-web`로 변경

---

## 📊 예상 결과

### 수정 전 (현재)
```
Nixpacks 설정:
  start: echo 'This is a monorepo root...' && exit 1

결과: Deploy crashed
```

### 수정 후 (예상)
```
Nixpacks 설정:
  start: npx serve -s build -l $PORT

결과: Serving! (정상 작동)
```

---

## 🎯 우선순위

### 즉시 해결 (필수)
1. **Railway 대시보드에서 Root Directory 설정**
   - `daeheung-rt-one-web`로 변경
   - 재배포

### 추가 확인
2. **배포 로그 확인**
   - `daeheung-rt-one-web` 디렉토리에서 빌드가 시작되는지
   - 올바른 시작 명령이 실행되는지

---

## 💡 왜 이런 문제가 발생했나?

### Railway 서비스 생성 시
- 서비스를 생성할 때 Root Directory를 명시하지 않으면
- Railway가 기본적으로 루트 디렉토리(`/`)를 사용
- 루트에 `railway.toml`이 있으면 그것을 사용

### 해결책
- 각 서비스의 Root Directory를 명시적으로 설정
- `mvs-backend` → `daeheung-rt-one-api`
- `mvs-frontend` → `daeheung-rt-one-web`

---

## 📝 체크리스트

### Railway 대시보드 설정
- [ ] mvs-frontend 서비스 선택
- [ ] Settings 탭 확인
- [ ] Root Directory 또는 Source Path 확인
- [ ] 현재 값 확인 (비어있거나 `/`인지)
- [ ] `daeheung-rt-one-web`로 설정
- [ ] Save 클릭

### 재배포
- [ ] 자동 재배포 대기 또는 수동 재배포
- [ ] 배포 로그 확인
- [ ] Nixpacks 설정에서 올바른 start 명령 확인
- [ ] 정상적인 빌드 및 시작 확인

---

## 🎯 요약

**근본 원인:**
- Railway가 루트 디렉토리를 배포하려고 함
- `mvs-frontend` 서비스의 Root Directory가 설정되지 않음
- 루트 `railway.toml`의 `startCommand`가 실행되어 `exit 1`로 종료

**해결:**
- Railway 대시보드 → mvs-frontend → Settings
- Root Directory를 `daeheung-rt-one-web`로 설정
- 재배포

**결과:**
- `daeheung-rt-one-web` 디렉토리에서 정상적으로 배포
- 올바른 시작 명령 실행
- 서비스 정상 작동
