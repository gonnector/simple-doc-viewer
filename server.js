// ============================================================
// Simple Doc Viewer — server.js (thin entry)
// 경량 로컬 문서 뷰어 (Node.js 내장 모듈만 사용, npm 의존성 없음)
//
// 구조 (v0.77 리팩토링 — template literal 해체):
//   server/         서버 모듈 (config/state/util/respond/routes)
//   client/         정적 프론트엔드 (index.html, style.css, app/*.js)
//   client/app.js 는 app/*.js를 manifest 순서로 결합해 단일 스크립트로 서빙
// ============================================================

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');

const state = require('./server/state');
const { sendError, handlePostBody } = require('./server/respond');
const { downloadMermaid } = require('./server/mermaid-download');
const { handleList } = require('./server/routes/list');
const { handleRead } = require('./server/routes/read');
const { handleSearch } = require('./server/routes/search');
const { handleRename, handleDelete } = require('./server/routes/manage');
const { handleImage, handleMedia } = require('./server/routes/media');
const { handleChroot } = require('./server/routes/chroot');
const { handlePickFolder } = require('./server/routes/pick-folder');
const { handleConfig } = require('./server/routes/config');
const staticRoutes = require('./server/routes/static');

// === [1] CLI 인자 파싱 ===
const args = process.argv.slice(2);
let ROOT_DIR = process.cwd();
let INITIAL_FILE = null;

for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--port' || args[i] === '-p') && args[i + 1]) {
    state.port = parseInt(args[i + 1]); i++;
  } else if ((args[i] === '--root' || args[i] === '-r') && args[i + 1]) {
    ROOT_DIR = path.resolve(args[i + 1]); i++;
  } else if (args[i] === '--no-open') {
    state.noOpen = true;
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

state.rootDir = ROOT_DIR;
state.initialFile = INITIAL_FILE;

// === [2] 보안 게이트 ===
// DNS rebinding + CSRF 방어: Host가 localhost 계열이 아니거나,
// Origin이 존재하는데 localhost 계열이 아니면 모든 요청 거부
const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
function isRequestAllowed(req) {
  if (!LOCAL_HOST_RE.test(req.headers.host || '')) return false;
  if (req.headers.origin && !LOCAL_ORIGIN_RE.test(req.headers.origin)) return false;
  return true;
}

// === [3] 라우팅 ===
const server = http.createServer(function (req, res) {
  if (!isRequestAllowed(req)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (pathname === '/') {
    staticRoutes.handleIndex(req, res);
  } else if (pathname === '/api/config') {
    handleConfig(req, res);
  } else if (pathname === '/api/list') {
    handleList(req, res, parsed.query);
  } else if (pathname === '/api/read') {
    handleRead(req, res, parsed.query);
  } else if (pathname === '/api/image') {
    handleImage(req, res, parsed.query);
  } else if (pathname === '/api/chroot' && req.method === 'POST') {
    handlePostBody(req, res, function(body) {
      handleChroot(req, res, body);
    });
  } else if (pathname === '/api/rename' && req.method === 'POST') {
    handlePostBody(req, res, function(body) {
      handleRename(req, res, body);
    });
  } else if (pathname === '/api/delete' && req.method === 'POST') {
    handlePostBody(req, res, function(body) {
      handleDelete(req, res, body);
    });
  } else if (pathname === '/api/pick-folder' && req.method === 'POST') {
    handlePickFolder(req, res);
  } else if (pathname === '/api/search') {
    handleSearch(req, res, parsed.query);
  } else if (pathname === '/api/media') {
    handleMedia(req, res, parsed.query);
  } else if (pathname === '/sw.js' || pathname === '/public/sw.js') {
    staticRoutes.handleServiceWorker(req, res);
  } else if (pathname.startsWith('/client/')) {
    staticRoutes.handleClientAsset(req, res, pathname);
  } else if (pathname.startsWith('/public/')) {
    staticRoutes.handlePublic(req, res, pathname);
  } else if (pathname.startsWith('/lib/katex/')) {
    staticRoutes.handleKatex(req, res, pathname);
  } else if (pathname === '/lib/mermaid.min.js') {
    staticRoutes.handleMermaidLib(req, res);
  } else {
    sendError(res, 'Not found', 404);
  }
});

// === [4] 기동 ===

// Mermaid 자동 다운로드 시작
downloadMermaid();

function openBrowser(url) {
  if (state.noOpen) return;
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
  server.listen(state.port, '127.0.0.1', function () {
    const serverUrl = 'http://localhost:' + state.port;
    console.log('');
    console.log('  SDV running at ' + serverUrl);
    console.log('  Root: ' + state.rootDir);
    console.log('');
    openBrowser(serverUrl);
  });
}

server.on('error', function (err) {
  if (err.code === 'EADDRINUSE') {
    console.log('');
    console.log('  Port ' + state.port + ' is already in use.');
    console.log('  Finding and stopping the existing process...');
    findAndKillPort(state.port, function (killed) {
      if (killed) {
        console.log('  Restarting server...');
        console.log('');
        setTimeout(startServer, 1000);
      } else {
        console.error('  Could not find the process. Please free port ' + state.port + ' manually.');
        process.exit(1);
      }
    });
  } else {
    console.error('  Server error: ' + err.message);
    process.exit(1);
  }
});

startServer();
