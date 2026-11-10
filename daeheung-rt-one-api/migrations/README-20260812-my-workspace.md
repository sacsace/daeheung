# 2026-08-12 「내 정보·업무」마이그레이션 정리

이미 적용된 `20260812030000` ~ `20260812100000` 조각 마이그레이션은 **SequelizeMeta 호환**을 위해 유지합니다.

## 최종 상태 보장

| 파일 | 역할 |
|------|------|
| `20260812110000-consolidate-my-info-work-menus.js` | `/my` 트리·라벨·user 권한 idempotent 수리 |
| `20260812120000-add-menus-permissions-poll-indexes.js` | 메뉴/권한/투표 인덱스 + 폴 활성 UNIQUE |

## 코드 단일 출처

`daeheung-rt-one-api/src/constants/myWorkspaceMenus.ts` — 시드·권한 유틸·메뉴 컨트롤러가 공유합니다.
