# 프론트엔드 크래시 원인 및 해결 방법

## 🔴 문제 원인

프론트엔드가 크래시되는 주요 원인:

### 1. 포트 설정 문제 (가장 가능성 높음)

**문제:**
- `start:railway` 스크립트: `npx serve -s build -l $PORT`
- npm 스크립트에서 `$PORT`가 제대로 해석되지 않을 수 있음
- Railway는 `PORT` 환경 변수를 제공하지만, npm 스크립트에서는 직접 사용이 어려울 수 있음

**해결:**
- `serve` 패키지는 `PORT` 환경 변수를 자동으로 읽을 수 있음
- 또는 명시적으로 포트를 지정

### 2. 빌드 폴더 없음

**문제:**
- `build` 폴더가 생성되지 않았을 수 있음
- 빌드가 실패했을 수 있음

**확인 방법:**
- Railway 대시보드 → mvs-frontend → Deployments → 로그 확인
- 빌드 단계에서 오류가 있는지 확인

### 3. 의존성 문제

**문제:**
- `serve` 패키지가 설치되지 않았을 수 있음
- `npm ci`가 실패했을 수 있음

---

## ✅ 해결 방법

### 방법 1: start:railway 스크립트 수정 (권장)

`daeheung-rt-one-web/package.json`:

```json
{
  "scripts": {
    "start:railway": "npx serve -s build -l $PORT || npx serve -s build -l 3000"
  }
}
```

또는 더 나은 방법:

```json
{
  "scripts": {
    "start:railway": "PORT=${PORT:-3000} npx serve -s build -l ${PORT:-3000}"
  }
}
```

### 방법 2: nixpacks.toml 수정

`daeheung-rt-one-web/nixpacks.toml`:

```toml
[start]
cmd = "PORT=${PORT:-3000} npx serve -s build -l ${PORT:-3000}"
```

### 방법 3: serve가 PORT 환경 변수를 자동으로 읽도록

`serve` 패키지는 `PORT` 환경 변수를 자동으로 읽을 수 있습니다:

```json
{
  "scripts": {
    "start:railway": "npx serve -s build"
  }
}
```

하지만 `-l` 옵션으로 명시적으로 지정하는 것이 더 안전합니다.

---

## 🔍 문제 진단 방법

### Railway 로그 확인

1. Railway 대시보드 → mvs-frontend → Deployments
2. 최신 배포의 로그 확인
3. 다음 오류 메시지 확인:
   - `Error: listen EADDRINUSE` - 포트 충돌
   - `Error: Cannot find module` - 의존성 문제
   - `Error: ENOENT: no such file or directory, open 'build/index.html'` - 빌드 실패

### 일반적인 오류 메시지

1. **포트 바인딩 실패**
   ```
   Error: listen EADDRINUSE: address already in use :::3000
   ```
   → 포트가 이미 사용 중이거나 `PORT` 환경 변수가 제대로 전달되지 않음

2. **빌드 폴더 없음**
   ```
   Error: ENOENT: no such file or directory, open 'build/index.html'
   ```
   → 빌드가 실패했거나 `build` 폴더가 생성되지 않음

3. **의존성 문제**
   ```
   Error: Cannot find module 'serve'
   ```
   → `serve` 패키지가 설치되지 않음

---

## 🚀 권장 해결 방법

### 1. package.json 수정

```json
{
  "scripts": {
    "start:railway": "npx serve -s build -l ${PORT:-3000}"
  }
}
```

### 2. nixpacks.toml 수정

```toml
[start]
cmd = "npx serve -s build -l ${PORT:-3000}"
```

### 3. Railway 환경 변수 확인

- `PORT` 환경 변수가 설정되어 있는지 확인
- Railway가 자동으로 설정하지만, 명시적으로 확인

---

## 📝 수정 완료 후

1. 변경사항 커밋 및 푸시
2. Railway가 자동으로 재배포
3. 배포 로그에서 오류 확인
4. 서비스 상태 확인

---

## 💡 추가 확인 사항

### 빌드 성공 확인
- Railway 로그에서 "Build successful" 메시지 확인
- `build` 폴더가 생성되었는지 확인

### 포트 설정 확인
- Railway가 제공하는 `PORT` 환경 변수 확인
- `serve`가 올바른 포트로 시작하는지 확인

### 의존성 확인
- `package.json`에 `serve` 패키지가 있는지 확인
- `npm ci`가 성공적으로 실행되었는지 확인
