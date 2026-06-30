# Changelog

All notable changes to Simple Doc Viewer are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

---

## [0.80.3] - 2026-07-01

### Fixed

- **frontmatter `related:` 멀티라인 미표시** — `key:` 다음 줄들의 `  - item` 블록배열을 파싱해 불릿 리스트(`.fm-list`)로 표시. `tags: [a, b]` 인라인 배열은 기존대로 배지. related류 키는 불릿, 그 외 배열은 배지로 분기 (값 escHtml로 XSS 가드). MMM v0.7.x와 동일 처리

## [0.80.2] - 2026-06-30

### Removed
- 레거시 브라우저판 Windows 컨텍스트 메뉴 스크립트 제거: `install-context-menu.js`, `launcher.js`, 생성물 `sdv-open.vbs`. 네이티브판의 fileAssociations + single-instance가 대체. 설치돼 있던 레지스트리 항목(`HKCU\…\*\shell\SDV`)은 uninstall로 정리. 앱 바이너리 불변(인스톨러 재빌드 불필요)

## [0.80.1] - 2026-06-30

### Added
- 헤더 줌 컨트롤(− % +): 클릭으로 확대/축소, % 클릭 시 100% 리셋, 현재 배율 실시간 표시
- 도움말(?)에 줌(Ctrl +/−/0, Ctrl+휠) 및 "Reload document + folder tree (R)" 항목 추가

### Fixed
- 줌이 단축키만 있고 보이는 UI/도움말 설명이 없던 발견성 문제(Dylan 피드백)

## [0.80.0] - 2026-06-29

### Added
- **문서 영역 줌**: Ctrl +/−/0 및 Ctrl+휠. 텍스트/마크다운/코드는 CSS zoom, CSV 표는 font-size 스케일(sticky 헤더 호환). 사이드바·미디어 제외, 배율 localStorage 영속화
- **CSV/TSV 표 뷰**: 자체 RFC4180 파서(의존성 없음) + 표 렌더 + 컬럼 정렬(숫자/문자 자동, 오름/내림/원래 3상태) + 표/원문 토글 + sticky 헤더 + 5,000행 가드
- **파일 연결(fileAssociations)**: Windows 우클릭 "연결 프로그램"에 SDV(md/pdf) 등장. 디폴트(.md=MMM)는 비가로채기 목표(설치 후 실기 확인)

### Changed
- **새로고침(R/버튼)**: 활성 문서와 함께 좌측 폴더 트리도 갱신(외부 추가/삭제/이름변경 반영). 이름변경 입력 중 보존
- 클라이언트 번들 결합 구분자 개행화(ASI 방어)

### Notes
- 단위 테스트: 마크다운 28건 + CSV 파서 16건 PASS. 기능 1·2·3 브라우저판 실런타임 검증 PASS
- 미검증(Dylan 실기): fileAssociations 디폴트 비가로채기, WebView2 네이티브 줌 중복, macOS/Linux
- 레거시 install-context-menu.js(node 에디션)는 공존, deprecate 여부 미정

## [0.79] - 2026-06-12

### Added
- **Tauri v2 네이티브 데스크톱 에디션** (기획안 Phase 4, 3안 채택). 브라우저판과 **단일 코드베이스로 공존** — `client/`를 공유하고 분기점은 `client/app/api.js` 어댑터 한 곳(`sdvIsTauri()`로 fetch ↔ Rust invoke 스왑).
  - **Rust command 7종** (`src-tauri/src/commands.rs`) — get_boot_config/list_dir/read_file/search_dir/rename_path/delete_path/check_dir. HTTP `/api/*`와 동일한 응답 JSON 형태를 미러링(확장자 화이트리스트·1MB 캡·AND/OR 검색·BOM 제거 동치)
  - **네이티브 대체**: 폴더 피커 = plugin-dialog(브라우저판 PowerShell 방식 제거), 미디어 = asset protocol(`convertFileSrc`, Range 스트리밍 내장), drag-drop = Tauri 네이티브 이벤트(절대경로 직접 제공), launcher/포트/kill = plugin-single-instance, CLI/`.md` 더블클릭 = get_boot_config + open-file 이벤트
  - **빌드**: `npm run tauri build` → NSIS(3.7MB) + MSI(4.8MB) 인스톨러. 프론트는 `scripts/build-tauri-frontend.js`가 client/+lib/+public/을 dist-tauri/로 어셈블(번들러 없음). exe 메모리 ~33MB
  - `withGlobalTauri: true` — 클라이언트는 `window.__TAURI__` 전역만 사용(npm import 없음)
