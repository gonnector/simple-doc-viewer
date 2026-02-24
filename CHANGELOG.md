# Changelog

All notable changes to Simple Doc Viewer are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

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
