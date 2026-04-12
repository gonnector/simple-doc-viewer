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
let INITIAL_FILE = null;

for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--port' || args[i] === '-p') && args[i + 1]) {
    PORT = parseInt(args[i + 1]); i++;
  } else if ((args[i] === '--root' || args[i] === '-r') && args[i + 1]) {
    ROOT_DIR = path.resolve(args[i + 1]); i++;
  } else if (args[i] === '--no-open') {
    NO_OPEN = true;
  } else if (!args[i].startsWith('-')) {
    const p = path.resolve(args[i]);
    try {
      if (fs.statSync(p).isFile()) { INITIAL_FILE = p; ROOT_DIR = path.dirname(p); }
      else { ROOT_DIR = p; }
    } catch(e) { ROOT_DIR = p; }
  }
}

ROOT_DIR = ROOT_DIR.replace(/\\/g, '/');

// --root 가 파일 경로인 경우 처리 (기존 alias: sdv README.md → --root README.md)
if (!INITIAL_FILE) {
  try {
    if (fs.statSync(ROOT_DIR).isFile()) {
      INITIAL_FILE = ROOT_DIR;
      ROOT_DIR = path.dirname(ROOT_DIR).replace(/\\/g, '/');
    }
  } catch(e) {}
}
if (INITIAL_FILE) INITIAL_FILE = INITIAL_FILE.replace(/\\/g, '/');

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

const MEDIA_EXTENSIONS = new Set([
  // Images
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'tif', 'avif',
  // Video
  'mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv',
  // Audio
  'mp3', 'wav', 'flac', 'aac', 'opus', 'wma', 'm4a',
  // Document
  'pdf'
]);

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'tif', 'avif']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'flac', 'aac', 'opus', 'wma', 'm4a']);
const DOC_EXTS = new Set(['pdf']);

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

function isPathSafe() {
  // localhost-only tool bound to 127.0.0.1 — all local paths are safe
  return true;
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

function handlePostBody(req, callback) {
  var body = '';
  req.on('data', function(chunk) { body += chunk; });
  req.on('end', function() {
    try { callback(JSON.parse(body)); }
    catch(e) { /* ignore parse error */ }
  });
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
          created: entryStat.birthtime.toISOString(),
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
    const parentSafe = (parentDir !== resolved) ? parentDir : null;
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

// === [4b] Image 핸들러 ===
function handleImage(req, res, query) {
  if (!query.path) return sendError(res, 'Path required');
  const filePath = path.resolve(query.path).replace(/\\/g, '/');
  if (!isPathSafe(filePath)) return sendError(res, 'Access denied', 403);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const imageMimes = { gif: 'image/gif', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp', ico: 'image/x-icon', bmp: 'image/bmp', tiff: 'image/tiff', tif: 'image/tiff' };
  const mime = imageMimes[ext];
  if (!mime) return sendError(res, 'Not an image file');
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime, 'Content-Length': data.length, 'Cache-Control': 'public, max-age=3600' });
    res.end(data);
  } catch (e) {
    sendError(res, 'Cannot read image: ' + e.message, 404);
  }
}

// === [4c] Chroot 핸들러 (drag-drop용 루트 변경) ===
function handleChroot(req, res, query) {
  if (!query.path) return sendError(res, 'Path required');
  const newRoot = path.resolve(query.path).replace(/\\/g, '/');
  try {
    if (!fs.statSync(newRoot).isDirectory()) return sendError(res, 'Not a directory');
    ROOT_DIR = newRoot;
    sendJSON(res, { root: ROOT_DIR });
  } catch(e) {
    sendError(res, 'Directory not found: ' + e.message, 404);
  }
}

