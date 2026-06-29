---
TITLE: SDV 업그레이드 4기능 통합 검수 리포트
AUTHOR: TARS
CREATED: 2026-06-29
UPDATED: 2026-06-29
CONTRIBUTORS: [TARS, Dylan]
TAGS: [sdv, test-report, zoom, refresh, csv, file-association]
RELATED:
  - 20260629_plan_sdv-upgrade-implementation_TARS.md
---

# SDV 업그레이드 4기능 — 통합 검수 리포트

대상 브랜치: `feat/sdv-upgrade-4features` / 목표 v0.80.0
검수 일자: 2026-06-29
방식: 단위 테스트(vm) + 결합 빌드 문법 + 실런타임(브라우저판 + Playwright 실제 파일 파이프라인) + 2회 독립 검증(설계/코드)

## 종합 판정

- 기능 1·2·3: **PASS** (실런타임 실동작 확인)
- 기능 4: **설정 완료, 빌드/설치 후 Dylan 실기 확인 필요** (디폴트 비가로채기 검증)
- BLOCKING: 0 (1건 실런타임 발견 → 수정 후 재검증 PASS)

## 1. 단위 테스트

| 항목 | 결과 |
|------|------|
| `npm run test:md` (마크다운 파서 회귀) | 28 passed, 0 failed |
| `npm run test:csv` (CSV 파서, 신규) | 16 passed, 0 failed |

CSV 파서 케이스: 단순/따옴표 내장 콤마/이스케이프 따옴표/내장 줄바꿈/CRLF/말미 개행/빈 필드/TSV/BOM/빈 입력/개행만/불균형 행/숫자 컬럼 감지/빈값 skip/비숫자/숫자 파싱.

## 2. 결합 빌드 문법 검증

`npm run build:frontend` → `client/app.js (syntax OK)`. 신규 심볼 번들 포함 확인(`sdvZoomIn`, `renderCsv`, `sdvParseDelimited`).

## 3. 실런타임 검증 (브라우저판 + Playwright)

브라우저판(`node server.js --root docs/testing/fixtures`)을 띄우고 실제 파일을 열어 DOM/동작을 검증. 콘솔 에러 0.

### 기능1 줌 — PASS
- Ctrl+/− 동등(sdvZoomIn/Out): `--doc-zoom` 100%→120%→리셋 1.0 확인
- CSV 표 줌은 font-size 스케일(13px→19.5px @150%)

### 기능2 새로고침 트리 — PASS
- 외부에서 `_tmp_refresh.txt` 생성 → 새로고침 → 트리에 등장 확인
- 외부 삭제 → 새로고침 → 트리에서 사라짐 확인

### 기능3 CSV 표/정렬 — PASS
- 표 렌더 + 헤더(name/age/city/note) + 데이터 5행
- 따옴표 내장 콤마 정확 파싱: Alice city = "Seoul, KR"
- 숫자 컬럼 정렬: age 오름차순 → Eve(3)/Bob(7)/Carol(25)/Alice(30)/Dave(100)
- 표/원문 토글 양방향
- 상태바 "5 rows" + 스크롤 % 갱신
- 대용량(6,000행): "6,000행 중 처음 5,000행만 표시" 안내 + 5,000행 렌더 + 단일 스크롤러(content-body scrollTop 0)

### 실런타임 발견·수정 (정직 기록)
- **발견**: 대용량 CSV 스크롤 시 sticky 헤더가 고정되지 않음(theadTop이 화면 밖으로). 독립 리뷰가 경고한 B2(zoom × sticky)가 실측으로 재현됨
- **원인**: CSS `zoom`이 sticky 자손의 좌표계를 깨뜨림 (border-collapse도 sticky와 비호환)
- **수정**: CSV 표는 `zoom` 대신 `font-size: calc(13px * var(--doc-zoom))`로 줌(sticky 유지), `border-collapse: separate`, `#content-body.csv-mode` flex 단일 스크롤러
- **재검증 PASS**: 줌 100%/150% 모두 스크롤 후 헤더 고정(thTop=wrapTop=145), font-size 19.5px @150%

## 4. 기능4 파일연결 — 설정 완료, 실기 대기

- `tauri.conf.json` `bundle.fileAssociations`에 md/pdf 추가, JSON 유효성 확인
- open-file 배선(single-instance, lib.rs) 기존 동작, 변경 없음
- 조사 결과(WebSearch/블로그): Tauri 기본 fileAssociations는 디폴트(UserChoice)를 가로채지 않는 것으로 보임 → .md=MMM 유지 요구와 일치 (추정, 실기 확정 필요)
- **Dylan 실기 확인 항목**: 설치 후 (a) 우클릭 "연결 프로그램"에 SDV 등장 (b) .md 더블클릭 디폴트 MMM 유지 (c) .pdf 디폴트 유지 (d) "SDV로 열기" 동작
- `role:"Viewer"`는 macOS 전용 메타(Windows NSIS 무시, 오류 아님)

## 5. 독립 검증 (2회, clean subagent)

- **설계/계획 라운드**: BLOCKING 4건(B1 CSV 상태바 / B2 sticky×zoom / B3 refreshTree 가드 / B4 빈·헤더만 CSV) 식별 → 구현에 반영
- **코드 라운드**: BLOCKING 0. CONFIRMED-OK 광범위(로드 순서, 정렬 3상태, 미균형 행, XSS escHtml, 리스너 공존, refreshTree 가드, 파서 무한루프 없음 등). NON-BLOCKING 6건 중 #1/#2(CSV 레이아웃·sticky)·#6(번들 개행) 반영, 나머지 known 처리

## 6. Known / 비차단 항목

- **#3**: CSV는 새로고침 시 스크롤 위치 미복원(스크롤러가 .csv-wrap이라 preserveScroll 대상 불일치). 경미, 후속
- **#4**: WebView2 네이티브 줌(Ctrl+휠/Ctrl+=)이 preventDefault로 완전히 억제되지 않을 수 있음 → Tauri 빌드 실기 확인 항목. 커스텀 --doc-zoom은 정상 적용
- **#5**: `role:"Viewer"` macOS 전용(무해)
- **N5 레거시 공존**: `install-context-menu.js`(node 에디션 우클릭)와 Tauri fileAssociations 공존. deprecate 여부 Dylan 결정 대기
- **find + zoom**: zoom≠100%에서 find 중앙정렬 좌표가 약간 어긋날 수 있음(WebView2 zoom×rect). 후속 검토

## 7. 배포 전 잔여

- Tauri 빌드(인스톨러) + 설치 후 기능4 실기 (Dylan)
- macOS/Linux 빌드는 별도(이번 Windows 우선)

## 관련 문서
- [구현 계획](file:///E:/projects/simple-doc-viewer/docs/plans/20260629_plan_sdv-upgrade-implementation_TARS.md)
- [설계 spec](file:///E:/projects/simple-doc-viewer/docs/plans/20260629_plan_sdv-upgrade-4features_TARS.md)
