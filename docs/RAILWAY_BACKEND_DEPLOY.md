# Railway 백엔드 배포 가이드

## 저장소 기준 설정 (확인 완료)

| 항목 | 값 |
|------|-----|
| **Root Directory** (Railway 서비스 설정) | `daeheung-rt-one-api` |
| **빌더** | Nixpacks (`daeheung-rt-one-api/nixpacks.toml`) |
| **설치** | `npm ci` |
| **빌드** | `npm run build` → `src` → `dist` 복사 |
| **시작** | `npm run start:railway` (= `build` + `run-migrations.cjs` + `node dist/index.js`) |
| **헬스체크** | `GET /health` (`daeheung-rt-one-api/railway.toml`, `railway.json`) |
| **포트** | Railway가 주입하는 `PORT` 사용 (`HOST=0.0.0.0`) |

루트 `railway.toml`은 모노레포 안내용이며, **실제 배포는 `daeheung-rt-one-api`를 루트로 지정한 서비스**에서 수행합니다.

## 필수 환경 변수 (Variables)

배포 실패·기동 실패 시 우선 확인합니다.

- `DATABASE_URL` — Postgres 플러그인 연결 문자열  
- `JWT_SECRET` — **32자 이상**  
- `CORS_ORIGIN` — 프론트 URL(쉼표 구분). 프로덕션에서 **필수**  

기타: `NODE_ENV=production`은 `railway.toml` `[env]`에 있음.

## 배포 방법

### A) Git 연동 (권장)

GitHub 저장소가 Railway 서비스에 연결되어 있으면 **`main` 푸시**만으로 백엔드 이미지가 다시 빌드·배포됩니다.

```bash
git push origin main
```

### B) Railway CLI

1. 한 번만 로그인 (브라우저 또는 토큰):

   ```powershell
   railway login
   ```

   CI·헤드리스: [Project Token](https://docs.railway.app/guides/cli#project-token)을 `RAILWAY_TOKEN`으로 설정한 뒤:

   ```powershell
   railway login --browserless
   ```

2. 백엔드 디렉터리에서 프로젝트·서비스 연결:

   ```powershell
   cd daeheung-rt-one-api
   railway link
   ```

   프롬프트에서 **해당 백엔드 서비스**가 가리키는 프로젝트를 선택합니다.

3. 배포:

   ```powershell
   railway up
   ```

   또는 대시보드에서 **Redeploy** 실행.

### 배포 후 확인

- Railway **Deployments** 로그에서 빌드·마이그레이션·`Server listening` 확인  
- 브라우저 또는 CLI: `https://<백엔드-도메인>/health` → `status: ok`  
- API: `https://<백엔드-도메인>/api/health`

## 마이그레이션

`start:railway`가 기동 시 `scripts/run-migrations.cjs`를 실행합니다. 수동 실행은:

```powershell
cd daeheung-rt-one-api
$env:DATABASE_URL = "..."   # Railway Variables 값
npm run db:migrate:railway
```

데이터 덤프 복원은 `docs/SERVER_START_GUIDE.md`의 「Railway에 DB 덤프 복원하기」를 참고합니다.

## 참고

- [Railway CLI](https://docs.railway.app/develop/cli)  
- [Nixpacks Node](https://nixpacks.com/docs/providers/node)
