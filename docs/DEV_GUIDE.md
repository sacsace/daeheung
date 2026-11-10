# MVS - 단순하고 파워풀한 개발환경

## 🚀 빠른 시작

```powershell
# 한 번에 모든 서버 시작
.\dev.ps1

# 또는
npm run dev
```

## 📁 단순화된 구조

```
MVS/
├── .env                 # 모든 개발 설정 (하나로 통합)
├── dev.ps1             # 원클릭 개발 서버 시작
├── daeheung-rt-one-api/         # 백엔드
└── daeheung-rt-one-web/       # 프론트엔드
```

## ⚡ 핵심 명령어

```powershell
npm run dev          # 백엔드 + 프론트엔드 동시 시작
npm run stop         # 모든 서버 중지
npm run db:migrate   # DB 마이그레이션
npm run build        # 프로덕션 빌드
```

## 🔧 개발 설정

모든 설정은 `.env` 파일 하나에 통합되어 있습니다.

## 📝 접속 정보

- 프론트엔드: http://localhost:3000
- 백엔드 API: http://localhost:5000
- 테스트 계정: root / admin123

