# 테스트 시나리오 — Phase 4 Tauri 네이티브 전환

> 작성: TARS | 2026-06-12
> 대상: Tauri v2 네이티브 에디션 (3안: plugin-fs/dialog + 프론트 재구성)
> 기획안: docs/plans/20260612_plan_sdv-refactoring-native-migration_TARS.md Phase 4

## 전제

- 단일 코드베이스 2 에디션: 브라우저판(node server.js) + Tauri판. 분기점은 client/app/api.js 어댑터
- Rust command(src-tauri/src/commands.rs)가 HTTP API 응답 형태 미러링
- 검증 도구: WebView2 CDP(`--remote-debugging-port`) Runtime.evaluate

## 시나리오

### 빌드·기동

| ID | 시나리오 | 기대 결과 |
|----|----------|----------|
| P4-001 | cargo 디버그 빌드 | 성공 (commands/lib 컴파일) |
| P4-002 | 프론트 어셈블리 (build-tauri-frontend.js) | dist-tauri/ 생성, app.js 결합 문법 OK |
| P4-003 | 릴리스 빌드 + NSIS/MSI 번들 | sdv.exe + SDV_x.x.x_x64-setup.exe 생성 |
| P4-004 | exe 기동 | 단일 창, 메모리 ~33MB |

### 부트스트랩·렌더 (CDP)

| ID | 시나리오 | 기대 결과 |
|----|----------|----------|
| P4-010 | typeof state | object (스크립트 정상 실행) |
| P4-011 | get_boot_config → state.rootDir | CLI 인자 디렉토리 반영 |
| P4-012 | CLI 파일 인자 → 자동 오픈 | state.activeTab = 해당 파일, items 로드 |
| P4-013 | 마크다운 렌더 | #content-body h1 존재, 이미지 4개 렌더 |
| P4-014 | KaTeX 로드 | typeof window.katex === object |
| P4-015 | 콘솔 예외 | 0건 |

### Rust command 기능 (CDP invoke)

| ID | 시나리오 | 기대 결과 |
|----|----------|----------|
| P4-020 | apiList(docs/) | items 반환 |
| P4-021 | apiRead(CHANGELOG.md) | content + ext=md |
| P4-022 | apiSearch("viewer") | results 배열 |
| P4-023 | apiRename(없는 파일) | err="File not found" (에러 형태 미러링) |
| P4-024 | mediaSrc(png) | asset.localhost URL 생성 (asset protocol) |

### 수동 확인 (Dylan 실기)

| ID | 시나리오 | 기대 결과 |
|----|----------|----------|
| P4-M01 | 폴더 피커 버튼 | plugin-dialog 네이티브 다이얼로그 (PowerShell 창 없음, 즉시) |
| P4-M02 | 파일 드래그 앤 드롭 | 네이티브 경로로 즉시 열림 |
| P4-M03 | 미디어 재생 (mp4/mp3 시킹) | asset protocol Range 스트리밍 |
| P4-M04 | PDF 뷰 | iframe 표시 (WebView2 PDF 렌더) |
| P4-M05 | PDF 인쇄 (Print 버튼) | WebView2 인쇄 흐름 — **검증 필요 항목** (WKWebView는 macOS 미검증) |
| P4-M06 | rename/delete 실파일 | 정상 + 트리 갱신 |
| P4-M07 | 두 번째 실행 (.md 인자) | 기존 창 포커스 + 해당 파일 오픈 (single-instance) |
| P4-M08 | mkv/avi 재생 | WebView2 코덱 의존 — **검증 필요 항목** |
