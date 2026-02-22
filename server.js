// ============================================================
// Simple Doc Viewer — server.js
// 경량 로컬 문서 뷰어 (Node.js 내장 모듈만 사용, npm 의존성 없음)
// ============================================================

// === [1] 모듈 & 설정 ===
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const https = require('https');
const { exec, execSync } = require('child_process');

const args = process.argv.slice(2);
let PORT = 3000;
let ROOT_DIR = process.cwd();
let NO_OPEN = false;

for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--port' || args[i] === '-p') && args[i + 1]) {
    PORT = parseInt(args[i + 1]); i++;
  } else if ((args[i] === '--root' || args[i] === '-r') && args[i + 1]) {
    ROOT_DIR = path.resolve(args[i + 1]); i++;
  } else if (args[i] === '--no-open') {
    NO_OPEN = true;
  }
}

ROOT_DIR = ROOT_DIR.replace(/\\/g, '/');

const TEXT_EXTENSIONS = new Set([
  'md', 'txt', 'js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs',
  'json', 'yaml', 'yml', 'toml', 'cfg', 'ini', 'conf',
  'env', 'gitignore', 'dockerignore', 'editorconfig',
  'prettierrc', 'eslintrc', 'babelrc',
  'html', 'htm', 'css', 'scss', 'less', 'xml', 'svg',
  'sh', 'bash', 'zsh', 'fish', 'bat', 'cmd', 'ps1',
  'py', 'rb', 'java', 'c', 'cpp', 'h', 'hpp', 'cs',
  'go', 'rs', 'php', 'sql', 'r', 'swift', 'kt',
  'makefile', 'dockerfile', 'log', 'csv', 'tsv',
  'properties', 'gradle', 'lock', 'map',
  'vue', 'svelte', 'astro'
]);

const KNOWN_TEXT_FILES = new Set([
  'makefile', 'dockerfile', 'license', 'readme', 'changelog',
  'gemfile', 'rakefile', 'procfile', 'vagrantfile',
  '.gitignore', '.dockerignore', '.editorconfig', '.env',
  '.npmrc', '.yarnrc', '.nvmrc', '.prettierrc', '.eslintrc',
  '.babelrc', '.browserslistrc'
]);

const HIDDEN_NAMES = new Set([
  'node_modules', '.git', '.svn', '.hg', '.DS_Store',
  'Thumbs.db', '.idea', '.vscode', '__pycache__',
  '.cache', '.npm', '.yarn', 'dist', 'build', '.next',
  '.nuxt', 'coverage', '.env.local', '.env.production'
]);

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

// === [2] 유틸리티 함수 ===
function isTextFile(filePath) {
  const base = path.basename(filePath).toLowerCase();
  if (KNOWN_TEXT_FILES.has(base)) return true;
  const ext = path.extname(filePath).slice(1).toLowerCase();
  if (!ext) return false;
  return TEXT_EXTENSIONS.has(ext);
}

function isPathSafe(requestedPath) {
  const resolved = requestedPath.replace(/\\/g, '/');
  return resolved === ROOT_DIR || resolved.startsWith(ROOT_DIR + '/');
}

function isHiddenFile(name) {
  return name.startsWith('.') || HIDDEN_NAMES.has(name);
}

function sendJSON(res, data, status) {
  status = status || 200;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache'
  });
  res.end(JSON.stringify(data));
}

function sendError(res, message, status) {
  sendJSON(res, { error: message }, status || 400);
}

// === [3] Mermaid 자동 다운로드 ===
function downloadMermaid() {
  const libDir = path.join(__dirname, 'lib');
  const mermaidPath = path.join(libDir, 'mermaid.min.js');

  if (fs.existsSync(mermaidPath)) return;

  console.log('Downloading mermaid.min.js from CDN...');
  if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });

  const cdnUrl = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';

  function download(targetUrl, redirectCount) {
    if (redirectCount > 5) {
      console.warn('Warning: Too many redirects, mermaid download failed.');
      return;
    }
    https.get(targetUrl, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, redirectCount + 1);
      }
      if (res.statusCode !== 200) {
        console.warn('Warning: Mermaid download failed (HTTP ' + res.statusCode + '). Diagrams will not render.');
        res.resume();
        return;
      }
      const ws = fs.createWriteStream(mermaidPath);
      res.pipe(ws);
      ws.on('finish', function () {
        ws.close();
        console.log('mermaid.min.js downloaded successfully.');
      });
      ws.on('error', function () {
        console.warn('Warning: Mermaid download failed. Diagrams will not render.');
        try { fs.unlinkSync(mermaidPath); } catch (e) { /* ignore */ }
      });
    }).on('error', function () {
      console.warn('Warning: Mermaid download failed (network error). Diagrams will not render.');
    });
  }

  download(cdnUrl, 0);
}

// === [4] API 핸들러 ===
function handleList(req, res, query) {
  const dirPath = (query.path || ROOT_DIR).replace(/\\/g, '/');
  const resolved = path.resolve(dirPath).replace(/\\/g, '/');

  if (!isPathSafe(resolved)) {
    return sendError(res, 'Access denied', 403);
  }

  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return sendError(res, 'Not a directory');
    }

    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const items = [];

    for (const entry of entries) {
      const fullPath = path.join(resolved, entry.name);
      try {
        const entryStat = fs.statSync(fullPath);
        const item = {
          name: entry.name,
          type: entry.isDirectory() ? 'dir' : 'file',
          modified: entryStat.mtime.toISOString(),
          hidden: isHiddenFile(entry.name)
        };
        if (!entry.isDirectory()) {
          item.size = entryStat.size;
        }
        items.push(item);
      } catch (e) {
        // 접근 불가 파일 무시
      }
    }

    items.sort(function (a, b) {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const parentDir = path.dirname(resolved).replace(/\\/g, '/');
    const parentSafe = (parentDir !== resolved && isPathSafe(parentDir)) ? parentDir : null;
    sendJSON(res, {
      path: resolved,
      parent: parentSafe,
      items: items
    });
  } catch (e) {
    sendError(res, 'Cannot read directory: ' + e.message);
  }
}

function handleRead(req, res, query) {
  if (!query.path) return sendError(res, 'Path required');
  const filePath = path.resolve(query.path).replace(/\\/g, '/');

  if (!isPathSafe(filePath)) {
    return sendError(res, 'Access denied', 403);
  }

  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) return sendError(res, 'Is a directory');

    const name = path.basename(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();

    if (stat.size > MAX_FILE_SIZE) {
      return sendJSON(res, {
        path: filePath, name: name, ext: ext,
        size: stat.size, content: null,
        error: 'File too large (max 1MB). Size: ' + (stat.size / 1024 / 1024).toFixed(1) + 'MB'
      });
    }

    if (!isTextFile(filePath)) {
      return sendJSON(res, {
        path: filePath, name: name, ext: ext,
        size: stat.size, content: null,
        error: 'Binary file — preview not available'
      });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    sendJSON(res, {
      path: filePath, name: name, ext: ext,
      size: stat.size, content: content
    });
  } catch (e) {
    sendError(res, 'Cannot read file: ' + e.message);
  }
}

