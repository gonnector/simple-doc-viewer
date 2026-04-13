# Changelog

All notable changes to Simple Doc Viewer are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

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