- **package.json / src-tauri/** 신규 — Tauri 스캐폴딩, capabilities(core+dialog), 아이콘 세트

### Fixed
- **어댑터 함수명 충돌** — `isTauri()`가 Tauri 런타임 주입 전역과 충돌(`SyntaxError: already declared`)하여 Tauri판 부팅 실패하던 것을 `sdvIsTauri()`로 개명하여 해결

### Notes
- fileAssociations(.md 더블클릭)는 의도적 미설정 — MMM이 .md를 점유 중이라 Dylan 결정 대기
- 미검증(Dylan 실기/타 OS): PDF 인쇄·mkv/avi 코덱(WebView2 의존), macOS/Linux 빌드, CI

## [0.78] - 2026-06-12

### Security
- **마크다운 렌더러 XSS 일괄 차단** (기획안 Phase 3, SEC-4·BUG-5) — inlineFormat을 placeholder-first 구조로 재편: 인라인 코드·수식·화이트리스트 HTML 태그를 먼저 추출하고 잔여 `<>`를 전면 이스케이프 (raw HTML passthrough 차단). 화이트리스트 태그의 `on*` 이벤트 핸들러·`javascript:`/`vbscript:`/`data:` 스킴 제거. img/link 속성 따옴표 이스케이프 + URL 스킴 화이트리스트. `<summary>` 텍스트 이스케이프. 단위 테스트 28건 신설(`scripts/dev/test-markdown.js` — 분리 덕에 파서를 Node에서 직접 테스트 가능해짐).

### Fixed
- **검색 하이라이트 오동작** (BUG-2) — AND 쿼리 split regex가 template literal 시절 cook 과정에서 `/[\s&]+/` → `/[s&]+/`로 변질돼 있던 것 교정
- **마크다운 테이블 빈 셀 드롭** (BUG-3) — 바깥 파이프만 제거 후 분할하는 방식으로 교체, 열 밀림 해소
- **UTF-8 BOM 잔존** (BUG-4 부분) — /api/read에서 BOM 제거. cp949 자동 감지는 무의존성 제약상 보류(알려진 한계)
- **launcher 콜백 이중 호출** (BUG-7) — alive 체크 timeout 시 서버가 2개 spawn되던 레이스를 done 래치로 차단
- **들여쓰기된 닫는 코드 펜스 미인식** (BUG-8) — 문서 잔여 전체가 코드로 삼켜지던 문제
- **mermaid 부분 다운로드 파일 잔존** (BUG-9) — temp 파일에 받고 완료 시에만 rename

### Performance
- **mermaid lazy load + 캐시** (PERF-2) — 2.9MB 라이브러리를 매 페이지 eager 로드하던 것을 mermaid 블록 발견 시에만 로드로 전환. `Cache-Control: max-age=86400` + ETag(304 지원) + 서버 메모리 버퍼 캐시. app.js 결합 결과도 mtime 기반 메모리 캐시
- **검색 콘텐츠 캐시** (PERF-1) — mtime+size 불변 시 파일 재읽기 생략 (타이핑 중 반복 쿼리가 디렉토리 전 파일을 매번 full read하던 비용을 stat 1회로 축소). 중복 statSync 제거
- **Ctrl+F 입력 debounce 200ms** (PERF-3) — 키스트로크마다 전체 DOM 하이라이트 재작성하던 입력 지연 제거
- **테마 토글 즉각화** (PERF-4 lite) — CSS 변수 기반이므로 mermaid 문서가 아니면 전체 재파싱·재렌더 생략

## [0.77] - 2026-06-12

### Changed
- **구조 리팩토링 — template literal 해체** (기획안 Phase 2). server.js 4,160줄 단일 파일을 3계층으로 분리:
  - `server.js` — thin entry (CLI 파싱, 보안 게이트, 라우팅, 기동)
  - `server/` — 모듈 15개 (state/config/util/respond/mermaid-download + routes/ 9개 + pick-folder.ps1)
  - `client/` — 정적 프론트엔드 (index.html, style.css, app/ 20개 JS + manifest.json)
  - 분리 방법: served-HTML 덤프 분할(`scripts/dev/extract-client.js`) — Node가 이중 이스케이프를 이미 해석한 산출물을 자르므로 수작업 역변환 0건. 재결합 무손실 검증 + 구버전 대비 라인 diff가 부트 패치 2곳뿐임을 확인
  - `/client/app.js`는 app/*.js를 manifest 순서로 **결합한 단일 스크립트**로 서빙 — 분리 전과 hoisting 의미 동일 (번들러 불필요)
  - 서버 값 주입 2곳(rootDir/INITIAL_FILE)은 신규 `GET /api/config` 런타임 fetch로 대체 — 클라이언트 100% 정적화
  - **Template Literal 제약(이중 이스케이프, served-JS 검증 의무) 전면 폐기** — CLAUDE.md 갱신
  - Windows 폴더 피커 PS1을 `server/pick-folder.ps1` 실제 파일로 추출 (temp 복사 단계 제거)
- **PRD.md → docs/prd.md 이동** (레포 문서 구조 가이드라인 준수)

### Added
- 테스트 시나리오·검수 보고서 — Phase 2 (자동 전건 PASS: 무손실 게이트 4 + 부트스트랩 3 + 보안 회귀 17 + 정적 자원 5)

## [0.76] - 2026-06-12

### Security
- **경로 봉쇄(containment) 실구현** — 스텁이었던 `isPathSafe()`를 realpath 기반 ROOT_DIR prefix 검증으로 교체. 모든 파일 API(read/list/search/rename/delete/image/media)가 현재 루트 밖 경로를 403으로 거부. 루트 확장은 `/api/chroot`(POST)만이 유일한 통로 (symlink 우회 방지 포함).
- **CSRF/DNS rebinding 방어** — 전 요청에 Host/Origin 검증 게이트 추가 (localhost 계열 외 403). POST 바디는 `Content-Type: application/json` 강제 (text/plain 단순 요청의 preflight 우회 차단, 415). `/api/chroot`·`/api/pick-folder`를 POST 전용으로 전환.
- **HTML 미리보기 sandbox 격리** — `.html` 파일 미리보기를 same-origin iframe(`contentDocument.write`)에서 `sandbox=""` + `srcdoc` 방식으로 교체. 악성 HTML 내 스크립트가 SDV API에 접근 불가.
- **폴더 피커 명령 주입 차단** — 셸 문자열 조립(`exec`)을 `execFile` 인자 배열로 교체 (win32/darwin/linux 3-플랫폼). macOS AppleScript 리터럴은 별도 이스케이프.
- **정적 핸들러 path traversal 차단** — `/public/*`, `/lib/katex/*`에 resolve 후 base 디렉토리 prefix 검증 추가.

### Changed
- **HTML 미리보기 sandbox를 `allow-scripts`로 완화** (Dylan 1차 테스트 피드백) — JS 렌더링 단일 HTML(esbuild 번들 보고서 등)이 정상 표시되도록 스크립트 실행 허용. opaque origin이라 SDV API 호출은 `Origin: null` → 서버 게이트가 403 차단 (T-018/019 검증). 보안 격리는 유지.
- **폴더 피커 timeout 2분 → 10분** (Dylan 1차 테스트 피드백) — 다이얼로그를 2분 이상 열어두면 PowerShell 자식 프로세스가 timeout으로 강제 종료되며 피커가 저절로 닫히던 문제. 근본 개선(PowerShell 프로세스 방식 자체 제거)은 Tauri 전환 시 plugin-dialog 네이티브 피커로 해소 예정.

### Fixed
- **비정상 Range 헤더로 인한 서버 크래시** — `/api/media`의 Range를 엄격 파싱(suffix range 지원, 비정상 값 416 응답)하고 read stream에 error 핸들러 + 클라이언트 중단 시 stream destroy 추가. 기존에는 `Range: bytes=abc-` 요청 하나로 서버 프로세스 전체가 종료됐음.

### Added
- **리팩토링·네이티브 전환 기획안** — `docs/plans/20260612_plan_sdv-refactoring-native-migration_TARS.md`. 4관점(보안/버그/성능/아키텍처) 전수 분석 결과 31건 + 4 Phase 실행 계획 + Tauri 전환 3안 비교.
- 테스트 시나리오·검수 보고서 — `docs/testing/components/server-security/`, `docs/testing/reports/` (자동 19/19 PASS).

## [0.75] - 2026-04-17

### Added
- **PWA 설치 가능 (Windows/macOS/Linux)** — `public/manifest.json`, `public/sw.js`, 아이콘 세트(192/512/maskable/svg) 추가. 서버는 `/sw.js` root-scope 서빙 + `/public/*` 정적 서빙 + `Service-Worker-Allowed: /` 헤더. HTML에 `<link rel="manifest">` + theme-color + apple-touch-icon 추가. Chrome/Edge 주소창에서 "앱 설치" → 시작메뉴/Dock/Launchpad 자동 등록. 오프라인 동작 지원 (네트워크 우선 + 캐시 fallback). 설치 가이드: `docs/plans/20260417_guide_pwa-install_TARS.md`.
- **문서 단독 reload 버튼** — 헤더 우측에 Reload 아이콘(🔄) 추가. 클릭 시 현재 활성 탭의 파일만 서버에서 재요청하여 내용 갱신. F5(앱 전체 초기화)와 달리 탭 상태·사이드바·스크롤 등 유지. 단축키: `r` (입력 필드 외부에서). 가상 파일(드래그-드롭 등)은 무시.
- **SDV Launcher 스크립트** — `scripts/launcher/sdv-launcher.bat` + `install-shortcut.bat` + `uninstall-shortcut.bat`. 시작메뉴에서 "SDV (auto)" 클릭 시 서버 자동 시작 + PWA 창 열기 (포트 3000 체크 → 없으면 spawn → 브라우저 `--app` 모드로 열기).

### Fixed
- **WCO(Window Controls Overlay) 겹침 제거** — 설치된 앱에서 Chrome 창 제어 버튼이 앱 우상단 버튼(테마/Preview/Wrap/Print/Find)을 가리던 문제. manifest의 `display_override: ["window-controls-overlay", "standalone"]` 제거하고 순수 `display: standalone` 유지. 기존 설치된 앱은 제거 후 재설치 필요.

## [0.74] - 2026-04-16

### Added
- **네이티브 앱 전환 계획 문서** — `docs/plans/20260416_plan_native-app-migration_TARS.md` 추가. PWA(1단계) → Tauri(2단계) 전환 로드맵 + AIOS 대시보드 연동 플로우. 상위 전략 문서는 `aios/components/desktop-apps/`.
- **파일 탭 클릭 시 좌측 폴더 자동 전환** — 여러 탭을 열어두었을 때 특정 탭을 클릭하면 좌측 트리가 해당 파일의 parent 폴더로 자동 갱신됨. rootDir 밖 파일은 chroot 자동 확장 후 전환. 가상 파일(드롭)은 스킵. 같은 폴더면 하이라이트만 갱신.

### Fixed
- **Blockquote 줄바꿈 보존** — `> 작성...\n> Goal...\n> 의뢰...` 형태의 3줄 메타 블록이 한 줄로 합쳐지던 문제 수정. 연속된 non-empty 줄 사이에 `<br />` 삽입하여 화면·PDF 출력 모두 원본 줄바꿈 유지. 빈 줄 기반 paragraph 경계는 유지.

### Changed
- **sdv.local → localhost** — 내부 URL 참조를 `http://sdv.local:PORT`에서 `http://localhost:PORT`로 원복. hosts 파일 수정 불필요. (KaTeX CSS 링크는 상대경로 `/lib/katex/katex.min.css`로 변경)

## [0.73] - 2026-04-16

### Changed
- **Windows 폴더 피커 모던화** — 폴더 선택 다이얼로그를 VBScript `Shell.Application.BrowseForFolder`(레거시 트리 뷰)에서 Win32 `IFileDialog` + `FOS_PICKFOLDERS`로 교체. Windows 10/11 탐색기 스타일 모던 다이얼로그가 표시됨 (주소 바, 좌측 Quick Access, 검색창, 최근 항목 접근 가능). PowerShell `Add-Type`으로 C# P/Invoke 코드를 런타임 로드 — 외부 의존성 없음. macOS(osascript), Linux(zenity/kdialog)는 기존 유지.

---

## [0.72] - 2026-04-14

### Changed
- **탭 닫기 버튼 위치** — "모든 탭 닫기 / 선택 탭 닫기" 버튼을 탭 바 오른쪽 끝에서 우상단 헤더(Day/Night 토글 왼쪽)로 이동. 탭이 많아 가로 스크롤이 생긴 상태에서도 즉시 접근 가능. 선택 탭이 있으면 accent 색상으로 강조, 탭이 1개 이하면 숨김.

### Added
- **파일 Copy Path** — 사이드바 파일 hover 액션에 📋 Copy Path 버튼 추가. 클릭 시 파일의 OS 풀 경로를 클립보드에 복사 (예: `E:/project/.../file.md`). 복사 성공 시 버튼이 녹색으로 깜박임. `navigator.clipboard` 실패 시 `execCommand` fallback. AI에게 파일 경로를 전달할 때 유용.

---

## [0.71] - 2026-04-13

### Added
- **문서 내 검색 (Ctrl+F)** — Find 바로 본문 내 텍스트 검색, 매치 하이라이트, N/M 카운터, Enter/Shift+Enter로 다음/이전 매치 이동, W 토글로 전체 단어 일치 모드. SVG·mermaid 영역 제외, content-body 내부 스크롤로 정렬.
- **폴더 선택 다이얼로그** — 우상단 폴더 아이콘으로 OS 네이티브 폴더 피커 호출 (Windows: VBScript, macOS: osascript, Linux: zenity/kdialog).
- **검색 클리어 버튼** — 사이드바 검색 입력에 × 버튼으로 1클릭 클리어.

### Changed
- **검색 하이라이트 재작성** — Range 기반 병합 방식으로 변경, 중첩 매치·경계 케이스 안정화.
- **타임스탬프 표시 강화** — Modified/Created에 M·C 라벨 추가, M > C 차이를 초 단위로 비교하여 편집된 파일만 강조.
- **컬럼 정렬 개선** — sidebar-opts와 content-tabs 높이 32px 통일, 정렬 화살표 정렬.
- **반응형 narrow 모드** — 사이드바 임계값을 428px로 조정 (이전 300px), 실제 사용 폭에 맞춤.
- **웰컴 화면 포맷 리스트** — 지원 확장자 87개 표시 + "+70 more" 카운터.

### Fixed
- **Find 바 우측 정렬** — 헤더 우상단 Find 버튼과 정렬 일치.

---

## [0.7] - 2026-04-13

### Added
- **검색 매치 카운트** — 검색 결과에 파일명+본문 매치 총 개수 배지 표시, Matches 기준 정렬, min~max 범위 필터
- **날짜 필터** — Modified/Created 각각 from~to 범위 설정 캘린더 피커, 교차 필터 지원, Filter 토글 버튼
- **파일 타임스탬프 표시** — Modified 초 단위 표시, Created는 Modified와 다른 경우만 일자 표시
- **사이드바 반응형** — 300px 이하로 좁히면 size·created 숨기고 badge+modified만 표시 (ResizeObserver)

---

## [0.6] - 2026-04-13

### Added
- **사이드바 리사이즈** — 드래그로 좌측 패널 폭 조절 (최소 200px ~ 최대 800px)
- **파일 정렬** — Name / Size / Modified / Created 기준 정순·역순 토글
- **PDF 내보내기** — Pretendard 웹폰트 임베딩, 키보드 P 단축키, 인쇄 최적화 CSS
- **YAML frontmatter 메타데이터 카드** — `---` 블록을 스타일된 카드로 렌더링 (좌측 녹색 악센트, 배열 값 태그 뱃지)
- **KaTeX 수학 렌더링** — 인라인 `$...$` 및 블록 `$$...$$` 수식을 실제 수학 표기로 렌더링
- **파일 관리** — Rename (F2, hover ✏️) / Delete (Del, hover 🗑️), 탭 자동 업데이트
- **경로 입력 탐색** — 상단 경로 뱃지 클릭 → 폴더/파일 경로 직접 입력, MSYS2 경로 (`/e/project/...`) 자동 변환
- **미디어 뷰어** — 이미지 (PNG/JPG/GIF/SVG/WebP/BMP/AVIF), 비디오 (MP4/WebM/MOV), 오디오 (MP3/WAV/FLAC/AAC) 인라인 재생
- **미디어 줌** — 이미지·영상 스케일바 (10%~400%), Fit (윈도우 맞춤) / 1:1 (원본 크기)
- **탭 관리 강화** — Ctrl/Cmd+클릭 복수 선택, 선택 탭 일괄 닫기, Close All 버튼
- **구문 하이라이팅 추가** — YAML, CSS, HTML, SQL (키·속성·태그 색상 분리)
- **마크다운 파서 강화** — `__bold__` / `_italic_` 밑줄 문법, 이스케이프 문자 (`\*`, `\#`), HTML 인라인 태그 보존 (`<kbd>`, `<sub>`, `<sup>`), `<details>` 내부 마크다운 재귀 렌더링
- **sdv.local 커스텀 도메인** — hosts 파일 등록으로 브라우저 URL 바에서 앱 식별

### Changed
- **HR 렌더링** — `background` → `border-top`으로 변경 (Chrome 인쇄에서도 항상 표시)
- **자유 탐색** — `isPathSafe` 제한 해제 (localhost 전용 도구), 상위 폴더 이동 자유

### Fixed
- **사이드바 토글 버그** — 리사이즈 후 inline style이 collapse를 방해하는 문제 수정

---

## [0.53] - 2026-02-26

### Added
- **Windows Explorer 컨텍스트 메뉴** — 파일 우클릭 → "SDV로 읽기"로 바로 열기
  - `install-context-menu.js` — 레지스트리 등록/해제 (`--uninstall` 지원)
  - `launcher.js` — 서버 상태 확인 → kill → 재시작 자동 처리
  - `~/.sdv/access.jsonl` — 파일 접근 로그 (지원/미지원 확장자 추적)

### Fixed
- **동명 파일 드래그 시 잘못된 내용 표시** — FileReader 경로(URI 미제공 환경)로 드래그할 때 같은 이름의 다른 파일이 기존 탭 내용을 그대로 보여주던 버그 수정; 드래그 시 캐시를 새 내용으로 갱신하도록 변경
- **테마/소스 보기 전환 시 스크롤 초기화** — 낮밤 모드 또는 소스 보기 토글 시 스크롤이 문서 맨 위로 리셋되던 버그 수정; 현재 스크롤 비율을 저장 후 재렌더링 시 복원

---

## [0.52] - 2026-02-24

### Added
- **Drag & Drop to open files** — drag any supported file from Windows Explorer (or any OS file manager) onto the SDV browser window; the file opens instantly as a tab
  - Blue dashed overlay appears when hovering a file over the window
  - Files inside the current root: sidebar navigates to the file's directory
  - Files outside the current root: server root is updated via `/api/chroot`, sidebar reloads
  - Fallback via FileReader API for browsers that block OS file paths (Chrome security)
- **Direct file opening from CLI** — pass a file path as a positional argument to open it directly on startup
  - `node server.js README.md` — opens a file in the current directory
  - `node server.js docs/report.md` — opens by relative path
  - `node server.js /absolute/path.md` — opens by absolute path
  - Server root is automatically set to the file's parent directory
- **Inline image rendering in Markdown** — relative image paths (`![](img/foo.gif)`) now resolve correctly via the new `/api/image` endpoint
- **New API endpoints**:
  - `GET /api/image?path=...` — serves image files (GIF, PNG, JPG, SVG, WebP) with correct MIME types and caching headers
  - `GET /api/chroot?path=...` — dynamically updates the server root directory (used by drag & drop)

### Fixed
- **Inline code HTML escaping** — backtick code spans (`` `<details>` ``, `` `<kbd>` ``) now escape HTML entities correctly; previously the raw HTML tags were injected into the DOM
- **Section link navigation** — clicking `[text](#heading-anchor)` links inside rendered Markdown now scrolls smoothly to the target heading instead of reloading the SPA; headings automatically receive anchor `id` attributes using GitHub-compatible slugification (supports Korean, Latin, and other Unicode characters)

---

## [0.51] - 2026-02-15

### Added
- **Smart startup** — detects if port 3000 is in use, kills the existing process, and restarts automatically
- **Browser auto-open** — launches the default browser on startup (`--no-open` flag to disable)
- UI title renamed to **SDV — Simple Doc Viewer**

---

## [0.5] - 2026-02-10

### Added
- Initial release
- File tree browser with folder navigation and hidden file toggle
- Markdown rendering (custom parser — no external libraries)
  - Headings, bold, italic, strikethrough, inline code
  - Ordered/unordered/nested lists, checklists
  - Tables with column alignment, blockquotes, footnotes
  - `<details>/<summary>`, `<kbd>`, horizontal rules
- Syntax highlighting for 13+ languages (JS, TS, Python, Bash, CSS, HTML, JSON, YAML, SQL, Go, Rust, C/C++, Java) with line numbers
- Mermaid diagram rendering (9 types; auto-downloaded on first run, served locally)
- Day/Night theme toggle (keyboard: `T`)
- Split View — side-by-side Markdown source and rendered output with proportional scroll sync (keyboard: `S`)
- Tab system — open multiple files, switch between tabs, close with `×`
- Collapsible sidebar (keyboard: `B`)
- Word wrap toggle (keyboard: `W`)
- Keyboard shortcuts help modal (keyboard: `?`)
- Status bar — total line count and scroll position percentage
- File name filter (real-time search)
- Extension badges with color coding
- Zero npm dependencies — Node.js built-in modules only
- Localhost-only binding (`127.0.0.1`) with path traversal prevention