// === [5] HTML 프론트엔드 ===
function getHTML() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Doc Viewer</title>
<style>
  :root {
    --bg: #0e1117;
    --sidebar-bg: #161b22;
    --content-bg: #0d1117;
    --border: #30363d;
    --text: #e6edf3;
    --text-dim: #8b949e;
    --accent: #58a6ff;
    --accent2: #7ee787;
    --accent3: #d2a8ff;
    --hover: #1c2128;
    --selected: #1f2937;
    --badge-md: #3fb950;
    --badge-json: #f0883e;
    --badge-ts: #3178c6;
    --badge-js: #f1e05a;
    --badge-yaml: #cb171e;
    --badge-docker: #2496ed;
    --badge-py: #3572a5;
    --badge-html: #e34c26;
    --badge-css: #563d7c;
    --badge-text: #8b949e;
    --code-bg: #161b22;
    --scrollbar: #30363d;
    --scrollbar-hover: #484f58;
  }

  body.light-mode {
    --bg: #ffffff;
    --sidebar-bg: #f6f8fa;
    --content-bg: #ffffff;
    --border: #d0d7de;
    --text: #1f2328;
    --text-dim: #656d76;
    --accent: #0969da;
    --accent2: #1a7f37;
    --accent3: #8250df;
    --hover: #f3f4f6;
    --selected: #e8eaed;
    --badge-md: #1a7f37;
    --badge-json: #bc4c00;
    --badge-ts: #3178c6;
    --badge-js: #b08800;
    --badge-yaml: #cb171e;
    --badge-docker: #2496ed;
    --badge-py: #3572a5;
    --badge-html: #e34c26;
    --badge-css: #563d7c;
    --badge-text: #656d76;
    --code-bg: #f6f8fa;
    --scrollbar: #d0d7de;
    --scrollbar-hover: #afb8c1;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
    background: var(--bg);
    color: var(--text);
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Header */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: var(--sidebar-bg);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .header-left { display: flex; align-items: center; gap: 10px; }
  .header h1 { font-size: 14px; font-weight: 600; color: var(--accent); letter-spacing: -0.01em; }
  .path-badge {
    font-size: 11px;
    color: var(--text-dim);
    background: var(--bg);
    padding: 2px 8px;
    border-radius: 4px;
    font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
    max-width: 500px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .header-right { display: flex; gap: 6px; align-items: center; }
  .header-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 3px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 11px;
    transition: all 0.15s;
    user-select: none;
  }
  .header-btn:hover { color: var(--text); border-color: var(--text-dim); }
  .header-btn.active { color: var(--accent); border-color: var(--accent); background: rgba(88,166,255,0.1); }

  /* Main layout */
  .main { display: flex; flex: 1; overflow: hidden; }

  /* Sidebar */
  .sidebar {
    width: 280px;
    min-width: 280px;
    background: var(--sidebar-bg);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .sidebar-header {
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .sidebar-header input {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 12px;
    outline: none;
  }
  .sidebar-header input:focus { border-color: var(--accent); }
  .sidebar-header input::placeholder { color: var(--text-dim); }

  .file-tree { flex: 1; overflow-y: auto; padding: 4px 0; }

  .tree-item {
    display: flex;
    align-items: center;
    padding: 3px 12px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.1s;
    gap: 6px;
    user-select: none;
    white-space: nowrap;
  }
  .tree-item:hover { background: var(--hover); }
  .tree-item.selected { background: var(--selected); color: var(--accent); }
  .tree-item.dir-item { color: var(--text-dim); }
  .tree-item .icon { width: 16px; text-align: center; flex-shrink: 0; font-size: 12px; }
  .tree-item .name { flex: 1; overflow: hidden; text-overflow: ellipsis; }
  .tree-item .badge {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    font-weight: 600;
    text-transform: uppercase;
    flex-shrink: 0;
    opacity: 0.8;
  }
  .tree-item .size {
    font-size: 10px;
    color: var(--text-dim);
    flex-shrink: 0;
    opacity: 0.6;
  }
  .tree-item.parent-dir { border-bottom: 1px solid var(--border); margin-bottom: 2px; padding-bottom: 5px; }

  /* Content area */
  .content-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

  .content-tabs {
    display: flex;
    align-items: center;
    background: var(--sidebar-bg);
    border-bottom: 1px solid var(--border);
    padding: 0 8px;
    flex-shrink: 0;
    overflow-x: auto;
    min-height: 0;
  }
  .content-tabs:empty { display: none; }

  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    font-size: 12px;
    color: var(--text-dim);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--text); border-bottom-color: var(--accent); }
  .tab .tab-close {
    width: 16px; height: 16px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 3px;
    font-size: 10px;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .tab:hover .tab-close { opacity: 0.6; }
  .tab .tab-close:hover { opacity: 1; background: var(--border); }

  .content-body { flex: 1; overflow-y: auto; padding: 24px 32px; }

  /* Welcome screen */
  .welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-dim);
    gap: 12px;
  }
  .welcome .icon-large { font-size: 48px; opacity: 0.3; }
  .welcome h2 { font-size: 16px; font-weight: 500; }
  .welcome p { font-size: 13px; }
  .welcome .keys { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; justify-content: center; }
  .welcome kbd {
    background: var(--sidebar-bg);
    border: 1px solid var(--border);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-family: monospace;
  }

  /* Error display */
  .error-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 60%;
    color: var(--text-dim);
    gap: 12px;
    text-align: center;
  }
  .error-display .icon-large { font-size: 48px; opacity: 0.3; }
  .error-display p { font-size: 13px; max-width: 400px; }

  /* Markdown rendered */
  .md-rendered { line-height: 1.75; max-width: 860px; }
  .md-rendered h1 { font-size: 1.8em; font-weight: 700; margin: 1.5em 0 0.5em; padding-bottom: 0.3em; border-bottom: 2px solid var(--accent); }
  .md-rendered h2 { font-size: 1.4em; font-weight: 600; margin: 2em 0 0.5em; padding-bottom: 0.25em; border-bottom: 1px solid var(--border); color: var(--accent); }
  .md-rendered h3 { font-size: 1.15em; font-weight: 600; margin: 1.2em 0 0.4em; }
  .md-rendered h4 { font-size: 1em; font-weight: 600; margin: 1em 0 0.3em; color: var(--accent3); }
  .md-rendered h5 { font-size: 0.9em; font-weight: 600; margin: 0.8em 0 0.3em; }
  .md-rendered h6 { font-size: 0.85em; font-weight: 600; margin: 0.8em 0 0.3em; color: var(--text-dim); }
  .md-rendered p { margin: 0.6em 0; }
  .md-rendered strong { font-weight: 700; color: #fff; }
  .md-rendered em { font-style: italic; }
  .md-rendered del { text-decoration: line-through; color: var(--text-dim); }
  .md-rendered a { color: var(--accent); text-decoration: none; }
  .md-rendered a:hover { text-decoration: underline; }
  .md-rendered code:not(pre code) {
    background: rgba(110,118,129,0.2);
    color: #ff7b72;
    padding: 0.15em 0.4em;
    border-radius: 4px;
    font-size: 0.88em;
    font-family: 'Cascadia Code','Fira Code',Consolas,monospace;
  }
  .md-rendered pre {
    background: var(--code-bg);
    border: 1px solid var(--border);
    padding: 14px 18px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 0.8em 0;
    font-size: 13px;
    line-height: 1.55;
    position: relative;
  }
  .md-rendered pre code {
    font-family: 'Cascadia Code','Fira Code',Consolas,monospace;
    background: none; color: var(--text); padding: 0;
  }
  .md-rendered pre[data-lang]::after {
    content: attr(data-lang);
    position: absolute; top: 6px; right: 10px;
    font-size: 10px; color: var(--text-dim);
    text-transform: uppercase; font-family: sans-serif;
  }
  .md-rendered blockquote {
    border-left: 3px solid var(--accent);
    padding: 8px 16px;
    margin: 0.8em 0;
    color: var(--text-dim);
    background: rgba(88,166,255,0.05);
    border-radius: 0 6px 6px 0;
  }
  .md-rendered blockquote blockquote { border-left-color: var(--accent3); }
  .md-rendered hr { border: none; height: 1px; background: linear-gradient(to right, transparent, var(--border), transparent); margin: 1.5em 0; }
  .md-rendered ul, .md-rendered ol { padding-left: 1.6em; margin: 0.5em 0; }
  .md-rendered li { margin: 0.25em 0; }
  .md-rendered li::marker { color: var(--accent); }
  .md-rendered .task-list-item { list-style: none; margin-left: -1.3em; }
  .md-rendered .task-list-item input[type="checkbox"] { margin-right: 6px; accent-color: var(--accent); transform: scale(1.1); vertical-align: middle; }
  .md-rendered table { width: 100%; border-collapse: collapse; margin: 0.8em 0; font-size: 13px; }
  .md-rendered thead { background: rgba(88,166,255,0.1); }
  .md-rendered th { padding: 8px 12px; font-weight: 600; text-align: left; border-bottom: 2px solid var(--border); }
  .md-rendered td { padding: 6px 12px; border-bottom: 1px solid var(--border); }
  .md-rendered tbody tr:hover { background: rgba(88,166,255,0.03); }
  .md-rendered img { max-width: 100%; border-radius: 8px; margin: 0.5em 0; }
  .md-rendered kbd {
    background: var(--sidebar-bg); border: 1px solid var(--border);
    padding: 1px 6px; border-radius: 4px; font-size: 0.85em;
    border-bottom-width: 2px;
  }
  .md-rendered mark { background: #3d2e00; padding: 0.1em 0.3em; border-radius: 3px; }
  .md-rendered details { border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; margin: 0.8em 0; background: var(--code-bg); }
  .md-rendered details[open] { padding-bottom: 14px; }
  .md-rendered summary { cursor: pointer; font-weight: 600; color: var(--accent); }
  .md-rendered summary:hover { text-decoration: underline; }
  .md-rendered .footnotes { font-size: 0.85em; color: var(--text-dim); margin-top: 2em; border-top: 1px solid var(--border); padding-top: 1em; }
  .md-rendered .footnote-ref { font-size: 0.75em; vertical-align: super; }
  .md-rendered .math-block { text-align: center; padding: 1em; margin: 1em 0; background: var(--code-bg); border-radius: 8px; overflow-x: auto; font-family: monospace; }

  /* Syntax highlight in markdown code blocks */
  .hljs-keyword { color: #ff7b72; }
  .hljs-string, .hljs-attr { color: #a5d6ff; }
  .hljs-comment { color: #8b949e; font-style: italic; }
  .hljs-function, .hljs-title { color: #d2a8ff; }
  .hljs-number { color: #79c0ff; }
  .hljs-built_in { color: #ffa657; }

  /* Raw text view */
  .raw-view {
    font-family: 'Cascadia Code','Fira Code',Consolas,monospace;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text);
    counter-reset: line;
  }
  .raw-view.word-wrap .line-content { white-space: pre-wrap; word-break: break-all; }
  .raw-line { display: flex; min-height: 1.6em; }
  .raw-line:hover { background: rgba(88,166,255,0.04); }
  .line-num {
    display: inline-block;
    width: 44px;
    min-width: 44px;
    text-align: right;
    padding-right: 16px;
    color: var(--text-dim);
    opacity: 0.5;
    flex-shrink: 0;
    user-select: none;
    font-size: 12px;
  }
  .line-content { flex: 1; white-space: pre; }

  /* Syntax tokens for raw view */
  .tok-kw { color: #ff7b72; }
  .tok-str { color: #a5d6ff; }
  .tok-num { color: #79c0ff; }
  .tok-cm { color: #8b949e; font-style: italic; }
  .tok-fn { color: #d2a8ff; }
  .tok-op { color: #ff7b72; }
  .tok-key { color: #7ee787; }

  /* Markdown split view */
  .md-split { display: flex; height: 100%; gap: 0; }
  .md-split .md-source-panel { flex: 0 0 50%; overflow-y: auto; border-right: 1px solid var(--border); padding: 16px; }
  .md-split .md-render-panel { flex: 0 0 50%; overflow-y: auto; padding: 24px 32px; }

  /* Light mode overrides for hardcoded colors */
  body.light-mode .md-rendered strong { color: #1f2328; }
  body.light-mode .md-rendered code:not(pre code) { background: rgba(175,184,193,0.2); color: #cf222e; }
  body.light-mode .md-rendered blockquote { background: rgba(9,105,218,0.05); }
  body.light-mode .md-rendered thead { background: rgba(9,105,218,0.08); }
  body.light-mode .md-rendered tbody tr:hover { background: rgba(9,105,218,0.03); }
  body.light-mode .md-rendered mark { background: #fff8c5; color: #1f2328; }
  body.light-mode .header-btn.active { background: rgba(9,105,218,0.1); }
  body.light-mode .raw-line:hover { background: rgba(9,105,218,0.04); }
  body.light-mode .hljs-keyword { color: #cf222e; }
  body.light-mode .hljs-string, body.light-mode .hljs-attr { color: #0a3069; }
  body.light-mode .hljs-comment { color: #6e7781; }
  body.light-mode .hljs-function, body.light-mode .hljs-title { color: #8250df; }
  body.light-mode .hljs-number { color: #0550ae; }
  body.light-mode .hljs-built_in { color: #953800; }
  body.light-mode .tok-kw { color: #cf222e; }
  body.light-mode .tok-str { color: #0a3069; }
  body.light-mode .tok-num { color: #0550ae; }
  body.light-mode .tok-cm { color: #6e7781; }
  body.light-mode .tok-fn { color: #8250df; }
  body.light-mode .tok-op { color: #cf222e; }
  body.light-mode .tok-key { color: #1a7f37; }

  /* Mermaid */
  .mermaid { margin: 1em 0; text-align: center; }
  .mermaid svg { max-width: 100%; }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-hover); }

  /* Loading spinner */
  .loading { text-align: center; padding: 2em; color: var(--text-dim); }
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <h1>Doc Viewer</h1>
    <span class="path-badge" id="path-badge"></span>
  </div>
  <div class="header-right">
    <button class="header-btn" id="btn-theme" title="Toggle light/dark mode">Theme</button>
    <button class="header-btn" id="btn-source" title="Toggle markdown source view">Source</button>
    <button class="header-btn" id="btn-hidden" title="Show hidden files">Hidden</button>
    <button class="header-btn" id="btn-wrap" title="Toggle word wrap">Wrap</button>
  </div>
</div>

<div class="main">
  <div class="sidebar">
    <div class="sidebar-header">
      <input type="text" id="search-input" placeholder="Filter files...">
    </div>
    <div class="file-tree" id="file-tree"></div>
  </div>
  <div class="content-area">
    <div class="content-tabs" id="tab-bar"></div>
    <div class="content-body" id="content-body">
      <div class="welcome">
        <div class="icon-large">&#128196;</div>
        <h2>Doc Viewer</h2>
        <p>Click a file to view its contents</p>
        <div class="keys">
          <kbd>.md</kbd><kbd>.js</kbd><kbd>.ts</kbd><kbd>.json</kbd><kbd>.yaml</kbd><kbd>.py</kbd><kbd>.html</kbd><kbd>.css</kbd>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
// ================================================================
// Client-side JavaScript (no template literals — all single quotes)
// ================================================================

// --- State ---
var state = {
  currentPath: '',
  parentPath: null,
  items: [],
  openTabs: [],
  activeTab: null,
  tabCache: {},
  showHidden: false,
  wordWrap: false,
  lightMode: false,
  showSource: false,
  searchQuery: ''
};

// --- DOM refs ---
var $tree = document.getElementById('file-tree');
var $tabs = document.getElementById('tab-bar');
var $content = document.getElementById('content-body');
var $search = document.getElementById('search-input');
var $pathBadge = document.getElementById('path-badge');
var $btnTheme = document.getElementById('btn-theme');
var $btnSource = document.getElementById('btn-source');
var $btnHidden = document.getElementById('btn-hidden');
var $btnWrap = document.getElementById('btn-wrap');

// --- Helpers ---
function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getExt(name) {
  if (name === 'Dockerfile' || name === 'dockerfile') return 'dockerfile';
  if (name === 'Makefile' || name === 'makefile') return 'makefile';
  if (name === 'LICENSE' || name === 'CHANGELOG' || name === 'README') return 'txt';
  var m = name.match(/\\.([^.]+)$/);
  return m ? m[1].toLowerCase() : '';
}

function getIcon(name, isDir) {
  if (isDir) return '\\ud83d\\udcc1';
  var ext = getExt(name);
  var map = {
    md: '\\ud83d\\udcd8', json: '\\ud83d\\udce6', ts: '\\ud83d\\udd37', tsx: '\\ud83d\\udd37',
    js: '\\ud83d\\udfe1', jsx: '\\ud83d\\udfe1', py: '\\ud83d\\udc0d', rb: '\\ud83d\\udc8e',
    html: '\\ud83c\\udf10', css: '\\ud83c\\udfa8', yaml: '\\u2699\\ufe0f', yml: '\\u2699\\ufe0f',
    dockerfile: '\\ud83d\\udc33', sh: '\\ud83d\\udcbb', bash: '\\ud83d\\udcbb',
    sql: '\\ud83d\\uddc4', lock: '\\ud83d\\udd12', svg: '\\ud83d\\uddbc',
    go: '\\ud83d\\udc39', rs: '\\ud83e\\udda0', java: '\\u2615',
    env: '\\ud83d\\udd10', gitignore: '\\ud83d\\udeab'
  };
  return map[ext] || '\\ud83d\\udcc4';
}

function getBadgeColor(ext) {
  var map = {
    md: 'var(--badge-md)', json: 'var(--badge-json)',
    ts: 'var(--badge-ts)', tsx: 'var(--badge-ts)',
    js: 'var(--badge-js)', jsx: 'var(--badge-js)',
    yaml: 'var(--badge-yaml)', yml: 'var(--badge-yaml)',
    dockerfile: 'var(--badge-docker)',
    py: 'var(--badge-py)', html: 'var(--badge-html)',
    css: 'var(--badge-css)'
  };
  return map[ext] || 'var(--badge-text)';
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// --- API ---
function apiList(dirPath, callback) {
  var url = '/api/list';
  if (dirPath) url += '?path=' + encodeURIComponent(dirPath);
  fetch(url).then(function(r) { return r.json(); }).then(callback).catch(function(e) {
    callback({ error: e.message, items: [] });
  });
}

function apiRead(filePath, callback) {
  fetch('/api/read?path=' + encodeURIComponent(filePath))
    .then(function(r) { return r.json(); })
    .then(callback)
    .catch(function(e) { callback({ error: e.message }); });
}

// --- Navigation ---
function navigateTo(dirPath) {
  $search.value = '';
  state.searchQuery = '';
  apiList(dirPath, function(data) {
    if (data.error) {
      $tree.innerHTML = '<div style="padding:12px;color:var(--text-dim)">' + escHtml(data.error) + '</div>';
      return;
    }
    state.currentPath = data.path;
    state.parentPath = data.parent;
    state.items = data.items;
    $pathBadge.textContent = data.path;
    $pathBadge.title = data.path;
    renderTree();
  });
}

// --- File Tree ---
function renderTree() {
  var items = state.items;
  var q = state.searchQuery.toLowerCase();
  var html = '';

  // Parent directory link
  if (state.parentPath) {
    html += '<div class="tree-item parent-dir" data-action="navigate" data-path="' + escHtml(state.parentPath) + '">'
      + '<span class="icon">\\ud83d\\udcc1</span>'
      + '<span class="name">..</span>'
      + '</div>';
  }

  for (var i = 0; i < items.length; i++) {
    var item = items[i];

    // Hidden file filter
    if (!state.showHidden && item.hidden) continue;
    // Search filter
    if (q && item.name.toLowerCase().indexOf(q) === -1) continue;

    var isDir = item.type === 'dir';
    var ext = isDir ? '' : getExt(item.name);
    var icon = getIcon(item.name, isDir);
    var fullPath = state.currentPath + '/' + item.name;
    var isActive = state.activeTab === fullPath;
    var badgeColor = getBadgeColor(ext);

    html += '<div class="tree-item' + (isDir ? ' dir-item' : '') + (isActive ? ' selected' : '') + '"'
      + ' data-action="' + (isDir ? 'navigate' : 'open') + '"'
      + ' data-path="' + escHtml(fullPath) + '"'
      + ' data-name="' + escHtml(item.name) + '"'
      + ' title="' + escHtml(item.name) + '">'
      + '<span class="icon">' + icon + '</span>'
      + '<span class="name">' + escHtml(item.name) + '</span>';

    if (ext && !isDir) {
      html += '<span class="badge" style="color:' + badgeColor + ';border:1px solid ' + badgeColor + '">' + ext + '</span>';
    }
    if (item.size !== undefined) {
      html += '<span class="size">' + formatSize(item.size) + '</span>';
    }
    html += '</div>';
  }

  $tree.innerHTML = html;
}

// Tree click handler (event delegation)
$tree.addEventListener('click', function(e) {
  var el = e.target.closest('.tree-item');
  if (!el) return;
  var action = el.dataset.action;
  var p = el.dataset.path;
  if (action === 'navigate') {
    navigateTo(p);
  } else if (action === 'open') {
    openFile(p, el.dataset.name);
  }
});

// --- Tabs ---
function openFile(filePath, fileName) {
  // Already open? Just activate
  if (state.openTabs.indexOf(filePath) !== -1) {
    activateTab(filePath);
    return;
  }

  // Add tab
  state.openTabs.push(filePath);
  state.tabCache[filePath] = { name: fileName, ext: getExt(fileName), data: null, loading: true };
  activateTab(filePath);

  // Fetch file
  apiRead(filePath, function(data) {
    state.tabCache[filePath].data = data;
    state.tabCache[filePath].loading = false;
    if (state.activeTab === filePath) {
      renderContent();
    }
  });
}

function activateTab(filePath) {
  state.activeTab = filePath;
  renderTabs();
  renderContent();
  renderTree(); // update selection highlight
}

function closeTab(filePath, evt) {
  if (evt) { evt.stopPropagation(); evt.preventDefault(); }
  var idx = state.openTabs.indexOf(filePath);
  if (idx === -1) return;
  state.openTabs.splice(idx, 1);
  delete state.tabCache[filePath];

  if (state.activeTab === filePath) {
    if (state.openTabs.length > 0) {
      // Activate adjacent tab
      var newIdx = Math.min(idx, state.openTabs.length - 1);
      state.activeTab = state.openTabs[newIdx];
    } else {
      state.activeTab = null;
    }
  }
  renderTabs();
  renderContent();
  renderTree();
}

function renderTabs() {
  if (state.openTabs.length === 0) {
    $tabs.innerHTML = '';
    return;
  }
  var html = '';
  for (var i = 0; i < state.openTabs.length; i++) {
    var p = state.openTabs[i];
    var tab = state.tabCache[p];
    var name = tab ? tab.name : p.split('/').pop();
    var isActive = p === state.activeTab;
    html += '<div class="tab' + (isActive ? ' active' : '') + '" data-path="' + escHtml(p) + '">'
      + '<span>' + escHtml(name) + '</span>'
      + '<span class="tab-close" data-close="' + escHtml(p) + '">&#10005;</span>'
      + '</div>';
  }
  $tabs.innerHTML = html;
}

// Tab click handler (event delegation)
$tabs.addEventListener('click', function(e) {
  var closeEl = e.target.closest('[data-close]');
  if (closeEl) {
    closeTab(closeEl.dataset.close, e);
    return;
  }
  var tabEl = e.target.closest('.tab');
  if (tabEl) {
    activateTab(tabEl.dataset.path);
  }
});

// --- Content rendering ---
function renderContent() {
  if (!state.activeTab) {
    showWelcome();
    return;
  }
  var tab = state.tabCache[state.activeTab];
  if (!tab) { showWelcome(); return; }
  if (tab.loading) {
    $content.innerHTML = '<div class="loading">Loading...</div>';
    return;
  }
  var data = tab.data;
  if (!data) { showWelcome(); return; }

  if (data.error) {
    $content.innerHTML = '<div class="error-display">'
      + '<div class="icon-large">&#128683;</div>'
      + '<h2>' + escHtml(data.name || 'Error') + '</h2>'
      + '<p>' + escHtml(data.error) + '</p>'
      + '</div>';
    return;
  }

  if (data.ext === 'md') {
    if (state.showSource) {
      $content.innerHTML = '<div class="md-split">'
        + '<div class="md-source-panel">'
        + '<div class="raw-view' + (state.wordWrap ? ' word-wrap' : '') + '">'
        + renderRaw(data.content, 'md')
        + '</div></div>'
        + '<div class="md-render-panel">'
        + '<div class="md-rendered">' + md.parse(data.content) + '</div>'
        + '</div></div>';
      $content.scrollTop = 0;
      setupSplitSync();
    } else {
      $content.innerHTML = '<div class="md-rendered">' + md.parse(data.content) + '</div>';
      $content.scrollTop = 0;
    }
    renderMermaidBlocks();
  } else {
    $content.innerHTML = '<div class="raw-view' + (state.wordWrap ? ' word-wrap' : '') + '">' + renderRaw(data.content, data.ext) + '</div>';
    $content.scrollTop = 0;
  }
}

function showWelcome() {
  $content.innerHTML = '<div class="welcome">'
    + '<div class="icon-large">&#128196;</div>'
    + '<h2>Doc Viewer</h2>'
    + '<p>Click a file to view its contents</p>'
    + '<div class="keys">'
    + '<kbd>.md</kbd><kbd>.js</kbd><kbd>.ts</kbd><kbd>.json</kbd><kbd>.yaml</kbd><kbd>.py</kbd><kbd>.html</kbd><kbd>.css</kbd>'
    + '</div></div>';
}

// --- Markdown Parser ---
var md = (function() {

  function highlightCode(code, lang) {
    var escaped = escHtml(code);
    var kwSets = {
      javascript: /\\b(function|const|let|var|return|if|else|for|while|class|new|this|import|export|from|of|in|typeof|instanceof|async|await|try|catch|throw|switch|case|break|continue|default|yield|delete|void|null|undefined|true|false)\\b/g,
      python: /\\b(def|class|return|if|elif|else|for|while|import|from|as|with|try|except|raise|in|not|and|or|is|None|True|False|self|lambda|yield|pass|break|continue|finally|global|nonlocal|assert|del)\\b/g,
      bash: /\\b(echo|for|do|done|if|then|fi|else|elif|in|function|local|export|source|cd|ls|mkdir|rm|cp|mv|cat|grep|awk|sed|chmod|chown|while|case|esac|read|shift|set|unset)\\b/g,
      go: /\\b(func|var|const|type|struct|interface|return|if|else|for|range|switch|case|break|continue|default|package|import|defer|go|chan|select|map|make|new|nil|true|false)\\b/g,
      rust: /\\b(fn|let|mut|const|if|else|for|while|loop|match|return|struct|enum|impl|trait|pub|use|mod|self|super|crate|where|async|await|move|unsafe|extern|type|true|false|None|Some|Ok|Err)\\b/g
    };
    // Normalize language aliases
    var langMap = { js: 'javascript', ts: 'javascript', jsx: 'javascript', tsx: 'javascript', mjs: 'javascript', cjs: 'javascript', sh: 'bash', zsh: 'bash' };
    var normLang = langMap[lang] || lang;

    var tokens = [];
    var tokenIdx = 0;
    function tok(match, cls) {
      var ph = '\\x00T' + (tokenIdx++) + '\\x00';
      tokens.push({ ph: ph, html: '<span class="hljs-' + cls + '">' + match + '</span>' });
      return ph;
    }

    // Comments
    var cmRe = { javascript: /(\\/\\/.*$|\\/\\*[\\s\\S]*?\\*\\/)/gm, python: /(#.*$|"""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\')/gm, bash: /(#.*$)/gm, go: /(\\/\\/.*$|\\/\\*[\\s\\S]*?\\*\\/)/gm, rust: /(\\/\\/.*$|\\/\\*[\\s\\S]*?\\*\\/)/gm };
    if (cmRe[normLang]) { escaped = escaped.replace(cmRe[normLang], function(m) { return tok(m, 'comment'); }); }

    // Strings
    if (normLang !== 'json') {
      escaped = escaped.replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;|&#39;(?:[^&]|&(?!#39;))*?&#39;)/g, function(m) { return tok(m, 'string'); });
    }

    // JSON special handling
    if (lang === 'json') {
      escaped = escaped.replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)\\s*:/g, function(m) { return tok(m, 'attr'); });
      escaped = escaped.replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)/g, function(m) { return tok(m, 'string'); });
      escaped = escaped.replace(/\\b(true|false|null)\\b/g, function(m) { return tok(m, 'keyword'); });
    }

    // Keywords
    if (kwSets[normLang]) { escaped = escaped.replace(kwSets[normLang], function(m) { return tok(m, 'keyword'); }); }

    // Numbers
    escaped = escaped.replace(/\\b(\\d+\\.?\\d*)\\b/g, function(m) { return tok(m, 'number'); });

    // Restore tokens
    for (var t = 0; t < tokens.length; t++) {
      escaped = escaped.replace(tokens[t].ph, tokens[t].html);
    }
    return escaped;
  }

  function inlineFormat(text) {
    // Images
    text = text.replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g, '<img src="$2" alt="$1" loading="lazy">');
    // Links
    text = text.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // Auto links
    text = text.replace(/(^|[^"=])((https?:\\/\\/)[^\\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    // Bold italic
    text = text.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g, '<strong><em>$1</em></strong>');
    // Bold
    text = text.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
    // Italic
    text = text.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
    // Strikethrough
    text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
    // Highlight
    text = text.replace(/==(.+?)==/g, '<mark>$1</mark>');
    // Inline code
    text = text.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
    // Footnote refs
    text = text.replace(/\\[\\^(\\d+)\\]/g, '<sup class="footnote-ref"><a href="#fn$1" id="fnref$1">[$1]</a></sup>');
    return text;
  }

  function buildList(listLines) {
    var html = '';
    var stack = [];

    for (var j = 0; j < listLines.length; j++) {
      var line = listLines[j];
      var cm = line.match(/^(\\s*)[-*]\\s+\\[([ xX])\\]\\s+(.+)/);
      var um = !cm ? line.match(/^(\\s*)[-*+]\\s+(.+)/) : null;
      var om = (!cm && !um) ? line.match(/^(\\s*)\\d+\\.\\s+(.+)/) : null;
      if (!cm && !um && !om) continue;

      var indent = (cm || um || om)[1].length;
      var type = om ? 'ol' : 'ul';
      var content = cm ? cm[3] : (um ? um[2] : om[2]);

      // Close deeper levels
      while (stack.length > 0 && indent < stack[stack.length - 1].indent) {
        html += '</li></' + stack.pop().type + '>';
      }

      if (stack.length === 0) {
        html += '<' + type + '>';
        stack.push({ type: type, indent: indent });
      } else if (indent > stack[stack.length - 1].indent) {
        html += '<' + type + '>';
        stack.push({ type: type, indent: indent });
      } else {
        html += '</li>';
      }

      if (cm) {
        var chk = cm[2] !== ' ' ? ' checked disabled' : ' disabled';
        html += '<li class="task-list-item"><input type="checkbox"' + chk + '>' + inlineFormat(content);
      } else {
        html += '<li>' + inlineFormat(content);
      }
    }

    // Close remaining
    if (stack.length > 0) html += '</li>';
    while (stack.length > 0) {
      html += '</' + stack.pop().type + '>';
    }
    return html;
  }

  function parse(src) {
    var lines = src.split('\\n');
    var html = '';
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      // Code block
      var codeMatch = line.match(/^\`\`\`(\\w*)/);
      if (codeMatch) {
        var lang = codeMatch[1] || '';
        var code = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('\`\`\`')) {
          code.push(lines[i]); i++;
        }
        i++; // skip closing
        var codeStr = code.join('\\n');
        var highlighted = (lang && ['javascript','js','ts','tsx','jsx','python','py','bash','sh','json','go','rust','rs'].indexOf(lang) !== -1)
          ? highlightCode(codeStr, lang) : escHtml(codeStr);
        html += '<pre' + (lang ? ' data-lang="' + lang + '"' : '') + '><code>' + highlighted + '</code></pre>';
        continue;
      }

      // Math block
      if (line.trim() === '$$') {
        var math = [];
        i++;
        while (i < lines.length && lines[i].trim() !== '$$') { math.push(lines[i]); i++; }
        i++;
        html += '<div class="math-block"><code>' + escHtml(math.join('\\n')) + '</code></div>';
        continue;
      }

      // Heading
      var hMatch = line.match(/^(#{1,6})\\s+(.+)/);
      if (hMatch) {
        var lvl = hMatch[1].length;
        html += '<h' + lvl + '>' + inlineFormat(hMatch[2]) + '</h' + lvl + '>';
        i++; continue;
      }

      // HR
      if (line.match(/^(\\*{3,}|-{3,}|_{3,})\\s*$/)) {
        html += '<hr>';
        i++; continue;
      }

      // Table
      if (line.indexOf('|') !== -1 && i + 1 < lines.length && lines[i+1].match(/^\\|?\\s*:?-+:?\\s*\\|/)) {
        var headers = line.split('|').filter(function(c) { return c.trim(); }).map(function(c) { return c.trim(); });
        var alignLine = lines[i+1].split('|').filter(function(c) { return c.trim(); }).map(function(c) { return c.trim(); });
        var aligns = alignLine.map(function(a) {
          if (a.charAt(0) === ':' && a.charAt(a.length-1) === ':') return 'center';
          if (a.charAt(a.length-1) === ':') return 'right';
          return 'left';
        });
        html += '<table><thead><tr>';
        for (var hi = 0; hi < headers.length; hi++) {
          html += '<th style="text-align:' + (aligns[hi] || 'left') + '">' + inlineFormat(headers[hi]) + '</th>';
        }
        html += '</tr></thead><tbody>';
        i += 2;
        while (i < lines.length && lines[i].indexOf('|') !== -1 && !lines[i].match(/^(\\*{3,}|-{3,})/)) {
          var cells = lines[i].split('|').filter(function(c) { return c.trim(); }).map(function(c) { return c.trim(); });
          html += '<tr>';
          for (var ci = 0; ci < cells.length; ci++) {
            html += '<td style="text-align:' + (aligns[ci] || 'left') + '">' + inlineFormat(cells[ci]) + '</td>';
          }
          html += '</tr>';
          i++;
        }
        html += '</tbody></table>';
        continue;
      }

      // Blockquote
      if (line.match(/^>\\s?/)) {
        var qlines = [];
        while (i < lines.length && (lines[i].match(/^>\\s?/) || (lines[i].trim() === '' && lines[i+1] && lines[i+1].match(/^>/)))) {
          qlines.push(lines[i].replace(/^>\\s?/, '')); i++;
        }
        html += '<blockquote>' + parse(qlines.join('\\n')) + '</blockquote>';
        continue;
      }

      // List (ul, ol, checklist)
      var listCheck = line.match(/^(\\s*)[-*+]\\s+/) || line.match(/^(\\s*)\\d+\\.\\s+/);
      if (listCheck) {
        var listLines = [];
        while (i < lines.length) {
          var isLl = lines[i].match(/^(\\s*)[-*+]\\s+/) || lines[i].match(/^(\\s*)\\d+\\.\\s+/);
          if (isLl) {
            listLines.push(lines[i]); i++;
          } else if (lines[i].trim() === '' && i + 1 < lines.length) {
            var nextLl = lines[i+1].match(/^(\\s*)[-*+]\\s+/) || lines[i+1].match(/^(\\s*)\\d+\\.\\s+/);
            if (nextLl) { i++; }
            else break;
          } else break;
        }
        html += buildList(listLines);
        continue;
      }

      // Footnote definition
      var fnMatch = line.match(/^\\[\\^(\\d+)\\]:\\s+(.+)/);
      if (fnMatch) {
        html += '<div class="footnotes"><p id="fn' + fnMatch[1] + '"><sup>' + fnMatch[1] + '</sup> ' + inlineFormat(fnMatch[2]) + ' <a href="#fnref' + fnMatch[1] + '">\\u21a9</a></p></div>';
        i++; continue;
      }

      // Details/Summary (HTML pass-through)
      if (line.match(/^<(details|summary|\\/details|\\/summary)/i)) {
        html += line;
        i++; continue;
      }

      // Definition list
      if (line.match(/^:\\s+/) && html.match(/<p>[^<]+<\\/p>$/)) {
        var def = line.replace(/^:\\s+/, '');
        html = html.replace(/<p>([^<]+)<\\/p>$/, '<dt>$1</dt><dd>' + inlineFormat(def) + '</dd>');
        i++; continue;
      }

      // Empty line
      if (line.trim() === '') { i++; continue; }

      // Paragraph
      var pLines = [line];
      i++;
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].match(/^[#>|\\-*\\d\`$<]/) && !lines[i].match(/^\\[\\^/) && !lines[i].match(/^\\|/)) {
        pLines.push(lines[i]); i++;
      }
      html += '<p>' + inlineFormat(pLines.join(' ')) + '</p>';
    }

    return html;
  }

  return { parse: parse };
})();

// --- Raw Text Renderer ---
function renderRaw(content, ext) {
  var lines = content.split('\\n');
  var html = '';
  var langMap = { js: 'javascript', ts: 'javascript', jsx: 'javascript', tsx: 'javascript', mjs: 'javascript', cjs: 'javascript', sh: 'bash', zsh: 'bash' };
  var lang = langMap[ext] || ext;

  for (var idx = 0; idx < lines.length; idx++) {
    var escaped = escHtml(lines[idx]);

    // Syntax highlighting per language
    if (lang === 'javascript') {
      escaped = escaped.replace(/(\\/\\/.*$)/g, '<span class="tok-cm">$1</span>');
      escaped = escaped.replace(/(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)/g, '<span class="tok-str">$1</span>');
      escaped = escaped.replace(/\\b(import|export|from|const|let|var|function|return|if|else|for|while|class|new|default|true|false|null|undefined|async|await|try|catch|throw|of|in|switch|case|break|continue|this|typeof|instanceof|void|delete|yield)\\b/g, '<span class="tok-kw">$1</span>');
      escaped = escaped.replace(/\\b(\\d+\\.?\\d*)\\b/g, '<span class="tok-num">$1</span>');
    } else if (lang === 'json') {
      escaped = escaped.replace(/(&quot;[^&]*?&quot;)\\s*:/g, '<span class="tok-key">$1</span>:');
      escaped = escaped.replace(/:\\s*(&quot;[^&]*?&quot;)/g, ': <span class="tok-str">$1</span>');
      escaped = escaped.replace(/\\b(\\d+\\.?\\d*)\\b/g, '<span class="tok-num">$1</span>');
      escaped = escaped.replace(/\\b(true|false|null)\\b/g, '<span class="tok-kw">$1</span>');
    } else if (lang === 'yaml' || lang === 'yml') {
      escaped = escaped.replace(/(#.*$)/g, '<span class="tok-cm">$1</span>');
      escaped = escaped.replace(/^(\\s*[\\w][\\w-]*):/gm, '<span class="tok-key">$1</span>:');
    } else if (lang === 'dockerfile') {
      escaped = escaped.replace(/(#.*$)/g, '<span class="tok-cm">$1</span>');
      escaped = escaped.replace(/^(FROM|RUN|COPY|WORKDIR|EXPOSE|CMD|ENV|ARG|ENTRYPOINT|ADD|VOLUME|USER|LABEL|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL)\\b/g, '<span class="tok-kw">$1</span>');
    } else if (lang === 'python' || lang === 'py') {
      escaped = escaped.replace(/(#.*$)/g, '<span class="tok-cm">$1</span>');
      escaped = escaped.replace(/(&quot;(?:&quot;&quot;)?[^&]*?(?:&quot;&quot;)?&quot;|&#39;(?:&#39;&#39;)?[^&]*?(?:&#39;&#39;)?&#39;)/g, '<span class="tok-str">$1</span>');
      escaped = escaped.replace(/\\b(def|class|return|if|elif|else|for|while|import|from|as|with|try|except|raise|in|not|and|or|is|None|True|False|self|lambda|yield|pass|break|continue|finally|global|async|await)\\b/g, '<span class="tok-kw">$1</span>');
    } else if (lang === 'bash') {
      escaped = escaped.replace(/(#.*$)/g, '<span class="tok-cm">$1</span>');
      escaped = escaped.replace(/\\b(echo|for|do|done|if|then|fi|else|elif|in|function|local|export|source|cd|ls|mkdir|rm|cp|mv|cat|grep|awk|sed|chmod|chown|while|case|esac)\\b/g, '<span class="tok-kw">$1</span>');
    } else if (lang === 'css' || lang === 'scss' || lang === 'less') {
      escaped = escaped.replace(/(\\/\\*[\\s\\S]*?\\*\\/)/g, '<span class="tok-cm">$1</span>');
      escaped = escaped.replace(/([.#][\\w-]+)/g, '<span class="tok-fn">$1</span>');
      escaped = escaped.replace(/\\b(\\d+\\.?\\d*(px|em|rem|%|vh|vw|s|ms)?)\\b/g, '<span class="tok-num">$1</span>');
    } else if (lang === 'html' || lang === 'htm' || lang === 'xml' || lang === 'svg') {
      escaped = escaped.replace(/(&lt;\\/?[\\w-]+)/g, '<span class="tok-kw">$1</span>');
      escaped = escaped.replace(/(\\s[\\w-]+=)(&quot;[^&]*?&quot;)/g, '$1<span class="tok-str">$2</span>');
    } else if (lang === 'sql') {
      escaped = escaped.replace(/(--.*$)/g, '<span class="tok-cm">$1</span>');
      escaped = escaped.replace(/\\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|INTO|VALUES|SET|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|NULL|AS|ORDER|BY|GROUP|HAVING|LIMIT|DISTINCT|UNION|INDEX|VIEW|BEGIN|COMMIT|ROLLBACK|IN|EXISTS|BETWEEN|LIKE|IS|COUNT|SUM|AVG|MAX|MIN|CASE|WHEN|THEN|ELSE|END)\\b/gi, '<span class="tok-kw">$1</span>');
    }

    html += '<div class="raw-line"><span class="line-num">' + (idx + 1) + '</span><span class="line-content">' + (escaped || ' ') + '</span></div>';
  }
  return html;
}

// --- Settings ---
// --- Split view scroll sync ---
function setupSplitSync() {
  var srcPanel = $content.querySelector('.md-source-panel');
  var renPanel = $content.querySelector('.md-render-panel');
  if (!srcPanel || !renPanel) return;
  var syncing = false;
  srcPanel.addEventListener('scroll', function() {
    if (syncing) return;
    syncing = true;
    var srcMax = srcPanel.scrollHeight - srcPanel.clientHeight;
    var ratio = srcMax > 0 ? srcPanel.scrollTop / srcMax : 0;
    renPanel.scrollTop = ratio * (renPanel.scrollHeight - renPanel.clientHeight);
    syncing = false;
  });
  renPanel.addEventListener('scroll', function() {
    if (syncing) return;
    syncing = true;
    var renMax = renPanel.scrollHeight - renPanel.clientHeight;
    var ratio = renMax > 0 ? renPanel.scrollTop / renMax : 0;
    srcPanel.scrollTop = ratio * (srcPanel.scrollHeight - srcPanel.clientHeight);
    syncing = false;
  });
}

$btnSource.addEventListener('click', function() {
  state.showSource = !state.showSource;
  $btnSource.classList.toggle('active', state.showSource);
  if (state.activeTab) {
    var tab = state.tabCache[state.activeTab];
    if (tab && tab.data && tab.data.ext === 'md') {
      renderContent();
    }
  }
});

$btnTheme.addEventListener('click', function() {
  state.lightMode = !state.lightMode;
  $btnTheme.classList.toggle('active', state.lightMode);
  document.body.classList.toggle('light-mode', state.lightMode);
  if (mermaidLoaded && window.mermaid) {
    window.mermaid.initialize({ startOnLoad: false, theme: state.lightMode ? 'default' : 'dark' });
  }
  renderContent();
});

$btnHidden.addEventListener('click', function() {
  state.showHidden = !state.showHidden;
  $btnHidden.classList.toggle('active', state.showHidden);
  renderTree();
});

$btnWrap.addEventListener('click', function() {
  state.wordWrap = !state.wordWrap;
  $btnWrap.classList.toggle('active', state.wordWrap);
  var rv = $content.querySelector('.raw-view');
  if (rv) {
    if (state.wordWrap) rv.classList.add('word-wrap');
    else rv.classList.remove('word-wrap');
  }
});

// --- Search ---
$search.addEventListener('input', function() {
  state.searchQuery = $search.value;
  renderTree();
});

// --- Mermaid ---
var mermaidLoaded = false;

function initMermaid() {
  var script = document.createElement('script');
  script.src = '/lib/mermaid.min.js';
  script.onload = function() {
    mermaidLoaded = true;
    if (window.mermaid) {
      window.mermaid.initialize({ startOnLoad: false, theme: state.lightMode ? 'default' : 'dark' });
    }
    renderMermaidBlocks();
  };
  script.onerror = function() {
    // Mermaid not available - graceful degradation
  };
  document.head.appendChild(script);
}

function renderMermaidBlocks() {
  if (!mermaidLoaded || !window.mermaid) return;
  var blocks = $content.querySelectorAll('pre[data-lang="mermaid"]');
  if (blocks.length === 0) return;
  for (var b = 0; b < blocks.length; b++) {
    var pre = blocks[b];
    var codeEl = pre.querySelector('code');
    if (!codeEl) continue;
    var div = document.createElement('div');
    div.className = 'mermaid';
    div.textContent = codeEl.textContent;
    pre.parentNode.replaceChild(div, pre);
  }
  try { window.mermaid.run(); } catch(e) { /* ignore */ }
}

// --- Keyboard shortcuts ---
document.addEventListener('keydown', function(e) {
  // Ctrl+W or Cmd+W to close active tab
  if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
    e.preventDefault();
    if (state.activeTab) closeTab(state.activeTab);
  }
  // Ctrl+F or Cmd+F to focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    // Only intercept if not already focused on search
    if (document.activeElement !== $search) {
      e.preventDefault();
      $search.focus();
      $search.select();
    }
  }
  // Escape to clear search
  if (e.key === 'Escape') {
    $search.value = '';
    state.searchQuery = '';
    $search.blur();
    renderTree();
  }
});

// --- Init ---
navigateTo('');
initMermaid();
</script>
</body>
</html>`;
}

// === [6] 서버 시작 ===
const server = http.createServer(function (req, res) {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getHTML());
  } else if (pathname === '/api/list') {
    handleList(req, res, parsed.query);
  } else if (pathname === '/api/read') {
    handleRead(req, res, parsed.query);
  } else if (pathname === '/lib/mermaid.min.js') {
    const mermaidPath = path.join(__dirname, 'lib', 'mermaid.min.js');
    if (fs.existsSync(mermaidPath)) {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end(fs.readFileSync(mermaidPath));
    } else {
      sendError(res, 'Mermaid not available', 404);
    }
  } else {
    sendError(res, 'Not found', 404);
  }
});

// Mermaid 자동 다운로드 시작
downloadMermaid();

// --- 포트 충돌 자동 해결 & 브라우저 자동 열기 ---

function openBrowser(url) {
  if (NO_OPEN) return;
  const cmd = process.platform === 'win32' ? 'start "" "' + url + '"' :
              process.platform === 'darwin' ? 'open "' + url + '"' :
              'xdg-open "' + url + '"';
  exec(cmd, function () {});
}

function findAndKillPort(port, callback) {
  if (process.platform === 'win32') {
    exec('netstat -ano', function (err, stdout) {
      if (err) return callback(false);
      const pids = new Set();
      stdout.split('\n').forEach(function (line) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[3] === 'LISTENING') {
          const addrParts = parts[1].split(':');
          if (addrParts[addrParts.length - 1] === String(port)) {
            const pid = parts[4];
            if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
          }
        }
      });
      if (pids.size === 0) return callback(false);
      pids.forEach(function (pid) {
        console.log('  Stopping existing process (PID: ' + pid + ')...');
        try { execSync('taskkill /F /PID ' + pid, { stdio: 'ignore' }); } catch (e) {}
      });
      callback(true);
    });
  } else {
    exec('lsof -ti :' + port, function (err, stdout) {
      if (err || !stdout.trim()) return callback(false);
      stdout.trim().split('\n').forEach(function (pid) {
        console.log('  Stopping existing process (PID: ' + pid + ')...');
        try { execSync('kill -9 ' + pid); } catch (e) {}
      });
      callback(true);
    });
  }
}

function startServer() {
  server.listen(PORT, '127.0.0.1', function () {
    const serverUrl = 'http://localhost:' + PORT;
    console.log('');
    console.log('  Doc Viewer running at ' + serverUrl);
    console.log('  Root: ' + ROOT_DIR);
    console.log('');
    openBrowser(serverUrl);
  });
}

server.on('error', function (err) {
  if (err.code === 'EADDRINUSE') {
    console.log('');
    console.log('  Port ' + PORT + ' is already in use.');
    console.log('  Finding and stopping the existing process...');
    findAndKillPort(PORT, function (killed) {
      if (killed) {
        console.log('  Restarting server...');
        console.log('');
        setTimeout(startServer, 1000);
      } else {
        console.error('  Could not find the process. Please free port ' + PORT + ' manually.');
        process.exit(1);
      }
    });
  } else {
    console.error('  Server error: ' + err.message);
    process.exit(1);
  }
});

startServer();
