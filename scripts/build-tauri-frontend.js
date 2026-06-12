// Tauri frontendDist 어셈블리 — client/ + lib/ + public/ → dist-tauri/
// URL 절대 경로(/client/app.js, /lib/katex/...)가 tauri 커스텀 프로토콜 루트에서
// 그대로 해석되도록 디렉토리 구조를 미러링한다. 번들러 불필요.
// 사용: node scripts/build-tauri-frontend.js  (= npm run build:frontend, tauri beforeBuildCommand)
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist-tauri');
const { buildAppJs } = require(path.join(ROOT, 'server', 'routes', 'static.js'));

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function downloadMermaid(dest) {
  return new Promise((resolve, reject) => {
    const url = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
    function get(target, redirects) {
      if (redirects > 5) return reject(new Error('too many redirects'));
      https.get(target, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return get(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
        const tmp = dest + '.download';
        const ws = fs.createWriteStream(tmp);
        res.pipe(ws);
        ws.on('finish', () => ws.close(() => { fs.renameSync(tmp, dest); resolve(); }));
        ws.on('error', reject);
        res.on('error', reject);
      }).on('error', reject);
    }
    get(url, 0);
  });
}

async function main() {
  // 0. 클린 + 골격
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, 'client'), { recursive: true });

  // 1. index.html (그대로 — 절대 경로가 dist 구조와 일치)
  fs.copyFileSync(path.join(ROOT, 'client', 'index.html'), path.join(DIST, 'index.html'));

  // 2. 결합 app.js + style.css (브라우저판과 동일한 단일 스크립트 — hoisting 보존)
  fs.writeFileSync(path.join(DIST, 'client', 'app.js'), buildAppJs());
  fs.copyFileSync(path.join(ROOT, 'client', 'style.css'), path.join(DIST, 'client', 'style.css'));

  // 3. lib/ — katex + mermaid (mermaid는 없으면 CDN에서 받아 번들)
  copyDir(path.join(ROOT, 'lib', 'katex'), path.join(DIST, 'lib', 'katex'));
  const mermaidSrc = path.join(ROOT, 'lib', 'mermaid.min.js');
  if (!fs.existsSync(mermaidSrc)) {
    console.log('mermaid.min.js not found — downloading from CDN...');
    await downloadMermaid(mermaidSrc);
  }
  fs.copyFileSync(mermaidSrc, path.join(DIST, 'lib', 'mermaid.min.js'));

  // 4. public/ — 아이콘 (index.html head 참조). sw.js는 복사하되 Tauri에서는 등록 안 됨
  copyDir(path.join(ROOT, 'public'), path.join(DIST, 'public'));

  // 4b. (디버그 전용) SDV_DEBUG_BEACON=1 이면 진단 비콘 주입 — 릴리스 배포에 사용 금지
  if (process.env.SDV_DEBUG_BEACON === '1') {
    // 파일별 진행 프로브 + 선두 onerror — 사망 지점 특정 (스크린샷으로 placeholder 판독)
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'client', 'app', 'manifest.json'), 'utf8'));
    let probed = [
      'window.onerror = function(m, s, l) { try { document.getElementById("search-input").placeholder = ("E:" + String(m).slice(0, 45) + " L" + l); } catch (e) {} return false; };',
      'function __probe(n) { try { document.getElementById("search-input").placeholder = "P:" + n; } catch (e) {} }',
      ''
    ].join('\n');
    for (const name of manifest.order) {
      probed += fs.readFileSync(path.join(ROOT, 'client', 'app', name), 'utf8');
      probed += '\n;__probe("' + name + '");\n';
    }
    probed += '\nsetTimeout(function() { var si = document.getElementById("search-input"); if (si.placeholder.indexOf("E:") !== 0) si.placeholder = "B3 r=" + String(state.rootDir).slice(-20) + " n=" + state.items.length + " e=" + (window.__cfgErr || "-"); }, 3000);\n';
    probed = probed.replace('if (cfg.error) return;', 'if (cfg.error) { window.__cfgErr = cfg.error; return; }');
    fs.writeFileSync(path.join(DIST, 'client', 'app.js'), probed);
    console.log('!! DEBUG PROBE injected (SDV_DEBUG_BEACON=1)');
  }

  // 5. 검증 — 결합 스크립트 문법
  new Function(fs.readFileSync(path.join(DIST, 'client', 'app.js'), 'utf8'));
  const size = (p) => fs.statSync(p).size;
  console.log('dist-tauri ready:');
  console.log('  index.html ' + size(path.join(DIST, 'index.html')) + ' bytes');
  console.log('  client/app.js ' + size(path.join(DIST, 'client', 'app.js')) + ' bytes (syntax OK)');
  console.log('  client/style.css ' + size(path.join(DIST, 'client', 'style.css')) + ' bytes');
  console.log('  lib/mermaid.min.js ' + size(path.join(DIST, 'lib', 'mermaid.min.js')) + ' bytes');
}

main().catch((e) => { console.error('build failed:', e.message); process.exit(1); });