// === [5] HTML 프론트엔드 ===
function getHTML() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SDV - Simple Doc Viewer</title>
<link rel="stylesheet" href="/lib/katex/katex.min.css">
<script src="/lib/katex/katex.min.js"></script>
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
    --badge-img: #da8ee7;
    --badge-video: #f97583;
    --badge-audio: #56d4dd;
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
    --badge-img: #9a3fc2;
    --badge-video: #cf222e;
    --badge-audio: #0e8a8a;
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
    cursor: pointer;
    border: 1px solid transparent;
    transition: border-color 0.15s;
  }
  .path-badge:hover { border-color: var(--border); }
  .path-input {
    font-size: 11px;
    color: var(--text);
    background: var(--bg);
    padding: 2px 8px;
    border-radius: 4px;
    font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
    border: 1px solid var(--accent);
    outline: none;
    width: 500px;
    max-width: 50vw;
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
    width: 385px;
    min-width: 200px;
    background: var(--sidebar-bg);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: width 0.2s ease, min-width 0.2s ease;
  }
  .sidebar.collapsed { width: 0; min-width: 0; border-right: none; }
  .sidebar.resizing { transition: none; }
  .btn-sidebar-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: 1px solid transparent;
    color: var(--text-dim);
    cursor: pointer;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    flex-shrink: 0;
    transition: color 0.15s, background 0.15s, border-color 0.15s;
    user-select: none;
  }
  .btn-sidebar-toggle:hover {
    color: var(--text);
    background: var(--bg);
    border-color: var(--border);
  }
  .btn-sidebar-toggle svg {
    width: 14px;
    height: 14px;
    transition: transform 0.2s ease;
  }
  .btn-sidebar-toggle.collapsed svg { transform: rotate(180deg); }
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
  .tree-item .file-meta {
    display: flex; align-items: center; gap: 4px; flex-shrink: 0;
  }
  .tree-item .badge {
    font-size: 9px;
    padding: 1px 4px;
    border-radius: 3px;
    font-weight: 600;
    text-transform: uppercase;
    flex-shrink: 0;
    opacity: 0.8;
    min-width: 26px;
    text-align: center;
  }
  .tree-item .size {
    font-size: 10px;
    color: var(--text-dim);
    flex-shrink: 0;
    opacity: 0.6;
    min-width: 46px;
    text-align: right;
  }
  .tree-item .file-actions {
    display: none; gap: 2px; flex-shrink: 0; margin-left: 4px;
  }
  .tree-item:hover .file-actions { display: flex; }
  .tree-item .file-actions button {
    background: none; border: none; color: var(--text-dim); cursor: pointer;
    width: 20px; height: 20px; border-radius: 4px; padding: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; transition: all 0.1s;
  }
  .tree-item .file-actions button:hover { color: var(--text); background: var(--hover); }
  .tree-item .file-actions .btn-del:hover { color: #f85149; }
  .tree-item .rename-input {
    background: var(--bg); border: 1px solid var(--accent); color: var(--text);
    padding: 1px 6px; border-radius: 4px; font-size: 13px; outline: none;
    flex: 1; min-width: 0;
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
  .tab.multi-selected { background: rgba(88,166,255,0.12); }
  .tab-close-all {
    display: flex; align-items: center; justify-content: center;
    padding: 4px 8px; margin-left: auto; flex-shrink: 0;
    font-size: 10px; color: var(--text-dim); cursor: pointer;
    border: 1px solid transparent; border-radius: 4px; background: none;
    white-space: nowrap;
  }
  .tab-close-all:hover { color: #f85149; border-color: var(--border); }

  .content-body { flex: 1; overflow-y: auto; padding: 24px 32px; }

  /* Status bar */
  .status-bar {
    flex-shrink: 0; height: 22px;
    padding: 0 16px;
    display: flex; align-items: center; justify-content: flex-end; gap: 10px;
    background: var(--sidebar-bg);
    border-top: 1px solid var(--border);
    font-size: 11px; font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
    color: var(--text-dim); user-select: none;
  }
  .status-bar.empty { opacity: 0; pointer-events: none; }
  .status-sep { opacity: 0.3; }
  .status-pct { color: var(--accent); font-weight: 600; display: inline-block; width: 4ch; text-align: right; }

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

  /* Drop overlay */
  .drop-overlay { display: none; position: fixed; inset: 0; z-index: 9999; pointer-events: none; background: rgba(88,166,255,0.06); border: 3px dashed var(--accent); align-items: center; justify-content: center; }
  .drop-overlay.active { display: flex; }
  .drop-msg { font-size: 15px; font-weight: 600; color: var(--accent); background: var(--sidebar-bg); padding: 18px 32px; border-radius: 12px; border: 1px solid var(--accent); box-shadow: 0 4px 24px rgba(0,0,0,0.4); }

  /* Markdown rendered */
  .md-rendered { line-height: 1.75; width: 100%; }
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
  .md-rendered hr { border: none; border-top: 1px solid var(--border); height: 0; margin: 1.5em 0; }
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

  /* Media viewer */
  .media-viewer { display: flex; flex-direction: column; align-items: center; height: 100%; padding: 16px; position: relative; overflow: auto; }
  .media-viewer .media-content { flex: 1; display: flex; align-items: center; justify-content: center; overflow: auto; width: 100%; }
  .media-viewer img { max-width: 100%; max-height: calc(100vh - 180px); object-fit: contain; border-radius: 6px; transform-origin: center center; transition: transform 0.15s ease; }
  .media-viewer video { max-width: 100%; max-height: calc(100vh - 180px); border-radius: 6px; outline: none; transform-origin: center center; transition: transform 0.15s ease; }
  .media-viewer audio { width: 100%; max-width: 500px; margin-top: 40px; }
  .media-viewer .media-info { font-size: 11px; color: var(--text-dim); margin-top: 8px; flex-shrink: 0; }
  .media-viewer iframe.pdf-frame { width: 100%; height: 100%; flex: 1; border: none; border-radius: 0; }
  .media-viewer.pdf-mode { padding: 0; gap: 0; }
  .media-viewer.pdf-mode .media-content { height: 100%; }
  .media-zoom-bar {
    position: absolute; bottom: 12px; right: 16px;
    display: flex; align-items: center; gap: 6px;
    background: var(--sidebar-bg); border: 1px solid var(--border);
    padding: 4px 10px; border-radius: 8px; font-size: 11px; color: var(--text-dim);
    user-select: none; z-index: 5; opacity: 0.85;
  }
  .media-zoom-bar:hover { opacity: 1; }
  .media-zoom-bar button {
    background: none; border: none; color: var(--text-dim); cursor: pointer;
    font-size: 14px; width: 22px; height: 22px; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
  }
  .media-zoom-bar button:hover { color: var(--text); background: var(--hover); }
  .media-zoom-bar input[type="range"] {
    width: 100px; height: 4px; accent-color: var(--accent); cursor: pointer;
  }
  .media-zoom-bar .zoom-pct { min-width: 36px; text-align: center; font-family: monospace; }
  .md-rendered .frontmatter-card {
    background: var(--code-bg); border: 1px solid var(--border); border-left: 4px solid var(--accent2);
    border-radius: 4px 10px 10px 4px;
    padding: 14px 18px; margin: 0 0 1.5em; font-size: 13px;
    display: grid; grid-template-columns: auto 1fr; gap: 4px 14px; align-items: baseline;
  }
  .md-rendered .frontmatter-card .fm-key {
    color: var(--accent2); font-weight: 600; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.03em; white-space: nowrap;
  }
  .md-rendered .frontmatter-card .fm-val {
    color: var(--text); word-break: break-word;
  }
  .md-rendered .frontmatter-card .fm-val .fm-tag {
    display: inline-block; background: rgba(88,166,255,0.1); color: var(--accent);
    padding: 1px 7px; border-radius: 4px; font-size: 12px; margin: 1px 2px;
  }

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
  body.light-mode .md-rendered .frontmatter-card .fm-tag { background: rgba(9,105,218,0.1); color: #0969da; }
  body.light-mode .header-btn.active { background: rgba(9,105,218,0.1); }
  body.light-mode .sidebar-opt.active { color: #0969da; border-color: #0969da; background: rgba(9,105,218,0.08); }
  body.light-mode .btn-help:hover { color: #0969da; border-color: #0969da; background: rgba(9,105,218,0.08); }
  body.light-mode .help-kbd { background: #f6f8fa; border-color: #d0d7de; color: #1f2328; }
  body.light-mode .help-row + .help-row { border-top-color: rgba(208,215,222,0.5); }
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

  /* Theme toggle switch */
  .theme-toggle {
    display: flex; align-items: center; gap: 6px;
    background: none; border: 1px solid var(--border);
    border-radius: 20px; padding: 3px 9px;
    cursor: pointer; user-select: none;
    transition: border-color 0.15s;
  }
  .theme-toggle:hover { border-color: var(--text-dim); }
  .theme-icon {
    display: flex; align-items: center; justify-content: center;
    width: 13px; height: 13px; transition: color 0.25s; color: var(--text-dim);
  }
  .theme-icon svg { width: 13px; height: 13px; }
  .theme-track {
    position: relative; width: 26px; height: 14px;
    background: var(--border); border-radius: 7px;
    transition: background 0.25s; flex-shrink: 0;
  }
  .theme-knob {
    position: absolute; top: 2px; left: 2px;
    width: 10px; height: 10px; border-radius: 50%;
    background: #58a6ff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), background 0.25s;
  }
  body.light-mode .theme-track { background: #fde68a; }
  body.light-mode .theme-knob { transform: translateX(12px); background: #f59e0b; }
  body:not(.light-mode) .theme-moon { color: #93c5fd; }
  body.light-mode .theme-sun { color: #f59e0b; }

  /* Sidebar opts row */
  .sidebar-opts {
    padding: 5px 8px; border-bottom: 1px solid var(--border);
    display: flex; gap: 4px; flex-wrap: wrap;
  }
  .sidebar-opts .sort-sep {
    width: 1px; background: var(--border); margin: 2px 2px; align-self: stretch;
  }
  .sort-arrow { font-size: 9px; opacity: 0.5; margin-left: 1px; }
  .sidebar-opt.active .sort-arrow { opacity: 1; }

  /* Resize handle */
  .resize-handle {
    width: 4px;
    margin-left: -2px;
    margin-right: -2px;
    cursor: col-resize;
    background: transparent;
    flex-shrink: 0;
    transition: background 0.15s;
    position: relative;
    z-index: 10;
  }
  .resize-handle:hover,
  .resize-handle.dragging { background: var(--accent); }
  .sidebar.collapsed + .resize-handle { display: none; }
  .sidebar-opt {
    display: flex; align-items: center; gap: 5px;
    background: none; border: 1px solid var(--border);
    color: var(--text-dim); font-size: 11px;
    padding: 3px 8px 3px 6px; border-radius: 5px;
    cursor: pointer; transition: all 0.15s; user-select: none;
  }
  .sidebar-opt svg { width: 12px; height: 12px; flex-shrink: 0; }
  .sidebar-opt:hover { color: var(--text); border-color: var(--text-dim); }
  .sidebar-opt.active { color: var(--accent); border-color: var(--accent); background: rgba(88,166,255,0.08); }

  /* Help button */
  .btn-help {
    width: 26px; height: 26px; padding: 0;
    border-radius: 50%; font-size: 12px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid var(--border); background: none;
    color: var(--text-dim); cursor: pointer;
    transition: all 0.15s; user-select: none; flex-shrink: 0;
  }
  .btn-help:hover { color: var(--accent); border-color: var(--accent); background: rgba(88,166,255,0.08); }

  /* Help overlay */
  .help-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    z-index: 2000; display: flex;
    align-items: center; justify-content: center;
    opacity: 0; pointer-events: none; transition: opacity 0.18s;
  }
  .help-overlay.visible { opacity: 1; pointer-events: all; }
  .help-modal {
    background: var(--sidebar-bg); border: 1px solid var(--border);
    border-radius: 14px; width: 420px; max-height: 80vh; overflow-y: auto;
    box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
    transform: translateY(10px) scale(0.97);
    transition: transform 0.2s cubic-bezier(0.34,1.4,0.64,1);
  }
  .help-overlay.visible .help-modal { transform: translateY(0) scale(1); }
  .help-modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px 13px; border-bottom: 1px solid var(--border);
  }
  .help-modal-header h2 {
    font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--text-dim);
  }
  .help-close {
    background: none; border: none; color: var(--text-dim);
    cursor: pointer; font-size: 15px; padding: 2px 5px;
    border-radius: 5px; line-height: 1; transition: color 0.15s;
  }
  .help-close:hover { color: var(--text); }
  .help-section { padding: 12px 20px; border-bottom: 1px solid var(--border); }
  .help-section:last-child { border-bottom: none; }
  .help-section-title {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--accent); margin-bottom: 8px;
  }
  .help-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 5px 0;
  }
  .help-row + .help-row { border-top: 1px solid rgba(48,54,61,0.5); }
  .help-desc { font-size: 12px; color: var(--text-dim); }
  .help-keys { display: flex; gap: 4px; align-items: center; }
  .help-kbd {
    font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
    font-size: 11px; background: var(--bg);
    border: 1px solid var(--border); border-bottom-width: 2px;
    border-radius: 4px; padding: 1px 7px; color: var(--text);
  }
  .help-kbd-sep { font-size: 10px; color: var(--text-dim); }

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

<div class="help-overlay" id="help-overlay">
  <div class="help-modal">
    <div class="help-modal-header">
      <h2>Keyboard Shortcuts</h2>
      <button class="help-close" id="help-close">&#x2715;</button>
    </div>
    <div class="help-section">
      <div class="help-section-title">Navigation</div>
      <div class="help-row">
        <span class="help-desc">Focus file search</span>
        <div class="help-keys"><kbd class="help-kbd">Ctrl</kbd><span class="help-kbd-sep">+</span><kbd class="help-kbd">F</kbd></div>
      </div>
      <div class="help-row">
        <span class="help-desc">Clear search / Dismiss</span>
        <div class="help-keys"><kbd class="help-kbd">Esc</kbd></div>
      </div>
      <div class="help-row">
        <span class="help-desc">Close active tab</span>
        <div class="help-keys"><kbd class="help-kbd">Ctrl</kbd><span class="help-kbd-sep">+</span><kbd class="help-kbd">W</kbd></div>
      </div>
    </div>
    <div class="help-section">
      <div class="help-section-title">View</div>
      <div class="help-row">
        <span class="help-desc">Toggle sidebar</span>
        <div class="help-keys"><kbd class="help-kbd">B</kbd></div>
      </div>
      <div class="help-row">
        <span class="help-desc">Toggle light / dark theme</span>
        <div class="help-keys"><kbd class="help-kbd">T</kbd></div>
      </div>
      <div class="help-row">
        <span class="help-desc">Cycle view: Preview / Split / Source</span>
        <div class="help-keys"><kbd class="help-kbd">S</kbd></div>
      </div>
      <div class="help-row">
        <span class="help-desc">Toggle word wrap</span>
        <div class="help-keys"><kbd class="help-kbd">W</kbd></div>
      </div>
      <div class="help-row">
        <span class="help-desc">Print</span>
        <div class="help-keys"><kbd class="help-kbd">P</kbd></div>
      </div>
    </div>
    <div class="help-section">
      <div class="help-section-title">File Management</div>
      <div class="help-row">
        <span class="help-desc">Rename selected file</span>
        <div class="help-keys"><kbd class="help-kbd">F2</kbd></div>
      </div>
      <div class="help-row">
        <span class="help-desc">Delete selected file</span>
        <div class="help-keys"><kbd class="help-kbd">Del</kbd></div>
      </div>
    </div>
    <div class="help-section">
      <div class="help-section-title">Help</div>
      <div class="help-row">
        <span class="help-desc">Show this help</span>
        <div class="help-keys"><kbd class="help-kbd">?</kbd></div>
      </div>
    </div>
  </div>
</div>

<div class="header">
  <div class="header-left">
    <button class="btn-sidebar-toggle" id="btn-sidebar" title="Toggle sidebar (B)">
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="1" width="12" height="12" rx="2"/>
        <line x1="5" y1="1" x2="5" y2="13"/>
        <line x1="8" y1="5" x2="10" y2="7"/>
        <line x1="8" y1="9" x2="10" y2="7"/>
      </svg>
    </button>
    <h1>SDV - Simple Doc Viewer</h1>
    <span class="path-badge" id="path-badge"></span>
  </div>
  <div class="header-right">
    <button class="theme-toggle" id="btn-theme" title="Toggle light/dark mode (T)">
      <span class="theme-icon theme-sun">
        <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z"/></svg>
      </span>
      <div class="theme-track"><div class="theme-knob"></div></div>
      <span class="theme-icon theme-moon">
        <svg viewBox="0 0 16 16" fill="currentColor"><path d="M6 .278a.77.77 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"/></svg>
      </span>
    </button>
    <button class="header-btn" id="btn-source" title="Toggle view mode (S)">Preview</button>
    <button class="header-btn" id="btn-wrap" title="Toggle word wrap">Wrap</button>
    <button class="header-btn" id="btn-pdf" title="Print (P)">Print</button>
    <button class="btn-help" id="btn-help" title="Keyboard shortcuts (?)">?</button>
  </div>
</div>

<div class="main">
  <div class="sidebar">
    <div class="sidebar-header">
      <input type="text" id="search-input" placeholder="Filter files...">
    </div>
    <div class="sidebar-opts">
      <button class="sidebar-opt" id="btn-hidden" title="Show hidden files">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/>
          <circle cx="8" cy="8" r="2"/>
        </svg>
        Hidden
      </button>
      <div class="sort-sep"></div>
      <button class="sidebar-opt sort-btn active" id="sort-name" data-sort="name" title="Sort by name">Name <span class="sort-arrow">&#9650;</span></button>
      <button class="sidebar-opt sort-btn" id="sort-size" data-sort="size" title="Sort by size">Size <span class="sort-arrow">&#9662;</span></button>
      <button class="sidebar-opt sort-btn" id="sort-modified" data-sort="modified" title="Sort by modified time">Modified <span class="sort-arrow">&#9662;</span></button>
      <button class="sidebar-opt sort-btn" id="sort-created" data-sort="created" title="Sort by created time">Created <span class="sort-arrow">&#9662;</span></button>
    </div>
    <div class="file-tree" id="file-tree"></div>
  </div>
  <div class="resize-handle" id="resize-handle"></div>
  <div class="content-area">
    <div class="content-tabs" id="tab-bar"></div>
    <div class="content-body" id="content-body">
      <div class="welcome">
        <div class="icon-large">&#128196;</div>
        <h2>SDV - Simple Doc Viewer</h2>
        <p>Click a file to view its contents</p>
        <div class="keys">
          <kbd>.md</kbd><kbd>.js</kbd><kbd>.ts</kbd><kbd>.json</kbd><kbd>.yaml</kbd><kbd>.py</kbd><kbd>.html</kbd><kbd>.css</kbd>
        </div>
      </div>
    </div>
    <div class="status-bar empty" id="status-bar">
      <span id="status-lines"></span>
      <span class="status-sep">&#183;</span>
      <span class="status-pct" id="status-pct"></span>
    </div>
  </div>
</div>
<div class="drop-overlay" id="drop-overlay">
  <div class="drop-msg">&#128196; 파일을 놓으세요</div>
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
  viewMode: 'preview',  // 'preview' | 'split' | 'source'
  searchQuery: '',
  sortBy: 'name',
  sortAsc: true,
  selectedTabs: {},
  rootDir: ${JSON.stringify(ROOT_DIR)}
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
var $btnSidebar = document.getElementById('btn-sidebar');
var $sidebar = document.querySelector('.sidebar');
var $resizeHandle = document.getElementById('resize-handle');
var $btnHelp = document.getElementById('btn-help');
var $helpOverlay = document.getElementById('help-overlay');
var $statusBar = document.getElementById('status-bar');
var $statusLines = document.getElementById('status-lines');
var $statusPct = document.getElementById('status-pct');
var docLines = 0;

function updateStatusBar() {
  if (!docLines) {
    $statusBar.classList.add('empty');
    return;
  }
  var pct = Math.min(100, Math.round(($content.scrollTop + $content.clientHeight) / $content.scrollHeight * 100));
  $statusLines.textContent = docLines.toLocaleString() + ' lines';
  $statusPct.textContent = pct + '%';
  $statusBar.classList.remove('empty');
}

$content.addEventListener('scroll', updateStatusBar);

// Intercept anchor link clicks inside rendered content
$content.addEventListener('click', function(e) {
  var el = e.target;
  while (el && el.tagName !== 'A') el = el.parentElement;
  if (!el) return;
  var href = el.getAttribute('href');
  if (href && href.charAt(0) === '#') {
    e.preventDefault();
    var id = href.slice(1);
    var target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

// --- Helpers ---
function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function slugify(text) {
  text = text.replace(/\\*\\*?([^*]*)\\*\\*?/g, '$1').replace(/__?([^_]*)__?/g, '$1');
  text = text.replace(/\\[([^\\]]*)\\]\\([^)]*\\)/g, '$1');
  text = text.toLowerCase();
  // Keep: a-z, 0-9, space, hyphen, Korean syllables & high Unicode (>= 0xAC00)
  var _out = '';
  for (var _i = 0; _i < text.length; _i++) {
    var _c = text.charCodeAt(_i);
    if ((_c >= 97 && _c <= 122) || (_c >= 48 && _c <= 57) || _c === 32 || _c === 45 || _c >= 0xAC00) {
      _out += text[_i];
    }
  }
  return _out.replace(/\\s/g, '-');
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
    env: '\\ud83d\\udd10', gitignore: '\\ud83d\\udeab',
    png: '\\ud83d\\uddbc', jpg: '\\ud83d\\uddbc', jpeg: '\\ud83d\\uddbc', gif: '\\ud83d\\uddbc',
    webp: '\\ud83d\\uddbc', bmp: '\\ud83d\\uddbc', ico: '\\ud83d\\uddbc', avif: '\\ud83d\\uddbc',
    mp4: '\\ud83c\\udfac', webm: '\\ud83c\\udfac', mov: '\\ud83c\\udfac', avi: '\\ud83c\\udfac', mkv: '\\ud83c\\udfac', ogg: '\\ud83c\\udfac',
    mp3: '\\ud83c\\udfb5', wav: '\\ud83c\\udfb5', flac: '\\ud83c\\udfb5', aac: '\\ud83c\\udfb5', opus: '\\ud83c\\udfb5', m4a: '\\ud83c\\udfb5', wma: '\\ud83c\\udfb5',
    pdf: '\\ud83d\\udcc4'
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
    css: 'var(--badge-css)',
    png: 'var(--badge-img)', jpg: 'var(--badge-img)', jpeg: 'var(--badge-img)',
    gif: 'var(--badge-img)', webp: 'var(--badge-img)', bmp: 'var(--badge-img)',
    svg: 'var(--badge-img)', ico: 'var(--badge-img)', avif: 'var(--badge-img)',
    mp4: 'var(--badge-video)', webm: 'var(--badge-video)', mov: 'var(--badge-video)',
    avi: 'var(--badge-video)', mkv: 'var(--badge-video)', ogg: 'var(--badge-video)',
    mp3: 'var(--badge-audio)', wav: 'var(--badge-audio)', flac: 'var(--badge-audio)',
    aac: 'var(--badge-audio)', opus: 'var(--badge-audio)', m4a: 'var(--badge-audio)', wma: 'var(--badge-audio)',
    pdf: '#f40f02'
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

function apiChroot(dirPath, callback) {
  fetch('/api/chroot?path=' + encodeURIComponent(dirPath))
    .then(function(r) { return r.json(); })
    .then(callback)
    .catch(function(e) { callback({ error: e.message }); });
}

// --- Drag & Drop ---
var $dropOverlay = document.getElementById('drop-overlay');
var _dragDepth = 0;

document.addEventListener('dragenter', function(e) {
  if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.indexOf('Files') !== -1) {
    e.preventDefault();
    _dragDepth++;
    $dropOverlay.classList.add('active');
  }
});

document.addEventListener('dragleave', function(e) {
  _dragDepth--;
  if (_dragDepth <= 0) { _dragDepth = 0; $dropOverlay.classList.remove('active'); }
});

document.addEventListener('dragover', function(e) {
  if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.indexOf('Files') !== -1) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
});

document.addEventListener('drop', function(e) {
  e.preventDefault();
  _dragDepth = 0;
  $dropOverlay.classList.remove('active');

  // 1차 시도: text/uri-list (파일 경로 추출 → 사이드바 이동 가능)
  var uriList = e.dataTransfer.getData('text/uri-list');
  if (uriList && uriList.trim()) {
    var lines = uriList.split('\\n');
    for (var i = 0; i < lines.length; i++) {
      var uri = lines[i].trim().replace('\\r', '');
      if (!uri || uri.charAt(0) === '#') continue;
      var fp = parseFileUri(uri);
      if (!fp) continue;
      var dir = fp.substring(0, fp.lastIndexOf('/'));
      var name = fp.substring(fp.lastIndexOf('/') + 1);
      dropOpenFile(fp, dir, name);
      return;
    }
  }

  // 2차 폴백: FileReader (경로 불명 → 파일 내용만 읽기, 사이드바 이동 없음)
  var files = e.dataTransfer.files;
  if (files && files.length > 0) {
    dropReadFile(files[0]);
  }
});

function dropReadFile(file) {
  var ext = file.name.split('.').pop().toLowerCase();
  var textExts = ['md','txt','js','ts','jsx','tsx','json','yaml','yml','py','sh','bash',
    'css','html','htm','go','rs','java','c','cpp','h','sql','toml','ini','cfg','env','xml','svg'];
  if (textExts.indexOf(ext) === -1) {
    alert('지원되지 않는 파일 형식입니다: .' + ext);
    return;
  }
  var reader = new FileReader();
  reader.onload = function(ev) {
    var virtualPath = '__dropped__/' + file.name;
    openFile(virtualPath, file.name, ev.target.result);
  };
  reader.readAsText(file, 'utf-8');
}

function parseFileUri(uri) {
  if (uri.indexOf('file:///') !== 0) return null;
  var decoded = decodeURIComponent(uri.slice(8));
  if (decoded.charAt(1) !== ':') decoded = '/' + decoded; // Unix: prepend /
  return decoded.replace(/\\\\/g, '/');
}

function dropOpenFile(filePath, dir, name) {
  if (dir === state.rootDir || filePath.indexOf(state.rootDir + '/') === 0) {
    navigateTo(dir, function() { openFile(filePath, name); });
  } else {
    apiChroot(dir, function(data) {
      if (data.error) return;
      state.rootDir = data.root;
      navigateTo('', function() { openFile(filePath, name); });
    });
  }
}

// --- Navigation ---
function navigateTo(dirPath, onDone) {
  $search.value = '';
  state.searchQuery = '';
  apiList(dirPath, function(data) {
    if (data.error) {
      // Access denied — try chroot to expand ROOT_DIR
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '/api/chroot?path=' + encodeURIComponent(dirPath));
      xhr.onload = function() {
        var cr = JSON.parse(xhr.responseText);
        if (cr.root) {
          apiList(dirPath, function(data2) {
            if (data2.error) return;
            state.currentPath = data2.path;
            state.parentPath = data2.parent;
            state.items = data2.items;
            $pathBadge.textContent = data2.path;
            $pathBadge.title = data2.path;
            renderTree();
            if (onDone) onDone();
          });
        }
      };
      xhr.send();
      return;
    }
    state.currentPath = data.path;
    state.parentPath = data.parent;
    state.items = data.items;
    $pathBadge.textContent = data.path;
    $pathBadge.title = data.path;
    renderTree();
    if (onDone) onDone();
  });
}

// --- File Tree ---
function sortItems(items) {
  var sorted = items.slice();
  var key = state.sortBy;
  var asc = state.sortAsc;
  sorted.sort(function(a, b) {
    // Dirs always first
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    var va, vb;
    if (key === 'name') {
      va = a.name.toLowerCase();
      vb = b.name.toLowerCase();
      var cmp = va.localeCompare(vb);
      return asc ? cmp : -cmp;
    } else if (key === 'size') {
      va = a.size || 0;
      vb = b.size || 0;
      return asc ? va - vb : vb - va;
    } else if (key === 'modified') {
      va = a.modified || '';
      vb = b.modified || '';
      var cmp2 = va.localeCompare(vb);
      return asc ? cmp2 : -cmp2;
    } else if (key === 'created') {
      va = a.created || '';
      vb = b.created || '';
      var cmp3 = va.localeCompare(vb);
      return asc ? cmp3 : -cmp3;
    }
    return 0;
  });
  return sorted;
}

function renderTree() {
  var items = sortItems(state.items);
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
      html += '<span class="file-meta">'
        + '<span class="badge" style="color:' + badgeColor + ';border:1px solid ' + badgeColor + '">' + ext + '</span>'
        + (item.size !== undefined ? '<span class="size">' + formatSize(item.size) + '</span>' : '')
        + '</span>';
    }
    html += '<span class="file-actions">'
      + '<button class="btn-ren" data-action="rename" title="Rename (F2)">&#9998;</button>'
      + '<button class="btn-del" data-action="delete" title="Delete">&#128465;</button>'
      + '</span>';
    html += '</div>';
  }

  $tree.innerHTML = html;
}

// Tree click handler (event delegation)
$tree.addEventListener('click', function(e) {
  // Check for action buttons first
  var actionBtn = e.target.closest('[data-action="rename"], [data-action="delete"]');
  if (actionBtn) {
    e.stopPropagation();
    var treeItem = actionBtn.closest('.tree-item');
    if (!treeItem) return;
    var filePath = treeItem.dataset.path;
    var fileName = treeItem.dataset.name;
    if (actionBtn.dataset.action === 'rename') {
      startRename(treeItem, filePath, fileName);
    } else if (actionBtn.dataset.action === 'delete') {
      doDelete(filePath, fileName);
    }
    return;
  }
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

function startRename(treeItem, filePath, oldName) {
  var nameSpan = treeItem.querySelector('.name');
  if (!nameSpan) return;
  var input = document.createElement('input');
  input.className = 'rename-input';
  input.value = oldName;
  nameSpan.textContent = '';
  nameSpan.appendChild(input);
  input.focus();
  // Select name without extension
  var dotIdx = oldName.lastIndexOf('.');
  if (dotIdx > 0) {
    input.setSelectionRange(0, dotIdx);
  } else {
    input.select();
  }

  function commit() {
    var newName = input.value.trim();
    if (!newName || newName === oldName) {
      nameSpan.textContent = oldName;
      return;
    }
    var dir = filePath.substring(0, filePath.lastIndexOf('/'));
    var newPath = dir + '/' + newName;
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/rename');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function() {
      var resp = JSON.parse(xhr.responseText);
      if (resp.ok) {
        // Update tab if open
        if (state.openTabs.indexOf(filePath) !== -1) {
          var idx = state.openTabs.indexOf(filePath);
          state.openTabs[idx] = resp.newPath;
          if (state.tabCache[filePath]) {
            state.tabCache[resp.newPath] = state.tabCache[filePath];
            state.tabCache[resp.newPath].name = newName;
            if (state.tabCache[resp.newPath].data) state.tabCache[resp.newPath].data.name = newName;
            delete state.tabCache[filePath];
          }
          if (state.activeTab === filePath) state.activeTab = resp.newPath;
          renderTabs();
          renderContent();
        }
        navigateTo(state.currentPath);
      } else {
        nameSpan.textContent = oldName;
        alert(resp.error || 'Rename failed');
      }
    };
    xhr.send(JSON.stringify({ oldPath: filePath, newPath: newPath }));
  }

  input.addEventListener('keydown', function(ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
    if (ev.key === 'Escape') { ev.preventDefault(); nameSpan.textContent = oldName; }
    ev.stopPropagation();
  });
  input.addEventListener('blur', commit);
}

function doDelete(filePath, fileName) {
  if (!confirm('Delete "' + fileName + '"?')) return;
  var xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/delete');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onload = function() {
    var resp = JSON.parse(xhr.responseText);
    if (resp.ok) {
      // Close tab if open
      if (state.openTabs.indexOf(filePath) !== -1) {
        closeTab(filePath);
      }
      navigateTo(state.currentPath);
    } else {
      alert(resp.error || 'Delete failed');
    }
  };
  xhr.send(JSON.stringify({ path: filePath }));
}

// --- Tabs ---
var MEDIA_IMG = { png:1, jpg:1, jpeg:1, gif:1, svg:1, webp:1, bmp:1, ico:1, tiff:1, tif:1, avif:1 };
var MEDIA_VID = { mp4:1, webm:1, ogg:1, mov:1, avi:1, mkv:1 };
var MEDIA_AUD = { mp3:1, wav:1, flac:1, aac:1, opus:1, wma:1, m4a:1 };
var MEDIA_DOC = { pdf:1 };

function isMediaExt(ext) { return !!(MEDIA_IMG[ext] || MEDIA_VID[ext] || MEDIA_AUD[ext] || MEDIA_DOC[ext]); }

function openFile(filePath, fileName, directContent) {
  // Already open?
  if (state.openTabs.indexOf(filePath) !== -1) {
    // Drag-drop with new content: update cache so same-named files show new content
    if (directContent !== undefined) {
      var ext2 = getExt(fileName);
      state.tabCache[filePath] = { name: fileName, ext: ext2, data: { path: filePath, name: fileName, ext: ext2, content: directContent, size: directContent.length }, loading: false };
    }
    activateTab(filePath);
    return;
  }

  // Add tab
  state.openTabs.push(filePath);
  var ext = getExt(fileName);

  // Direct content (drag-drop FileReader) — no server fetch needed
  if (directContent !== undefined) {
    state.tabCache[filePath] = { name: fileName, ext: ext, data: { path: filePath, name: fileName, ext: ext, content: directContent, size: directContent.length }, loading: false };
    activateTab(filePath);
    return;
  }

  // Media files — no text fetch needed
  if (isMediaExt(ext)) {
    state.tabCache[filePath] = { name: fileName, ext: ext, data: { path: filePath, name: fileName, ext: ext }, loading: false };
    activateTab(filePath);
    return;
  }

  // Fetch file from server
  state.tabCache[filePath] = { name: fileName, ext: ext, data: null, loading: true };
  activateTab(filePath);
  apiRead(filePath, function(data) {
    state.tabCache[filePath].data = data;
    state.tabCache[filePath].loading = false;
    if (state.activeTab === filePath) renderContent();
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
  var selCount = Object.keys(state.selectedTabs).length;
  for (var i = 0; i < state.openTabs.length; i++) {
    var p = state.openTabs[i];
    var tab = state.tabCache[p];
    var name = tab ? tab.name : p.split('/').pop();
    var isActive = p === state.activeTab;
    var isSel = !!state.selectedTabs[p];
    html += '<div class="tab' + (isActive ? ' active' : '') + (isSel ? ' multi-selected' : '') + '" data-path="' + escHtml(p) + '">'
      + '<span>' + escHtml(name) + '</span>'
      + '<span class="tab-close" data-close="' + escHtml(p) + '">&#10005;</span>'
      + '</div>';
  }
  if (state.openTabs.length > 1) {
    html += '<button class="tab-close-all" id="btn-close-all" title="Close all tabs">'
      + (selCount > 0 ? 'Close ' + selCount + ' selected' : 'Close all')
      + '</button>';
  }
  $tabs.innerHTML = html;
}

// Tab click handler (event delegation)
$tabs.addEventListener('click', function(e) {
  // Close All / Close Selected
  if (e.target.id === 'btn-close-all') {
    var selKeys = Object.keys(state.selectedTabs);
    var toClose = selKeys.length > 0 ? selKeys : state.openTabs.slice();
    for (var ci = 0; ci < toClose.length; ci++) {
      var idx = state.openTabs.indexOf(toClose[ci]);
      if (idx !== -1) { state.openTabs.splice(idx, 1); delete state.tabCache[toClose[ci]]; }
    }
    state.selectedTabs = {};
    state.activeTab = state.openTabs.length > 0 ? state.openTabs[state.openTabs.length - 1] : null;
    renderTabs(); renderContent(); renderTree();
    return;
  }
  var closeEl = e.target.closest('[data-close]');
  if (closeEl) {
    var cp = closeEl.dataset.close;
    // If closing a selected tab, close all selected
    if (state.selectedTabs[cp] && Object.keys(state.selectedTabs).length > 1) {
      var selKeys2 = Object.keys(state.selectedTabs);
      for (var ci2 = 0; ci2 < selKeys2.length; ci2++) {
        var idx2 = state.openTabs.indexOf(selKeys2[ci2]);
        if (idx2 !== -1) { state.openTabs.splice(idx2, 1); delete state.tabCache[selKeys2[ci2]]; }
      }
      state.selectedTabs = {};
      state.activeTab = state.openTabs.length > 0 ? state.openTabs[state.openTabs.length - 1] : null;
      renderTabs(); renderContent(); renderTree();
    } else {
      closeTab(cp, e);
    }
    return;
  }
  var tabEl = e.target.closest('.tab');
  if (tabEl) {
    var tp = tabEl.dataset.path;
    // Ctrl/Cmd + click → multi-select toggle
    if (e.ctrlKey || e.metaKey) {
      if (state.selectedTabs[tp]) { delete state.selectedTabs[tp]; }
      else { state.selectedTabs[tp] = true; }
      renderTabs();
      return;
    }
    state.selectedTabs = {};
    activateTab(tp);
  }
});

// --- Content rendering ---
function renderContent(preserveScroll) {
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

  // Media files — render directly without text content
  if (isMediaExt(tab.ext)) {
    var mediaSrc = '/api/media?path=' + encodeURIComponent(state.activeTab);
    var showZoom = !!(MEDIA_IMG[tab.ext] || MEDIA_VID[tab.ext]) && !MEDIA_DOC[tab.ext];
    var mediaHtml = '<div class="media-viewer' + (MEDIA_DOC[tab.ext] ? ' pdf-mode' : '') + '">';
    mediaHtml += '<div class="media-content">';
    if (MEDIA_IMG[tab.ext]) {
      mediaHtml += '<img id="media-target" src="' + mediaSrc + '" alt="' + escHtml(tab.name) + '">';
    } else if (MEDIA_VID[tab.ext]) {
      mediaHtml += '<video id="media-target" src="' + mediaSrc + '" controls preload="metadata"></video>';
    } else if (MEDIA_AUD[tab.ext]) {
      mediaHtml += '<audio src="' + mediaSrc + '" controls preload="metadata"></audio>';
    } else if (MEDIA_DOC[tab.ext]) {
      mediaHtml += '<iframe class="pdf-frame" src="' + mediaSrc + '"></iframe>';
    }
    mediaHtml += '</div>';
    if (showZoom) {
      mediaHtml += '<div class="media-zoom-bar">'
        + '<button id="zoom-out" title="Zoom out">&#8722;</button>'
        + '<input type="range" id="zoom-slider" min="10" max="400" value="100" step="10">'
        + '<button id="zoom-in" title="Zoom in">&#43;</button>'
        + '<span class="zoom-pct" id="zoom-pct">100%</span>'
        + '<button id="zoom-fit" title="Fit to window">Fit</button>'
        + '<button id="zoom-reset" title="Original size (100%)">1:1</button>'
        + '</div>';
    }
    // filename already visible in sidebar + tab
    mediaHtml += '</div>';
    $content.innerHTML = mediaHtml;
    $statusBar.classList.add('empty');
    return;
  }

  if (data.error) {
    $content.innerHTML = '<div class="error-display">'
      + '<div class="icon-large">&#128683;</div>'
      + '<h2>' + escHtml(data.name || 'Error') + '</h2>'
      + '<p>' + escHtml(data.error) + '</p>'
      + '</div>';
    return;
  }

  docLines = data.content.split('\\n').length;

  var savedRatio = 0;
  if (preserveScroll) {
    var prevRenPanel = $content.querySelector('.md-render-panel');
    if (prevRenPanel && prevRenPanel.scrollHeight > 0) {
      savedRatio = prevRenPanel.scrollTop / prevRenPanel.scrollHeight;
    } else if ($content.scrollHeight > 0) {
      savedRatio = $content.scrollTop / $content.scrollHeight;
    }
  }

  if (data.ext === 'md') {
    var _filePath = state.activeTab || '';
    var _lastSlash = _filePath.lastIndexOf('/');
    md.setBase(_lastSlash >= 0 ? _filePath.substring(0, _lastSlash) : '');
    if (state.viewMode === 'split') {
      $content.innerHTML = '<div class="md-split">'
        + '<div class="md-source-panel">'
        + '<div class="raw-view' + (state.wordWrap ? ' word-wrap' : '') + '">'
        + renderRaw(data.content, 'md')
        + '</div></div>'
        + '<div class="md-render-panel">'
        + '<div class="md-rendered">' + md.parse(data.content) + '</div>'
        + '</div></div>';
      if (!preserveScroll) $content.scrollTop = 0;
      setupSplitSync();
    } else if (state.viewMode === 'source') {
      $content.innerHTML = '<div class="raw-view' + (state.wordWrap ? ' word-wrap' : '') + '">' + renderRaw(data.content, 'md') + '</div>';
      if (!preserveScroll) $content.scrollTop = 0;
    } else {
      $content.innerHTML = '<div class="md-rendered">' + md.parse(data.content) + '</div>';
      if (!preserveScroll) $content.scrollTop = 0;
    }
    renderMermaidBlocks();
  } else if (data.ext === 'html' || data.ext === 'htm') {
    if (state.viewMode === 'split') {
      $content.innerHTML = '<div class="md-split">'
        + '<div class="md-source-panel">'
        + '<div class="raw-view' + (state.wordWrap ? ' word-wrap' : '') + '">'
        + renderRaw(data.content, data.ext)
        + '</div></div>'
        + '<div class="md-render-panel" style="padding:0">'
        + '<iframe id="html-preview" style="width:100%;height:100%;border:none;background:#fff"></iframe>'
        + '</div></div>';
      setupSplitSync();
    } else if (state.viewMode === 'source') {
      $content.innerHTML = '<div class="raw-view' + (state.wordWrap ? ' word-wrap' : '') + '">' + renderRaw(data.content, data.ext) + '</div>';
    } else {
      $content.innerHTML = '<iframe id="html-preview" style="width:100%;height:100%;border:none;background:#fff"></iframe>';
    }
    var hf = document.getElementById('html-preview');
    if (hf) {
      hf.contentDocument.open();
      hf.contentDocument.write(data.content);
      hf.contentDocument.close();
    }
    if (!preserveScroll) $content.scrollTop = 0;
  } else {
    $content.innerHTML = '<div class="raw-view' + (state.wordWrap ? ' word-wrap' : '') + '">' + renderRaw(data.content, data.ext) + '</div>';
    if (!preserveScroll) $content.scrollTop = 0;
  }

  if (preserveScroll) {
    var newRenPanel = $content.querySelector('.md-render-panel');
    var newSrcPanel = $content.querySelector('.md-source-panel');
    if (newRenPanel) {
      newRenPanel.scrollTop = savedRatio * newRenPanel.scrollHeight;
      if (newSrcPanel) newSrcPanel.scrollTop = savedRatio * newSrcPanel.scrollHeight;
    } else {
      $content.scrollTop = savedRatio * $content.scrollHeight;
    }
  }

  updateStatusBar();
}

function showWelcome() {
  docLines = 0;
  $statusBar.classList.add('empty');
  $content.innerHTML = '<div class="welcome">'
    + '<div class="icon-large">&#128196;</div>'
    + '<h2>SDV - Simple Doc Viewer</h2>'
    + '<p>Click a file to view its contents</p>'
    + '<div class="keys">'
    + '<kbd>.md</kbd><kbd>.js</kbd><kbd>.ts</kbd><kbd>.json</kbd><kbd>.yaml</kbd><kbd>.py</kbd><kbd>.html</kbd><kbd>.css</kbd>'
    + '</div></div>';
}

// --- Markdown Parser ---
var md = (function() {
  var _base = '';

  function highlightCode(code, lang) {
    var escaped = escHtml(code);
    var kwSets = {
      javascript: /\\b(function|const|let|var|return|if|else|for|while|class|new|this|import|export|from|of|in|typeof|instanceof|async|await|try|catch|throw|switch|case|break|continue|default|yield|delete|void|null|undefined|true|false)\\b/g,
      python: /\\b(def|class|return|if|elif|else|for|while|import|from|as|with|try|except|raise|in|not|and|or|is|None|True|False|self|lambda|yield|pass|break|continue|finally|global|nonlocal|assert|del)\\b/g,
      bash: /\\b(echo|for|do|done|if|then|fi|else|elif|in|function|local|export|source|cd|ls|mkdir|rm|cp|mv|cat|grep|awk|sed|chmod|chown|while|case|esac|read|shift|set|unset)\\b/g,
      go: /\\b(func|var|const|type|struct|interface|return|if|else|for|range|switch|case|break|continue|default|package|import|defer|go|chan|select|map|make|new|nil|true|false)\\b/g,
      rust: /\\b(fn|let|mut|const|if|else|for|while|loop|match|return|struct|enum|impl|trait|pub|use|mod|self|super|crate|where|async|await|move|unsafe|extern|type|true|false|None|Some|Ok|Err)\\b/g,
      yaml: /\\b(true|false|null|yes|no|on|off)\\b/g,
      css: /\\b(import|media|keyframes|from|to|inherit|initial|unset|none|auto|flex|grid|block|inline|relative|absolute|fixed|sticky|hidden|visible|solid|dashed|dotted|transparent|!important)\\b/g,
      html: /\\b(doctype|html|head|body|div|span|class|id|style|src|href|alt|title|meta|link|script|type|charset|name|content|rel|lang|async|defer)\\b/gi,
      sql: /\\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|INTO|VALUES|SET|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|IN|IS|NULL|AS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|UNION|ALL|DISTINCT|COUNT|SUM|AVG|MAX|MIN|CASE|WHEN|THEN|ELSE|END|EXISTS|BETWEEN|LIKE|INDEX|PRIMARY|KEY|FOREIGN|REFERENCES|DEFAULT|CONSTRAINT|CASCADE|VIEW|TRIGGER|FUNCTION|PROCEDURE|BEGIN|COMMIT|ROLLBACK)\\b/gi
    };
    // Normalize language aliases
    var langMap = { js: 'javascript', ts: 'javascript', jsx: 'javascript', tsx: 'javascript', mjs: 'javascript', cjs: 'javascript', sh: 'bash', zsh: 'bash', yml: 'yaml' };
    var normLang = langMap[lang] || lang;

    var tokens = [];
    var tokenIdx = 0;
    function tok(match, cls) {
      var ph = '\\x00T' + (tokenIdx++) + '\\x00';
      tokens.push({ ph: ph, html: '<span class="hljs-' + cls + '">' + match + '</span>' });
      return ph;
    }

    // Comments
    var cmRe = { javascript: /(\\/\\/.*$|\\/\\*[\\s\\S]*?\\*\\/)/gm, python: /(#.*$|"""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\')/gm, bash: /(#.*$)/gm, go: /(\\/\\/.*$|\\/\\*[\\s\\S]*?\\*\\/)/gm, rust: /(\\/\\/.*$|\\/\\*[\\s\\S]*?\\*\\/)/gm, yaml: /(#.*$)/gm, css: /(\\/\\*[\\s\\S]*?\\*\\/)/gm, html: /(&lt;!--[\\s\\S]*?--&gt;)/gm, sql: /(--.*$|\\/\\*[\\s\\S]*?\\*\\/)/gm };
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

    // YAML key: value highlighting
    if (normLang === 'yaml') {
      escaped = escaped.replace(/^([\\w][\\w.\\-]*):/gm, function(m, key) { return tok(key, 'attr') + ':'; });
    }

    // CSS selector/property highlighting
    if (normLang === 'css') {
      escaped = escaped.replace(/([\\w-]+)\\s*:/g, function(m, prop) { return tok(prop, 'attr') + ':'; });
    }

    // HTML tag highlighting
    if (normLang === 'html') {
      escaped = escaped.replace(/(&lt;\\/?)([\\w-]+)/g, function(m, bracket, tag) { return bracket + tok(tag, 'keyword'); });
      escaped = escaped.replace(/([\\w-]+)=(&quot;)/g, function(m, attr, q) { return tok(attr, 'attr') + '=' + q; });
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
    // Escape sequences: \\* \\# \\[ etc → placeholder, restore at end
    var escapes = [];
    text = text.replace(/\\\\([\\\\*_~\`#\\[\\]()!|>-])/g, function(m, ch) {
      var ph = '\\x00E' + escapes.length + '\\x00';
      escapes.push(escHtml(ch));
      return ph;
    });
    // Preserve HTML tags (kbd, br, sub, sup, etc.)
    var htmlTags = [];
    text = text.replace(/<(\\/?(kbd|br|sub|sup|abbr|mark|ins|del|span|small|em|strong|b|i|u|s|a)(\\s[^>]*)?\\/?)>/gi, function(m) {
      var ph = '\\x00H' + htmlTags.length + '\\x00';
      htmlTags.push(m);
      return ph;
    });
    // Images
    text = text.replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g, function(m, alt, src) {
      if (_base && src.indexOf('http') !== 0 && src.charAt(0) !== '/') {
        src = '/api/image?path=' + encodeURIComponent(_base + '/' + src);
      }
      return '<img src="' + src + '" alt="' + alt + '" loading="lazy">';
    });
    // Links
    text = text.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, function(m, t, h) {
      if (h.charAt(0) === '#') return '<a href="' + h + '">' + t + '</a>';
      return '<a href="' + h + '" target="_blank" rel="noopener">' + t + '</a>';
    });
    // Auto links
    text = text.replace(/(^|[^"=])((https?:\\/\\/)[^\\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    // Inline code (before bold/italic to avoid conflicts)
    text = text.replace(/\`([^\`]+)\`/g, function(m, c) { return '<code>' + escHtml(c) + '</code>'; });
    // Inline math $...$
    text = text.replace(/\\$([^$]+)\\$/g, function(m, tex) {
      if (window.katex) {
        try { return window.katex.renderToString(tex, { throwOnError: false }); }
        catch(e) { /* fall through */ }
      }
      return '<code class="math-inline">' + escHtml(tex) + '</code>';
    });
    // Bold italic (*** or ___)
    text = text.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
    // Bold (** or __)
    text = text.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
    // Italic (* or _)
    text = text.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
    text = text.replace(/(?<![\\w])_(.+?)_(?![\\w])/g, '<em>$1</em>');
    // Strikethrough
    text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
    // Highlight
    text = text.replace(/==(.+?)==/g, '<mark>$1</mark>');
    // Footnote refs
    text = text.replace(/\\[\\^(\\d+)\\]/g, '<sup class="footnote-ref"><a href="#fn$1" id="fnref$1">[$1]</a></sup>');
    // Restore HTML tags
    for (var hi = 0; hi < htmlTags.length; hi++) {
      text = text.replace('\\x00H' + hi + '\\x00', htmlTags[hi]);
    }
    // Restore escape sequences
    for (var ei = 0; ei < escapes.length; ei++) {
      text = text.replace('\\x00E' + ei + '\\x00', escapes[ei]);
    }
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

  function parseFrontmatter(lines) {
    if (lines.length < 3 || lines[0].trim() !== '---') return null;
    var end = -1;
    for (var fi = 1; fi < lines.length; fi++) {
      if (lines[fi].trim() === '---') { end = fi; break; }
    }
    if (end === -1) return null;
    var pairs = [];
    for (var fj = 1; fj < end; fj++) {
      var fmMatch = lines[fj].match(/^([\\w-]+):\\s*(.*)/);
      if (fmMatch) pairs.push({ key: fmMatch[1], val: fmMatch[2] });
    }
    if (pairs.length === 0) return null;
    var cardHtml = '<div class="frontmatter-card">';
    for (var fk = 0; fk < pairs.length; fk++) {
      var rawVal = pairs[fk].val.trim();
      var valHtml = '';
      // Array values: ["a", "b"] or [a, b]
      var arrMatch = rawVal.match(/^\\[(.*)\\]$/);
      if (arrMatch) {
        var items = arrMatch[1].split(',');
        for (var ai = 0; ai < items.length; ai++) {
          var tag = items[ai].trim().replace(/^["']|["']$/g, '');
          if (tag) valHtml += '<span class="fm-tag">' + escHtml(tag) + '</span>';
        }
      } else {
        // Strip surrounding quotes
        var clean = rawVal.replace(/^["']|["']$/g, '');
        valHtml = escHtml(clean);
      }
      cardHtml += '<span class="fm-key">' + escHtml(pairs[fk].key) + '</span>'
        + '<span class="fm-val">' + valHtml + '</span>';
    }
    cardHtml += '</div>';
    return { html: cardHtml, endLine: end + 1 };
  }

  function parse(src) {
    var lines = src.split('\\n');
    var html = '';
    var i = 0;

    // Frontmatter
    var fm = parseFrontmatter(lines);
    if (fm) {
      html += fm.html;
      i = fm.endLine;
    }

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
        var highlighted = (lang && ['javascript','js','ts','tsx','jsx','python','py','bash','sh','json','go','rust','rs','yaml','yml','css','html','sql'].indexOf(lang) !== -1)
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
        var mathSrc = math.join('\\n');
        if (window.katex) {
          try { html += '<div class="math-block">' + window.katex.renderToString(mathSrc, { displayMode: true, throwOnError: false }) + '</div>'; continue; }
          catch(e) { /* fall through */ }
        }
        html += '<div class="math-block"><code>' + escHtml(mathSrc) + '</code></div>';
        continue;
      }

      // Heading
      var hMatch = line.match(/^(#{1,6})\\s+(.+)/);
      if (hMatch) {
        var lvl = hMatch[1].length;
        var hid = slugify(hMatch[2]);
        html += '<h' + lvl + ' id="' + hid + '">' + inlineFormat(hMatch[2]) + '</h' + lvl + '>';
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

      // Details/Summary block — parse inner markdown
      if (line.match(/^<details/i)) {
        var detailLines = [line];
        i++;
        while (i < lines.length && !lines[i].match(/^<\\/details>/i)) {
          detailLines.push(lines[i]); i++;
        }
        if (i < lines.length) { detailLines.push(lines[i]); i++; }
        // Extract summary and inner content
        var detailStr = detailLines.join('\\n');
        var sumMatch = detailStr.match(/<summary>(.*?)<\\/summary>/i);
        var sumText = sumMatch ? sumMatch[1] : 'Details';
        var innerStart = detailStr.indexOf('<\\/summary>');
        var innerEnd = detailStr.lastIndexOf('<\\/details>');
        var innerContent = '';
        if (innerStart !== -1 && innerEnd !== -1) {
          innerContent = detailStr.substring(innerStart + 10, innerEnd).trim();
        }
        html += '<details><summary>' + sumText + '</summary>' + parse(innerContent) + '</details>';
        continue;
      }
      if (line.match(/^<\\/?(summary)/i)) { i++; continue; }

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

  return { parse: parse, setBase: function(dir) { _base = dir; } };
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

var viewModes = ['preview', 'split', 'source'];
var viewModeLabels = { preview: 'Preview', split: 'Split', source: 'Source' };

function cycleViewMode() {
  var idx = viewModes.indexOf(state.viewMode);
  state.viewMode = viewModes[(idx + 1) % 3];
  $btnSource.textContent = viewModeLabels[state.viewMode];
  $btnSource.classList.toggle('active', state.viewMode !== 'preview');
  if (state.activeTab) {
    var tab = state.tabCache[state.activeTab];
    if (tab && tab.data && (tab.data.ext === 'md' || tab.data.ext === 'html' || tab.data.ext === 'htm')) {
      renderContent(true);
    }
  }
}

$btnSource.addEventListener('click', cycleViewMode);

var _savedSidebarWidth = null;
function toggleSidebar() {
  var willCollapse = !$sidebar.classList.contains('collapsed');
  if (willCollapse) {
    _savedSidebarWidth = $sidebar.style.width || null;
    $sidebar.style.width = '';
    $sidebar.style.minWidth = '';
  }
  var collapsed = $sidebar.classList.toggle('collapsed');
  $btnSidebar.classList.toggle('collapsed', collapsed);
  if (!collapsed && _savedSidebarWidth) {
    $sidebar.style.width = _savedSidebarWidth;
    $sidebar.style.minWidth = _savedSidebarWidth;
  }
}

$btnSidebar.addEventListener('click', toggleSidebar);

// --- Path badge click → editable input ---
$pathBadge.addEventListener('click', function() {
  var current = $pathBadge.textContent;
  var input = document.createElement('input');
  input.className = 'path-input';
  input.value = current;
  $pathBadge.style.display = 'none';
  $pathBadge.parentNode.insertBefore(input, $pathBadge.nextSibling);
  input.focus();
  input.select();

  function finish() {
    if (input.parentNode) input.parentNode.removeChild(input);
    $pathBadge.style.display = '';
  }

  function go() {
    var val = input.value.trim().replace(/\\\\/g, '/');
    // MSYS2 path → Windows path: /e/project → E:/project
    var msysMatch = val.match(/^\\/([a-zA-Z])\\//);
    if (msysMatch) {
      val = msysMatch[1].toUpperCase() + ':/' + val.substring(3);
    }
    if (!val) { finish(); return; }
    finish();
    // Chroot first, then try as directory
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/chroot?path=' + encodeURIComponent(val));
    xhr.onload = function() {
      var resp = JSON.parse(xhr.responseText);
      if (resp.root) {
        // It is a directory — chroot succeeded, navigate
        navigateTo(val);
      } else {
        // Not a directory — try as file (chroot to parent)
        var parts = val.split('/');
        var fileName = parts.pop();
        var dirPath = parts.join('/');
        var xhr2 = new XMLHttpRequest();
        xhr2.open('GET', '/api/chroot?path=' + encodeURIComponent(dirPath));
        xhr2.onload = function() {
          var resp2 = JSON.parse(xhr2.responseText);
          if (resp2.root) {
            navigateTo(dirPath, function() {
              openFile(val, fileName);
            });
          } else {
            alert('Path not found: ' + val);
          }
        };
        xhr2.send();
      }
    };
    xhr.send();
  }

  input.addEventListener('keydown', function(ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); go(); }
    if (ev.key === 'Escape') { ev.preventDefault(); finish(); }
    ev.stopPropagation();
  });
  input.addEventListener('blur', function() {
    setTimeout(finish, 150);
  });
});

$btnTheme.addEventListener('click', function() {
  state.lightMode = !state.lightMode;
  document.body.classList.toggle('light-mode', state.lightMode);
  if (mermaidLoaded && window.mermaid) {
    window.mermaid.initialize({ startOnLoad: false, theme: state.lightMode ? 'default' : 'dark' });
  }
  renderContent(true);
});

$btnHidden.addEventListener('click', function() {
  state.showHidden = !state.showHidden;
  $btnHidden.classList.toggle('active', state.showHidden);
  renderTree();
});

// --- PDF Export ---
document.getElementById('btn-pdf').addEventListener('click', function() {
  if (!state.activeTab) return;
  var tab = state.tabCache[state.activeTab];
  if (!tab) return;

  // Media files: only images can be exported, video/audio cannot
  if (isMediaExt(tab.ext)) {
    if (MEDIA_VID[tab.ext]) { alert('Video files cannot be exported to PDF.'); return; }
    if (MEDIA_AUD[tab.ext]) { alert('Audio files cannot be exported to PDF.'); return; }
    // Image: export without zoom bar
    var imgEl = document.getElementById('media-target');
    if (!imgEl) return;
    var imgSrc = imgEl.src;
    var title = tab.name || 'Image';
    var fontLink = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';
    var pw = window.open('', '_blank');
    if (!pw) { alert('Pop-up blocked.'); return; }
    pw.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + escHtml(title) + '</title>'
      + '<link rel="stylesheet" href="' + fontLink + '">'
      + '<style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff;} img{max-width:100%;max-height:100vh;object-fit:contain;} @page{margin:10mm;}</style>'
      + '</head><body><img src="' + imgSrc + '"><scr' + 'ipt>document.fonts.ready.then(function(){setTimeout(function(){window.print();},300);});</' + 'scr' + 'ipt></body></html>');
    pw.document.close();
    return;
  }

  if (!tab.data) return;

  var rendered = document.querySelector('.md-rendered');
  var rawView = document.querySelector('.raw-view');
  var contentHTML = '';
  var isMarkdown = tab.data.ext === 'md';

  if (rendered) {
    contentHTML = rendered.innerHTML;
  } else if (rawView) {
    contentHTML = '<pre style="font-family:monospace;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-all;">' + rawView.innerHTML + '</pre>';
  } else {
    contentHTML = $content.innerHTML;
  }

  var title = tab.data.name || 'Document';
  var fontLink = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';

  var printCSS = [
    '*, *::before, *::after { box-sizing: border-box; }',
    'body { font-family: "Pretendard Variable", Pretendard, -apple-system, sans-serif; color: #1f2328; background: #fff; margin: 0; padding: 40px 50px; font-size: 14px; line-height: 1.75; }',
    'h1 { font-size: 1.8em; font-weight: 700; margin: 1.5em 0 0.5em; padding-bottom: 0.3em; border-bottom: 2px solid #0969da; }',
    'h2 { font-size: 1.4em; font-weight: 600; margin: 1.5em 0 0.5em; padding-bottom: 0.25em; border-bottom: 1px solid #d0d7de; color: #0969da; }',
    'h3 { font-size: 1.15em; font-weight: 600; margin: 1.2em 0 0.4em; }',
    'h4 { font-size: 1em; font-weight: 600; margin: 1em 0 0.3em; color: #8250df; }',
    'h5 { font-size: 0.9em; font-weight: 600; margin: 0.8em 0 0.3em; }',
    'h6 { font-size: 0.85em; font-weight: 600; margin: 0.8em 0 0.3em; color: #656d76; }',
    'p { margin: 0.6em 0; }',
    'strong { font-weight: 700; }',
    'em { font-style: italic; }',
    'del { text-decoration: line-through; color: #656d76; }',
    'a { color: #0969da; text-decoration: none; }',
    'code:not(pre code) { background: #eff1f3; color: #cf222e; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.88em; font-family: "Cascadia Code","Fira Code",Consolas,monospace; }',
    'pre { background: #f6f8fa; border: 1px solid #d0d7de; padding: 14px 18px; border-radius: 8px; overflow-x: auto; margin: 0.8em 0; font-size: 13px; line-height: 1.55; position: relative; }',
    'pre code { font-family: "Cascadia Code","Fira Code",Consolas,monospace; background: none; color: #1f2328; padding: 0; }',
    'pre[data-lang]::after { content: attr(data-lang); position: absolute; top: 6px; right: 10px; font-size: 10px; color: #656d76; text-transform: uppercase; }',
    'blockquote { border-left: 3px solid #0969da; padding: 8px 16px; margin: 0.8em 0; color: #656d76; background: rgba(9,105,218,0.04); border-radius: 0 6px 6px 0; }',
    'hr { border: none; border-top: 1px solid #d0d7de; height: 0; margin: 1.5em 0; }',
    'ul, ol { padding-left: 1.6em; margin: 0.5em 0; }',
    'li { margin: 0.25em 0; }',
    'table { width: 100%; border-collapse: collapse; margin: 0.8em 0; font-size: 13px; }',
    'thead { background: rgba(9,105,218,0.06); }',
    'th { padding: 8px 12px; font-weight: 600; text-align: left; border-bottom: 2px solid #d0d7de; }',
    'td { padding: 6px 12px; border-bottom: 1px solid #d0d7de; }',
    'img { max-width: 100%; border-radius: 4px; }',
    'kbd { background: #f6f8fa; border: 1px solid #d0d7de; padding: 1px 6px; border-radius: 4px; font-size: 0.85em; border-bottom-width: 2px; }',
    'mark { background: #fff8c5; padding: 0.1em 0.3em; border-radius: 3px; }',
    'details { border: 1px solid #d0d7de; border-radius: 8px; padding: 10px 14px; margin: 0.8em 0; background: #f6f8fa; }',
    'summary { cursor: pointer; font-weight: 600; color: #0969da; }',
    '.footnotes { font-size: 0.85em; color: #656d76; margin-top: 2em; border-top: 1px solid #d0d7de; padding-top: 1em; }',
    '.footnote-ref { font-size: 0.75em; vertical-align: super; }',
    '.frontmatter-card { border: 1.5px solid #d0d7de; border-left: 4px solid #1a7f37; border-radius: 4px 10px 10px 4px; padding: 14px 18px; margin: 0 0 1.5em; font-size: 13px; display: grid; grid-template-columns: auto 1fr; gap: 4px 14px; align-items: baseline; }',
    '.frontmatter-card .fm-key { color: #1a7f37; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }',
    '.frontmatter-card .fm-val { color: #1f2328; word-break: break-word; }',
    '.frontmatter-card .fm-tag { display: inline-block; border: 1.5px solid #0969da; color: #0969da; padding: 1px 7px; border-radius: 4px; font-size: 12px; margin: 1px 2px; font-weight: 600; }',
    '.task-list-item { list-style: none; margin-left: -1.3em; }',
    '.task-list-item input[type="checkbox"] { margin-right: 6px; }',
    '.hljs-keyword { color: #cf222e; }',
    '.hljs-string, .hljs-attr { color: #0a3069; }',
    '.hljs-comment { color: #6e7781; font-style: italic; }',
    '.hljs-function, .hljs-title { color: #8250df; }',
    '.hljs-number { color: #0550ae; }',
    '.hljs-built_in { color: #953800; }',
    '.tok-kw { color: #cf222e; }',
    '.tok-str { color: #0a3069; }',
    '.tok-num { color: #0550ae; }',
    '.tok-cm { color: #6e7781; font-style: italic; }',
    '.tok-fn { color: #8250df; }',
    '.tok-op { color: #cf222e; }',
    '.tok-key { color: #116329; }',
    '.line-num { display: inline-block; width: 44px; min-width: 44px; text-align: right; padding-right: 16px; color: #656d76; opacity: 0.5; user-select: none; font-size: 12px; }',
    '.raw-line { display: flex; min-height: 1.6em; }',
    '.line-content { flex: 1; white-space: pre-wrap; word-break: break-all; }',
    '@page { margin: 15mm 15mm; }',
    '@media print { body { padding: 0; } }'
  ].join('\\n');

  var printWin = window.open('', '_blank');
  if (!printWin) { alert('Pop-up blocked. Please allow pop-ups.'); return; }

  var docHTML = '<!DOCTYPE html><html><head>'
    + '<meta charset="UTF-8">'
    + '<title>' + escHtml(title) + '</title>'
    + '<link rel="stylesheet" href="' + fontLink + '">'
    + '<link rel="stylesheet" href="http://sdv.local:' + location.port + '/lib/katex/katex.min.css">'
    + '<style>' + printCSS + '</style>'
    + '</head><body>'
    + contentHTML
    + '<scr' + 'ipt>document.fonts.ready.then(function(){setTimeout(function(){window.print();},300);});</' + 'scr' + 'ipt>'
    + '</body></html>';

  printWin.document.write(docHTML);
  printWin.document.close();
});

// --- Sort buttons ---
var sortDefaults = { name: true, size: false, modified: false, created: false };
var sortBtns = document.querySelectorAll('.sort-btn');

function updateSortUI() {
  for (var i = 0; i < sortBtns.length; i++) {
    var btn = sortBtns[i];
    var isActive = btn.dataset.sort === state.sortBy;
    btn.classList.toggle('active', isActive);
    var arrow = btn.querySelector('.sort-arrow');
    if (isActive) {
      arrow.innerHTML = state.sortAsc ? '&#9650;' : '&#9660;';
    } else {
      arrow.innerHTML = '&#9662;';
    }
  }
}

for (var si = 0; si < sortBtns.length; si++) {
  sortBtns[si].addEventListener('click', function() {
    var key = this.dataset.sort;
    if (state.sortBy === key) {
      state.sortAsc = !state.sortAsc;
    } else {
      state.sortBy = key;
      state.sortAsc = sortDefaults[key];
    }
    updateSortUI();
    renderTree();
  });
}

// --- Resize handle ---
(function() {
  var startX, startW, dragging = false;
  $resizeHandle.addEventListener('mousedown', function(e) {
    e.preventDefault();
    if ($sidebar.classList.contains('collapsed')) return;
    dragging = true;
    startX = e.clientX;
    startW = $sidebar.offsetWidth;
    $sidebar.classList.add('resizing');
    $resizeHandle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    var newW = startW + (e.clientX - startX);
    if (newW < 200) newW = 200;
    if (newW > 800) newW = 800;
    $sidebar.style.width = newW + 'px';
    $sidebar.style.minWidth = newW + 'px';
  });
  document.addEventListener('mouseup', function() {
    if (!dragging) return;
    dragging = false;
    $sidebar.classList.remove('resizing');
    $resizeHandle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
})();

// --- Media zoom bar ---
(function() {
  function applyZoom(pct) {
    var target = document.getElementById('media-target');
    if (!target) return;
    var scale = pct / 100;
    target.style.transform = 'scale(' + scale + ')';
    target.style.maxWidth = pct > 100 ? 'none' : '100%';
    target.style.maxHeight = pct > 100 ? 'none' : '';
    var pctEl = document.getElementById('zoom-pct');
    var slider = document.getElementById('zoom-slider');
    if (pctEl) pctEl.textContent = pct + '%';
    if (slider) slider.value = pct;
  }
  $content.addEventListener('click', function(e) {
    var id = e.target.id;
    if (id === 'zoom-in') {
      var s = parseInt(document.getElementById('zoom-slider').value);
      applyZoom(Math.min(400, s + 25));
    } else if (id === 'zoom-out') {
      var s2 = parseInt(document.getElementById('zoom-slider').value);
      applyZoom(Math.max(10, s2 - 25));
    } else if (id === 'zoom-reset') {
      applyZoom(100);
    } else if (id === 'zoom-fit') {
      var target = document.getElementById('media-target');
      if (!target) return;
      var container = target.parentElement;
      // Reset first to get natural dimensions
      target.style.transform = 'scale(1)';
      target.style.maxWidth = 'none';
      target.style.maxHeight = 'none';
      var nw = target.naturalWidth || target.videoWidth || target.offsetWidth;
      var nh = target.naturalHeight || target.videoHeight || target.offsetHeight;
      var cw = container.clientWidth - 32;
      var ch = container.clientHeight - 32;
      if (nw > 0 && nh > 0) {
        var fitPct = Math.round(Math.min(cw / nw, ch / nh) * 100);
        applyZoom(fitPct);
      } else {
        applyZoom(100);
      }
    }
  });
  $content.addEventListener('input', function(e) {
    if (e.target.id === 'zoom-slider') {
      applyZoom(parseInt(e.target.value));
    }
  });
})();

function openHelp() { $helpOverlay.classList.add('visible'); }
function closeHelp() { $helpOverlay.classList.remove('visible'); }
$btnHelp.addEventListener('click', openHelp);
document.getElementById('help-close').addEventListener('click', closeHelp);
$helpOverlay.addEventListener('click', function(e) {
  if (e.target === $helpOverlay) closeHelp();
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
    if ($helpOverlay.classList.contains('visible')) { closeHelp(); return; }
    $search.value = '';
    state.searchQuery = '';
    $search.blur();
    renderTree();
  }
  var notTyping = !e.ctrlKey && !e.metaKey && document.activeElement !== $search;
  if (notTyping) {
    if (e.key === 'b') toggleSidebar();
    if (e.key === 't') $btnTheme.click();
    if (e.key === 's') cycleViewMode();
    if (e.key === 'w') $btnWrap.click();
    if (e.key === 'p') document.getElementById('btn-pdf').click();
    if (e.key === 'F2') {
      var sel = $tree.querySelector('.tree-item.selected');
      if (sel && !sel.classList.contains('parent-dir')) {
        startRename(sel, sel.dataset.path, sel.dataset.name);
      }
    }
    if (e.key === 'Delete') {
      var sel2 = $tree.querySelector('.tree-item.selected');
      if (sel2 && !sel2.classList.contains('parent-dir')) {
        doDelete(sel2.dataset.path, sel2.dataset.name);
      }
    }
    if (e.key === '?') {
      if ($helpOverlay.classList.contains('visible')) closeHelp();
      else openHelp();
    }
  }
});

// --- Init ---
var INITIAL_FILE_PATH = ${INITIAL_FILE ? JSON.stringify(INITIAL_FILE) : 'null'};
navigateTo('', INITIAL_FILE_PATH ? function() {
  openFile(INITIAL_FILE_PATH, INITIAL_FILE_PATH.split('/').pop());
} : null);
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
  } else if (pathname === '/api/image') {
    handleImage(req, res, parsed.query);
  } else if (pathname === '/api/chroot') {
    handleChroot(req, res, parsed.query);
  } else if (pathname === '/api/rename' && req.method === 'POST') {
    handlePostBody(req, function(body) {
      if (!body.oldPath || !body.newPath) return sendError(res, 'oldPath and newPath required');
      var oldP = path.resolve(body.oldPath).replace(/\\/g, '/');
      var newP = path.resolve(body.newPath).replace(/\\/g, '/');
      if (!isPathSafe(oldP) || !isPathSafe(newP)) return sendError(res, 'Access denied', 403);
      if (!fs.existsSync(oldP)) return sendError(res, 'File not found', 404);
      if (fs.existsSync(newP)) return sendError(res, 'Target already exists', 409);
      try { fs.renameSync(oldP, newP); sendJSON(res, { ok: true, oldPath: oldP, newPath: newP }); }
      catch(e) { sendError(res, 'Rename failed: ' + e.message); }
    });
  } else if (pathname === '/api/delete' && req.method === 'POST') {
    handlePostBody(req, function(body) {
      if (!body.path) return sendError(res, 'path required');
      var dp = path.resolve(body.path).replace(/\\/g, '/');
      if (!isPathSafe(dp)) return sendError(res, 'Access denied', 403);
      if (!fs.existsSync(dp)) return sendError(res, 'File not found', 404);
      try {
        var st = fs.statSync(dp);
        if (st.isDirectory()) { fs.rmSync(dp, { recursive: true }); }
        else { fs.unlinkSync(dp); }
        sendJSON(res, { ok: true, path: dp });
      } catch(e) { sendError(res, 'Delete failed: ' + e.message); }
    });
  } else if (pathname === '/api/media') {
    if (!parsed.query.path) return sendError(res, 'Path required');
    const filePath = path.resolve(parsed.query.path).replace(/\\/g, '/');
    if (!isPathSafe(filePath)) return sendError(res, 'Access denied', 403);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mimeMap = {
      png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', svg:'image/svg+xml',
      webp:'image/webp', bmp:'image/bmp', ico:'image/x-icon', tiff:'image/tiff', tif:'image/tiff', avif:'image/avif',
      mp4:'video/mp4', webm:'video/webm', ogg:'video/ogg', mov:'video/quicktime', avi:'video/x-msvideo', mkv:'video/x-matroska',
      mp3:'audio/mpeg', wav:'audio/wav', flac:'audio/flac', aac:'audio/aac', opus:'audio/opus', wma:'audio/x-ms-wma', m4a:'audio/mp4',
      pdf:'application/pdf'
    };
    const mime = mimeMap[ext];
    if (!mime) return sendError(res, 'Unsupported media type');
    try {
      const stat = fs.statSync(filePath);
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        res.writeHead(206, { 'Content-Type': mime, 'Content-Range': 'bytes ' + start + '-' + end + '/' + stat.size, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
        fs.createReadStream(filePath, { start: start, end: end }).pipe(res);
      } else {
        res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600' });
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (e) { sendError(res, 'Cannot read file: ' + e.message, 404); }
  } else if (pathname.startsWith('/lib/katex/')) {
    const katexFile = path.join(__dirname, pathname);
    if (fs.existsSync(katexFile)) {
      const ext = path.extname(katexFile);
      const mimeMap = { '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
      res.writeHead(200, { 'Content-Type': (mimeMap[ext] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'public, max-age=86400' });
      res.end(fs.readFileSync(katexFile));
    } else {
      sendError(res, 'Not found', 404);
    }
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
    const serverUrl = 'http://sdv.local:' + PORT;
    console.log('');
    console.log('  SDV running at ' + serverUrl);
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
