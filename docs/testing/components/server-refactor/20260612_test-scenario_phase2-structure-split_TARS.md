# 테스트 시나리오 — Phase 2 구조 분리 (template literal 해체)

> 작성: TARS | 2026-06-12
> 대상: server.js 4,160줄 → thin entry + server/ 모듈 15개 + client/ 정적 파일 22개
> 기획안: docs/plans/20260612_plan_sdv-refactoring-native-migration_TARS.md Phase 2

## 전제조건

- 추출 방식: served-HTML 덤프 분할 (scripts/dev/extract-client.js) — 수작업 de-escaping 없음
- 동등성 원칙: `/client/app.js`는 app/*.js를 manifest 순서로 결합한 단일 스크립트 — 분리 전과 hoisting 의미 동일

## 시나리오

### 무손실 분리 게이트

| ID | 시나리오 | 기대 결과 |
|----|----------|----------|
| P2-001 | 추출 스크립트 재결합 검증 | 분할 파일 concat === 패치된 원본 (스크립트 내장 assert) |
| P2-002 | 서버 모듈 15개 문법 | node --check 전체 exit 0 |
| P2-003 | served app.js 문법 | new Function() 예외 없음 |
| P2-004 | served app.js vs 구버전 cooked script 라인 diff | 부트 패치 2곳(rootDir 1줄 + Init 블록)만 상이 |

### 부트스트랩 (/api/config)

| ID | 시나리오 | 기대 결과 |
|----|----------|----------|
| P2-010 | index.html 골격 | `<link href="/client/style.css">` + `<script src="/client/app.js">` 존재 |
| P2-011 | /api/config 기본 | `{rootDir, initialFile:null}` |
| P2-012 | CLI 파일 직접 열기 | `node server.js README.md` → config에 initialFile 반영 |

### 보안 회귀 (Phase 1 T-suite 전체 재실행)

| ID | 시나리오 | 기대 결과 |
|----|----------|----------|
| P2-020 | T-001~T-019 (T-014 제외 17건 자동) | 전부 Phase 1과 동일 결과 |

### 정적 자원

| ID | 시나리오 | 기대 결과 |
|----|----------|----------|
| P2-030 | /client/style.css, /sw.js, /public/manifest.json, /lib/mermaid.min.js, /lib/katex/katex.min.css | 전부 200 |

### 수동 확인 (브라우저)

| ID | 시나리오 | 기대 결과 |
|----|----------|----------|
| P2-M01 | 전 기능 스모크 — 트리 탐색, md 렌더, mermaid/KaTeX, 탭, 검색, Ctrl+F, Split, 테마, 미디어, PDF 인쇄, 피커, 드래그 앤 드롭 | 분리 전과 동일 동작 |
| P2-M02 | CLI 파일 직접 열기 (`sdv README.md`) | 해당 파일 자동 오픈 |
| P2-M03 | PWA — SW 등록, 설치 앱 동작 | 정상 (sw.js 캐시가 구버전 HTML을 들고 있으면 새로고침 1회 필요할 수 있음) |
