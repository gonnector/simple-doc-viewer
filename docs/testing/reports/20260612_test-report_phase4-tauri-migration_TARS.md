# 검수 보고서 — Phase 4 Tauri 네이티브 전환

> 작성: TARS | 2026-06-12
> 시나리오: docs/testing/components/tauri/20260612_test-scenario_phase4-tauri-migration_TARS.md
> 환경: GONNECTOR-HL (Windows 11 Pro), Rust 1.88, Tauri 2, WebView2, Node v22.22.0

## 결과 요약

**자동 테스트 전건 PASS** — 빌드 4, 부트스트랩·렌더 6, Rust command 5. 수동 8건 Dylan 실기 대기(2건은 명시적 검증 필요 항목).

## 상세

| ID | 시나리오 | 실측 | 판정 |
|----|----------|------|------|
| P4-001 | cargo 빌드 | 성공 | PASS |
| P4-002 | 프론트 어셈블리 | dist-tauri 생성, app.js 결합 문법 OK | PASS |
| P4-003 | 릴리스 + 번들 | sdv.exe(11MB) + setup.exe(3.7MB) + msi(4.8MB) | PASS |
| P4-004 | exe 기동 | 단일 창, 메모리 32.8MB | PASS |
| P4-010 | typeof state | object | PASS |
| P4-011 | rootDir | E:/projects/simple-doc-viewer (CLI 반영) | PASS |
| P4-012 | CLI 파일 자동 오픈 | activeTab=README.md, items=24 | PASS |
| P4-013 | 마크다운 렌더 | h1="Simple Doc Viewer", img 4개 | PASS |
| P4-014 | KaTeX | object | PASS |
| P4-015 | 콘솔 예외 | 0건 | PASS |
| P4-020 | apiList(docs/) | items=5 | PASS |
| P4-021 | apiRead(CHANGELOG) | len=13235, ext=md | PASS |
| P4-022 | apiSearch("viewer") | results=7 | PASS |
| P4-023 | apiRename(없는 파일) | err="File not found" (형태 미러링 확인) | PASS |
| P4-024 | mediaSrc(png) | http://asset.localhost/E%3A%2F... (asset protocol) | PASS |
| P4-M01~08 | 브라우저 수동 8건 | — | **대기** (Dylan 실기) |

## 핵심 진단 기록 — isTauri 전역 충돌 (해결)

빌드 직후 webview에서 트리가 비고 `state`가 undefined. CDP로 추적한 결과:
`SyntaxError: Identifier 'isTauri' has already been declared`. app.js는 1회만 요청·파싱됨에도
중복 선언 에러 → 우리 `function isTauri()`가 **Tauri 런타임이 주입하는 전역 `isTauri`와 충돌**.
어댑터 함수를 `sdvIsTauri()`로 개명하여 해결 (api/dragdrop/main.js). 이후 state=object, 예외 0.

교훈: withGlobalTauri 환경에서 `isTauri`/`invoke` 등 Tauri가 점유할 수 있는 식별자를 전역 함수명으로
쓰지 말 것. 디버깅은 `--remote-debugging-port`(WebView2 CDP) Runtime.evaluate가 결정적이었음
(스크린샷·placeholder 프로브로는 "왜 안 되는지" 특정 불가).

## 구조 요약

- **단일 코드베이스 2 에디션**: client/ 공유, 분기점은 client/app/api.js 어댑터 1곳
- **Rust command 7종** (commands.rs): get_boot_config/list_dir/read_file/search_dir/rename_path/delete_path/check_dir — HTTP API 응답 형태 미러링
- **네이티브 대체**: 폴더 피커=plugin-dialog, 미디어=asset protocol(Range), drag-drop=tauri 이벤트, launcher=plugin-single-instance, CLI/더블클릭=get_boot_config + open-file 이벤트
- 브라우저판 보안 회귀: 어댑터 변경 후 node server.js 재기동하여 list/read/search/config 200, root 밖 403 확인

## 미검증 (Dylan 실기 또는 타 OS 필요)

- **P4-M05 PDF 인쇄** (WebView2 인쇄 흐름) — 동작 추정, 실기 확인 필요. macOS WKWebView는 미검증
- **P4-M08 mkv/avi 재생** — WebView2 코덱 의존, 실기 확인 필요
- **macOS/Linux 빌드** — 디바이스 확보 시. CI(.github/workflows)는 MMM 패턴 이식 가능하나 미설정
- **파일 연결(.md 더블클릭)** — fileAssociations 의도적 미설정 (MMM이 .md 점유 중, Dylan 결정 대기)
