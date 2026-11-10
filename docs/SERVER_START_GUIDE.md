# MVS 서버 시작 가이드

## 📋 개요

MVS 프로젝트의 서버를 쉽게 시작하고 관리할 수 있는 스크립트입니다.

## 🚀 빠른 시작

### Windows (PowerShell)
저장소 루트(`MVS/`)에서 실행합니다.

```powershell
# 모든 서버 시작 (백엔드 + 프론트엔드)
.\server\start-server.ps1
# 또는: npm run dev

# 백엔드만 시작
.\server\start-server.ps1 -BackendOnly

# 프론트엔드만 시작
.\server\start-server.ps1 -FrontendOnly
```

### Windows (배치 파일)
```cmd
# 저장소 루트에서 실행 또는 server 폴더의 start-server.bat 더블클릭
server\start-server.bat
```

## 🛑 서버 중지

### Windows (PowerShell)
```powershell
# 모든 서버 중지
.\server\stop-server.ps1

# 백엔드만 중지
.\server\stop-server.ps1 -BackendOnly

# 프론트엔드만 중지
.\server\stop-server.ps1 -FrontendOnly

# 모든 Node.js 프로세스 중지
.\server\stop-server.ps1 -All
```

### Windows (배치 파일)
`server` 폴더에 `stop-server.bat`이 있으면 동일한 방식으로 실행합니다.

## 📝 스크립트 옵션

### start-server.ps1 옵션

| 옵션 | 설명 |
|------|------|
| `-BackendOnly` | 백엔드 서버만 시작 |
| `-FrontendOnly` | 프론트엔드 서버만 시작 |
| `-SkipChecks` | 사전 검사 건너뛰기 |
| `-Help` | 도움말 표시 |

### stop-server.ps1 옵션

| 옵션 | 설명 |
|------|------|
| `-BackendOnly` | 백엔드 서버만 중지 |
| `-FrontendOnly` | 프론트엔드 서버만 중지 |
| `-All` | 모든 Node.js 프로세스 중지 |
| `-Help` | 도움말 표시 |

## 🔧 수동 시작 방법

### 백엔드 서버
```bash
cd daeheung-rt-one-api
npm run dev
```

### 프론트엔드 서버
```bash
cd daeheung-rt-one-web
npm start
```

## 📊 서버 정보

### 포트
- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:5000
- **헬스체크**: http://localhost:5000/health

### 테스트 계정
- **ID**: root / admin / user1
- **PW**: admin123

## ⚙️ 사전 요구사항

1. **Node.js** (v20.0.0 이상)
2. **npm** (Node.js와 함께 설치됨)
3. **PostgreSQL** (데이터베이스)
4. **환경 변수 파일** (`.env`)

## 🔍 문제 해결

### 포트가 이미 사용 중인 경우
스크립트가 자동으로 포트를 사용하는 프로세스를 종료합니다. 수동으로 종료하려면:
```powershell
# 포트 5000 사용 프로세스 확인
netstat -ano | findstr :5000

# 포트 3000 사용 프로세스 확인
netstat -ano | findstr :3000
```

### 환경 변수 파일이 없는 경우
```bash
# 백엔드 환경 변수 파일 복사
copy daeheung-rt-one-api\env.example daeheung-rt-one-api\.env

# 프론트엔드 환경 변수 파일 복사 (필요한 경우)
copy daeheung-rt-one-web\env.example daeheung-rt-one-web\.env
```

### 의존성이 설치되지 않은 경우
스크립트가 자동으로 설치를 시도합니다. 수동으로 설치하려면:
```bash
# 백엔드 의존성 설치
cd daeheung-rt-one-api
npm install

# 프론트엔드 의존성 설치
cd daeheung-rt-one-web
npm install
```

