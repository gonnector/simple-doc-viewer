// 정적 자원 서빙 — client/(앱 본체), public/(PWA), lib/(katex·mermaid)
const fs = require('fs');
const path = require('path');
const { sendError } = require('../respond');

const PKG_ROOT = path.join(__dirname, '..', '..');
const CLIENT_DIR = path.join(PKG_ROOT, 'client');
const APP_DIR = path.join(CLIENT_DIR, 'app');

// client/app/*.js를 manifest 순서로 결합 — 단일 <script>로 서빙하여
// 분리 전(한 덩어리 스크립트)과 hoisting 의미를 100% 동일하게 유지
function buildAppJs() {
  const manifest = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'manifest.json'), 'utf8'));
  return manifest.order.map(function(name) {
    return fs.readFileSync(path.join(APP_DIR, name), 'utf8');
  }).join('');
}

function handleIndex(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(fs.readFileSync(path.join(CLIENT_DIR, 'index.html')));
}

function handleClientAsset(req, res, pathname) {
  if (pathname === '/client/app.js') {
    try {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end(buildAppJs());
    } catch (e) {
      return sendError(res, 'Client build failed: ' + e.message, 500);
    }
  }
  if (pathname === '/client/style.css') {
    res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-cache' });
    return res.end(fs.readFileSync(path.join(CLIENT_DIR, 'style.css')));
  }
  return sendError(res, 'Not found', 404);
}

function handleServiceWorker(req, res) {
  // PWA Service Worker (root-scope 서빙 필수)
  const swPath = path.join(PKG_ROOT, 'public', 'sw.js');
  if (fs.existsSync(swPath)) {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' });
    res.end(fs.readFileSync(swPath));
  } else {
    sendError(res, 'SW not found', 404);
  }
}

function handlePublic(req, res, pathname) {
  // PWA 자원 (manifest, 아이콘 등) — '..' 탈출 방지 prefix 검증
  const pubBase = path.join(PKG_ROOT, 'public');
  const pubPath = path.resolve(path.join(PKG_ROOT, pathname.replace(/^\//, '')));
  if (!pubPath.startsWith(pubBase + path.sep)) {
    return sendError(res, 'Access denied', 403);
  }
  if (fs.existsSync(pubPath)) {
    const ext = path.extname(pubPath);
    const mimeMap = {
      '.json': 'application/manifest+json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.js': 'application/javascript',
    };
    res.writeHead(200, { 'Content-Type': (mimeMap[ext] || 'application/octet-stream') + (ext === '.png' || ext === '.ico' ? '' : '; charset=utf-8'), 'Cache-Control': 'public, max-age=3600' });
    res.end(fs.readFileSync(pubPath));
  } else {
    sendError(res, 'Not found', 404);
  }
}

function handleKatex(req, res, pathname) {
  const katexBase = path.join(PKG_ROOT, 'lib', 'katex');
  const katexFile = path.resolve(path.join(PKG_ROOT, pathname));
  if (!katexFile.startsWith(katexBase + path.sep)) {
    return sendError(res, 'Access denied', 403);
  }
  if (fs.existsSync(katexFile)) {
    const ext = path.extname(katexFile);
    const mimeMap = { '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
    res.writeHead(200, { 'Content-Type': (mimeMap[ext] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'public, max-age=86400' });
    res.end(fs.readFileSync(katexFile));
  } else {
    sendError(res, 'Not found', 404);
  }
}

function handleMermaidLib(req, res) {
  const mermaidPath = path.join(PKG_ROOT, 'lib', 'mermaid.min.js');
  if (fs.existsSync(mermaidPath)) {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    res.end(fs.readFileSync(mermaidPath));
  } else {
    sendError(res, 'Mermaid not available', 404);
  }
}

module.exports = { handleIndex, handleClientAsset, handleServiceWorker, handlePublic, handleKatex, handleMermaidLib, buildAppJs };
