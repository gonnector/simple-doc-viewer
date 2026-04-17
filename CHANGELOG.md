# Changelog

All notable changes to Simple Doc Viewer are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

---

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