### PowerShell 실행 정책 오류
```powershell
# 실행 정책 확인
Get-ExecutionPolicy

# 실행 정책 변경 (관리자 권한 필요)
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 📋 스크립트 기능

### start-server.ps1
- ✅ 포트 충돌 자동 해결
- ✅ 환경 변수 파일 확인
- ✅ 의존성 자동 설치
- ✅ 데이터베이스 연결 확인
- ✅ 색상 출력으로 가독성 향상
- ✅ 상세한 오류 메시지

### stop-server.ps1
- ✅ 안전한 프로세스 종료
- ✅ 포트별 서버 중지
- ✅ 모든 Node.js 프로세스 일괄 중지 옵션
- ✅ 상세한 종료 상태 표시

## 🎯 사용 예시

### 개발 환경에서 시작
```powershell
# 모든 서버 시작
.\server\start-server.ps1

# 검사 건너뛰고 빠르게 시작
.\server\start-server.ps1 -SkipChecks
```

### 백엔드 API만 테스트
```powershell
# 백엔드만 시작
.\server\start-server.ps1 -BackendOnly

# 테스트 후 중지
.\server\stop-server.ps1 -BackendOnly
```

### 프론트엔드만 개발
```powershell
# 프론트엔드만 시작
.\server\start-server.ps1 -FrontendOnly

# 개발 완료 후 중지
.\server\stop-server.ps1 -FrontendOnly
```

## 📝 참고사항

1. **첫 실행 시**: 의존성 설치에 시간이 걸릴 수 있습니다.
2. **서버 시작 시간**: 백엔드 서버가 완전히 시작되는 데 약 3-5초가 소요됩니다.
3. **로그 확인**: 각 서버는 별도의 PowerShell 창에서 실행되며, 로그를 확인할 수 있습니다.
4. **데이터베이스**: 서버 시작 전에 PostgreSQL이 실행 중이어야 합니다.

## ☁️ Railway에 DB 덤프 복원하기

Railway Postgres에는 **파일 업로드 UI가 없습니다.** 로컬 PC에서 `DATABASE_URL`로 접속해 `pg_restore` / `psql`로 넣습니다.

### 1. 준비
- [PostgreSQL 클라이언트](https://www.postgresql.org/download/windows/) 설치 → `pg_restore`, `psql`이 **PATH**에 있어야 합니다.
- Railway → Postgres 서비스 → **Variables** → `DATABASE_URL` 복사

### 2. 복원 실행 (저장소 루트 `MVS/` 기준)

**기본 경로** `backup/daeheung-rt-one-db.dump` (pg_dump 커스텀 포맷 `-Fc`) 를 Railway DB에 넣습니다.

```powershell
cd daeheung-rt-one-api
$env:DATABASE_URL = "postgresql://...."   # Railway에서 복사한 값 전체
npm run db:restore:railway
```

다른 덤프 파일을 지정:

```powershell
npm run db:restore:railway -- ..\backup\daeheung-rt-one-db.dump
```

**기존 스키마·데이터를 비우고** 덤프 내용으로 맞추려면 (운영 DB에서는 신중히):

```powershell
npm run db:restore:railway -- ..\backup\daeheung-rt-one-db.dump --clean
```

**평문 `.sql` 파일**이면 스크립트가 자동으로 `psql -f`를 사용합니다.

### 3. 스키마만 맞추고 데이터는 마이그레이션만 쓰는 경우
- 빈 Railway DB에 먼저 `npm run db:migrate:railway` (또는 배포 시 자동 마이그레이션)로 스키마를 올린 뒤,
- 데이터만 필요하면 덤프에 **데이터만** 포함되도록 별도 `pg_dump`를 만드는 편이 안전합니다.

### 4. SSL
- Railway가 준 `DATABASE_URL`에 `sslmode=require` 등이 없으면 연결 오류가 날 수 있습니다. Railway 대시보드에 표시된 문자열을 그대로 사용하세요.

## 🔗 관련 문서

- [QUICK_START.md](./QUICK_START.md) - 빠른 시작 가이드
- [DEV_GUIDE.md](./DEV_GUIDE.md) - 개발 가이드
- [DATABASE_SCHEMA_AUDIT_REPORT.md](./DATABASE_SCHEMA_AUDIT_REPORT.md) - 데이터베이스 스키마

