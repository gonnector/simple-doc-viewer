# Simple Doc Viewer

**[English](README.md) | [한국어](README_ko.md)**

A lightweight local document viewer that lets you browse and read text files and Markdown documents from your filesystem — right in the browser.

**Zero dependencies. Single file. Offline-first.**

![Browse and Render](docs/images/browse-and-render.gif)

---

## Why?

Sometimes you just want to **read** your docs — not edit them. VS Code is overkill for browsing a folder of Markdown files. Simple Doc Viewer gives you a clean, read-only interface with proper rendering, syntax highlighting, and diagrams.

- **No `npm install`** — uses only Node.js built-in modules
- **No config files** — just run `node server.js`
- **No internet needed** — runs entirely on localhost (Mermaid auto-downloads once on first run)

---

## Quick Start

### Prerequisites

- **Node.js 18+** (that's it)

### Run

```bash
# Clone the repo
git clone https://github.com/gonnector/simple-doc-viewer.git
cd simple-doc-viewer

# Start the viewer for the current directory
node server.js

# Or for a specific folder
node server.js --root /path/to/your/docs
```

The browser opens automatically. If port 3000 is already in use, the existing process is stopped and restarted.

### Command-Line Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--root <path>` | `-r` | Current directory | Root directory to browse |
| `--port <number>` | `-p` | `3000` | Server port |
| `--no-hidden` | | | Hide dotfiles by default |
| `--no-open` | | | Don't auto-open browser on start |

### Examples

```bash
# Browse your project docs
node server.js --root ~/my-project

# Use a custom port
node server.js --port 8080

# Combine options
node server.js --root ./docs --port 4000 --no-hidden
```

### Global Alias (Optional)

Add a shell alias to run it from anywhere:

**Bash / Zsh** (`~/.bashrc` or `~/.zshrc`):
```bash
sdv() {
  if [ $# -eq 0 ]; then
    node /path/to/simple-doc-viewer/server.js
  else
    node /path/to/simple-doc-viewer/server.js --root "$1"
  fi
}
```

**PowerShell** (`$PROFILE`):
```powershell
function sdv {
    param([string]$Path)
    if ($Path) {
        node "C:\path\to\simple-doc-viewer\server.js" --root $Path
    } else {
        node "C:\path\to\simple-doc-viewer\server.js"
    }
}
```

Then use it anywhere:
```bash
sdv              # current directory
sdv ~/Documents  # specific folder
```

---

## Features

### File Tree Browser

- Navigate into folders, go up with `..`
- Filter files by name in real time
- Toggle hidden files (`.git`, `node_modules`, etc.)
- Extension badges with color coding
- Folders first, alphabetical sort

### Markdown Rendering

Full-featured custom Markdown parser (no external libraries):

- Headings (h1-h6) with distinct colors
- **Bold**, *italic*, ~~strikethrough~~, `inline code`
- Ordered / unordered / nested lists (stack-based parser for arbitrary depth)
- Checklists with checkboxes
- Tables with column alignment (left, center, right)
- Blockquotes with nested levels
- Footnotes with back-references
- `<details>/<summary>` collapsible sections
- `<kbd>` keyboard tags
- Horizontal rules
- Links and images

### Syntax Highlighting

Built-in highlighter for 13+ languages:

JavaScript, TypeScript, Python, Bash, CSS, HTML, JSON, YAML, SQL, Go, Rust, C/C++, Java

Features:
- Line numbers
- Language badge on code blocks
- Keyword, string, comment, number token coloring
- Word wrap toggle

### Mermaid Diagrams

Automatically renders ` ```mermaid ` code blocks into diagrams. 9 diagram types supported:

| Type | Example |
|------|---------|
| Flowchart | `graph TD; A-->B` |
| Sequence Diagram | `sequenceDiagram; A->>B: msg` |
| Class Diagram | `classDiagram; class Animal` |
| State Diagram | `stateDiagram-v2; [*]-->Idle` |
| ER Diagram | `erDiagram; USER \|\|--o{ POST : writes` |
| Gantt Chart | `gantt; title Timeline` |
| Pie Chart | `pie; "A": 40` |
| Mindmap | `mindmap; root((Topic))` |
| Git Graph | `gitGraph; commit; branch feature` |

Mermaid.js (~2MB) is automatically downloaded on first run and served locally afterward — no CDN dependency at runtime.

![Mermaid Diagrams](docs/images/mermaid-diagrams.gif)

### Day/Night Mode

![Theme Toggle](docs/images/theme-toggle.gif)

Toggle between dark and light themes with the **Theme** button. Affects:
- All UI elements (sidebar, content, tabs, buttons)
- Syntax highlighting colors
- Mermaid diagram theme (`dark` ↔ `default`)

### Split View

![Split View](docs/images/split-view.gif)

Toggle the **Source** button on Markdown files to see:
- **Left panel**: Raw Markdown source with line numbers
- **Right panel**: Rendered Markdown

Panels scroll in sync (proportional scroll synchronization).

### Tab System

- Open multiple files as tabs
- Click to switch, `×` to close
- Auto-switch to adjacent tab on close
- Active tab highlight

---

## Architecture

```
simple-doc-viewer/
  server.js            # Everything: server + API + frontend (~2100 lines)
  lib/
    mermaid.min.js      # Auto-downloaded on first run
  reference/            # Prototypes and test documents
  docs/                 # Design docs and dev journal
```

### How It Works

```
Browser (localhost:3000)  <-->  Node.js HTTP Server  <-->  Local Filesystem
```

`server.js` serves a single-page application (SPA) as inline HTML. The frontend calls two JSON APIs to browse directories and read files. Everything runs on `127.0.0.1` — no external access.

### API Endpoints

| Method | Endpoint | Parameters | Description |
|--------|----------|------------|-------------|
| GET | `/` | — | Serves the SPA frontend |
| GET | `/api/list` | `path` (directory) | Returns directory listing as JSON |
| GET | `/api/read` | `path` (file) | Returns file content as JSON |
| GET | `/lib/mermaid.min.js` | — | Serves the Mermaid library |

---

## Security

Simple Doc Viewer is designed for **local use only**:

| Measure | Implementation |
|---------|---------------|
| **Localhost only** | Binds to `127.0.0.1` — no external access |
| **Path traversal prevention** | `path.resolve()` + `ROOT_DIR` prefix check |
| **Binary file blocking** | Extension whitelist for text files |
| **Large file limit** | Rejects files > 1MB |

> **Warning**: This tool is intended for personal, local use. Do not expose it to the internet or untrusted networks.

---

## Supported File Types

### Rendered
- `.md` — Markdown with full rendering + Mermaid diagrams

### Syntax Highlighted
- `.js`, `.ts` — JavaScript / TypeScript
- `.py` — Python
- `.sh`, `.bash` — Shell scripts
- `.css` — CSS
- `.html` — HTML
- `.json` — JSON
- `.yaml`, `.yml` — YAML
- `.sql` — SQL
- `.go` — Go
- `.rs` — Rust
- `.c`, `.cpp`, `.h` — C/C++
- `.java` — Java

### Plain Text
- `.txt`, `.log`, `.cfg`, `.env`, `.ini`, `.toml`, `.xml`, `.csv`, `.gitignore`, `.dockerfile`, and more

---

## Roadmap

- [ ] **v0.6**: LaTeX math rendering (KaTeX)
- [ ] Image preview support
- [ ] File search across directories

---

## License

[MIT](LICENSE)

---

Built with Node.js and zero external dependencies.
