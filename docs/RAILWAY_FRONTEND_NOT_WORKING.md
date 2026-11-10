# 프론트엔드 정상 작동 확인 가이드

## 🔴 현재 상태: 정상이 아님

**문제:**
- 프론트엔드 URL에 접속했을 때 Railway 기본 페이지가 표시됨
- "✨ Home of the Railway API ✨" 메시지와 ASCII 아트가 보임
- 실제 React 앱이 아닌 Railway의 기본 응답

**의미:**
- 프론트엔드가 정상적으로 배포되지 않았음
- 서비스가 크래시되었거나 시작되지 않았음

---

## ✅ 정상적인 경우

### 정상 작동 시 보이는 것
- React 앱의 로그인 페이지
- 또는 대시보드 (로그인된 경우)
- MVS 애플리케이션 UI
- Railway 기본 페이지가 아닌 실제 앱

---

## 🔍 문제 확인 방법

### 1. Railway 대시보드에서 서비스 상태 확인

**Railway 대시보드에서:**
1. **mvs-frontend** 서비스 선택
2. 서비스 상태 확인:
   - ✅ **"Online"** - 정상 작동 중
   - ❌ **"Crashed"** - 크래시됨
   - ⏳ **"Building"** - 빌드 중

### 2. 배포 로그 확인

**Railway 대시보드에서:**
1. **mvs-frontend** 서비스 선택
2. **Deployments** 탭 클릭
3. 최신 배포 클릭
4. **"Deploy Logs"** 탭 클릭
5. 다음 확인:

**정상적인 경우:**
```
[phases.build]
Compiled successfully!

[start]
Serving!
- Local:    http://localhost:3000
- Network:  http://0.0.0.0:3000
```

**문제가 있는 경우:**
```
[start]
This is a monorepo root. Please deploy daeheung-rt-one-api or daeheung-rt-one-web services separately.
또는
Error: ENOENT: no such file or directory, open 'build/index.html'
또는
Deploy crashed
```

---

## 🔧 해결 방법

### 1단계: Root Directory 설정 확인

**Railway 대시보드에서:**
1. **mvs-frontend** 서비스 선택
2. **Settings** 탭 클릭
3. **"Root Directory"** 또는 **"Source"** 섹션 확인
4. 값이 **`daeheung-rt-one-web`**로 설정되어 있는지 확인
5. 설정되어 있지 않다면 **`daeheung-rt-one-web`**로 설정
6. **Save** 클릭

### 2단계: 재배포

- 설정 저장 후 자동 재배포 또는
- 수동으로 **"Redeploy"** 클릭

### 3단계: 배포 로그 확인

- 배포 로그에서 다음 확인:
  - `daeheung-rt-one-web` 디렉토리에서 빌드가 시작되는지
  - 빌드가 성공했는지
  - 시작 명령이 올바른지
  - "Serving!" 메시지가 나오는지

---

## 📊 상태별 확인

### 서비스가 "Online"인 경우
- 서비스는 실행 중이지만 잘못된 응답을 보내고 있음
- Railway 기본 페이지가 표시됨
- → Root Directory 설정 확인 필요

### 서비스가 "Crashed"인 경우
- 서비스가 시작되지 않았음
- → 배포 로그 확인 필요
- → Root Directory 설정 확인 필요

### 서비스가 "Building"인 경우
- 아직 빌드 중
- → 빌드 완료 대기

---

## 🎯 빠른 체크리스트

### Railway 대시보드 확인
- [ ] mvs-frontend 서비스 상태 확인
- [ ] Settings → Root Directory 확인
- [ ] Root Directory가 `daeheung-rt-one-web`로 설정되어 있는지 확인

### 배포 로그 확인
- [ ] Deployments → 최신 배포 → Deploy Logs
- [ ] 빌드가 성공했는지 확인
- [ ] 시작 명령이 올바른지 확인
- [ ] "Serving!" 메시지 확인

### 브라우저 확인
- [ ] 프론트엔드 URL 접속
- [ ] React 앱이 표시되는지 확인
- [ ] Railway 기본 페이지가 아닌지 확인

---

## 💡 정상 작동 시 보이는 것

### 로그인 페이지 (로그인하지 않은 경우)
- MVS 로그인 폼
- 사용자명/비밀번호 입력 필드
- 로그인 버튼

### 대시보드 (로그인한 경우)
- MVS 대시보드
- 사이드바 메뉴
- 데이터 차트 및 통계

### Railway 기본 페이지가 아닌 실제 앱
- React 앱의 UI
- MVS 브랜딩
- 실제 기능이 작동하는 페이지

---

## 🚨 현재 문제

**현재 상태:**
- ❌ Railway 기본 페이지 표시
- ❌ React 앱이 표시되지 않음
- ❌ 서비스가 정상 작동하지 않음

**원인:**
- Railway가 루트 디렉토리를 배포하려고 함
- 또는 서비스가 크래시됨
- 또는 빌드 폴더가 없음

**해결:**
- Railway 대시보드에서 Root Directory 설정
- 재배포
- 배포 로그 확인

---

## 📝 요약

**정상이 아닙니다.**

현재:
- ❌ Railway 기본 페이지 표시
- ❌ React 앱이 표시되지 않음

정상적인 경우:
- ✅ React 앱의 로그인 페이지 또는 대시보드 표시
- ✅ MVS 애플리케이션 UI 표시

**다음 단계:**
1. Railway 대시보드에서 Root Directory 설정 확인
2. `daeheung-rt-one-web`로 설정되어 있는지 확인
3. 재배포
4. 배포 로그 확인
5. 브라우저에서 다시 접속 확인
