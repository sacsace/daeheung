# MVS - 단순하고 파워풀한 개발환경 가이드

## 🎯 1인 개발자를 위한 최적화

이 프로젝트는 **1인 개발자**를 위해 단순하고 빠른 개발환경으로 최적화되었습니다.

---

## ⚡ 빠른 시작 (3초)

```powershell
npm run dev
```

또는

```powershell
.\dev.ps1
```

**끝!** 백엔드와 프론트엔드가 자동으로 시작됩니다.

---

## 📁 단순화된 구조

```
MVS/
├── .env              # 모든 개발 설정 (하나로 통합!)
├── dev.ps1           # 원클릭 개발 서버 시작
├── package.json      # 간단한 명령어들
├── daeheung-rt-one-api/       # 백엔드
└── daeheung-rt-one-web/     # 프론트엔드
```

**복잡한 설정 파일들은 제거되었습니다!**

---

## 🔧 핵심 명령어

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 백엔드 + 프론트엔드 동시 시작 |
| `npm run stop` | 모든 서버 중지 |
| `npm run build` | 프로덕션 빌드 |
| `npm run db:migrate` | DB 마이그레이션 |
| `npm run db:seed` | 초기 데이터 입력 |
| `npm run test` | 백엔드 테스트 |
| `npm run clean` | node_modules 정리 |

---

## 🎨 개발 설정

### 환경 변수

모든 설정은 **`.env` 파일 하나**에 있습니다:

```bash
# 서버
PORT=5000
CORS_ORIGIN=http://localhost:3000

# 데이터베이스
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mvs
DB_USER=mvs_user
DB_PASSWORD=mvs_password

# 보안 (개발용)
JWT_SECRET=mvs-dev-secret-key-minimum-32-characters-long
```

### 자동 핫 리로드

- **백엔드**: 파일 변경 시 자동 재시작 (nodemon)
- **프론트엔드**: 파일 변경 시 자동 새로고침 (React)

---

## 📝 접속 정보

- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:5000
- **헬스체크**: http://localhost:5000/health

### 테스트 계정

- **ID**: `root` / `admin` / `user1`
- **PW**: `admin123`

---

## 🚀 개발 워크플로우

1. **서버 시작**
   ```powershell
   npm run dev
   ```

2. **코드 작성**
   - 백엔드: `daeheung-rt-one-api/src/` 수정 → 자동 재시작
   - 프론트엔드: `daeheung-rt-one-web/src/` 수정 → 자동 새로고침

3. **테스트**
   ```powershell
   npm run test
   ```

4. **빌드**
   ```powershell
   npm run build
   ```

---

## 💡 팁

### 빠른 재시작
서버를 중지하고 다시 시작하려면:
```powershell
npm run stop
npm run dev
```

### 포트 충돌 해결
자동으로 포트를 정리하므로 걱정 없습니다!

### 데이터베이스 초기화
```powershell
npm run db:reset
```

---

## 🎯 제거된 복잡성

- ❌ 여러 환경 변수 파일 (env.development, env.production 등)
- ❌ 복잡한 Docker 설정
- ❌ 불필요한 테스트 스크립트
- ❌ 협업용 복잡한 설정

**→ 단순하고 빠른 개발에 집중!**

---

## 📚 추가 정보

- 백엔드 API 문서: http://localhost:5000/health
- 프론트엔드: React 18 + TypeScript + Material-UI
- 백엔드: Node.js 20 + Express + Sequelize

---

**1인 개발자에게 최적화된 빠르고 단순한 개발환경! 🚀**

