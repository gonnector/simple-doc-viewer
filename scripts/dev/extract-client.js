// ============================================================
// Phase 2 마이그레이션 도구 — cooked HTML 덤프에서 client/ 정적 파일 추출
//
// 원리: getHTML() template literal을 Node가 평가한 결과(= served HTML)는
// 이중 이스케이프가 이미 정확히 해석된 산출물이므로, 이를 분할하면
// 수작업 de-escaping 없이 무손실로 정적 파일을 얻는다.
//
// 사용: node scripts/dev/extract-client.js
// 입력: scripts/dev/_cooked-dump.html (서버 GET / 응답 저장본)
// 출력: client/index.html, client/style.css, client/app/*.js, client/app/manifest.json
// ============================================================
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DUMP = path.join(__dirname, '_cooked-dump.html');
const CLIENT = path.join(ROOT, 'client');
const APP = path.join(CLIENT, 'app');

const html = fs.readFileSync(DUMP, 'utf8');

// --- 1. 3분할: style / script / 나머지(index.html 골격) ---
const styleM = html.match(/<style>([\s\S]*?)<\/style>/);
const scriptM = html.match(/<script>([\s\S]*?)<\/script>/);
if (!styleM || !scriptM) throw new Error('style/script 블록을 찾지 못함');

const css = styleM[1];
let js = scriptM[1];

// --- 2. 부트 주입 2곳 패치 (서버 값 → /api/config 런타임 fetch) ---
const rootDirRe = /^  rootDir: .*,$/m;
if (!rootDirRe.test(js)) throw new Error('rootDir 주입 라인을 찾지 못함');
js = js.replace(rootDirRe, '  rootDir: null,');

const initRe = /var INITIAL_FILE_PATH = .*;\nnavigateTo\('', INITIAL_FILE_PATH \? function\(\) \{\n  openFile\(INITIAL_FILE_PATH, INITIAL_FILE_PATH\.split\('\/'\)\.pop\(\)\);\n\} : null\);\ninitMermaid\(\);/;
if (!initRe.test(js)) throw new Error('Init 블록을 찾지 못함');
js = js.replace(initRe, [
  "var INITIAL_FILE_PATH = null;",
  "fetch('/api/config')",
  "  .then(function(r) { return r.json(); })",
  "  .then(function(cfg) {",
  "    state.rootDir = cfg.rootDir;",
  "    INITIAL_FILE_PATH = cfg.initialFile;",
  "    navigateTo('', INITIAL_FILE_PATH ? function() {",
  "      openFile(INITIAL_FILE_PATH, INITIAL_FILE_PATH.split('/').pop());",
  "    } : null);",
  "  });",
  "initMermaid();"
].join('\n'));

// --- 3. JS를 섹션 마커 기준으로 분할 ---
// 마커 출현 순서 기준 매핑 (중복 마커 'Search'는 출현 순서로 구분)
// null = 직전 파일에 병합
const SPLIT_MAP = [
  { marker: '// --- State ---', file: 'state.js' },
  { marker: '// --- DOM refs ---', file: null },
  { marker: '// --- Helpers ---', file: 'helpers.js' },
  { marker: '// --- API ---', file: 'api.js' },
  { marker: '// --- Drag & Drop ---', file: 'dragdrop.js' },
  { marker: '// --- Navigation ---', file: 'navigation.js' },
  { marker: '// --- File Tree ---', file: 'tree.js' },
  { marker: '// --- Search ---', file: 'search.js' },
  { marker: '// --- Tabs ---', file: 'tabs.js' },
  { marker: '// --- Content rendering ---', file: 'content.js' },
  { marker: '// --- Markdown Parser ---', file: 'markdown.js' },
  { marker: '// --- Raw Text Renderer ---', file: 'highlight.js' },
  { marker: '// --- Settings ---', file: 'ui.js' },
  { marker: '// --- Split view scroll sync ---', file: null },
  { marker: '// --- Path badge click → editable input ---', file: null },
  { marker: '// --- Folder Picker ---', file: null },
  { marker: '// --- PDF Export ---', file: 'print.js' },
  { marker: '// --- Sort buttons ---', file: 'ui2.js' },
  { marker: '// --- Resize handle ---', file: null },
  { marker: '// --- Media zoom bar ---', file: 'media-zoom.js' },
  { marker: '// --- In-document Find ---', file: 'find.js' },
  { marker: '// --- Search ---', file: 'search-wiring.js' },
  { marker: '// --- Filter Panel ---', file: null },
  { marker: '// --- ResizeObserver for narrow mode ---', file: null },
  { marker: '// --- Mermaid ---', file: 'mermaid-loader.js' },
  { marker: '// --- Keyboard shortcuts ---', file: 'shortcuts.js' },
  { marker: '// --- Init ---', file: 'main.js' }
];

// 마커 위치를 출현 순서대로 스캔
let cursor = 0;
const positions = [];
for (const entry of SPLIT_MAP) {
  const idx = js.indexOf('\n' + entry.marker + '\n', cursor);
  if (idx === -1) throw new Error('마커 누락: ' + entry.marker + ' (cursor ' + cursor + ')');
  positions.push({ ...entry, pos: idx + 1 });
  cursor = idx + entry.marker.length;
}

// 분할 + null 병합
const files = []; // { name, content }
let preamble = js.slice(0, positions[0].pos); // 헤더 주석 — 첫 파일에 포함
for (let i = 0; i < positions.length; i++) {
  const end = i + 1 < positions.length ? positions[i + 1].pos : js.length;
  const chunk = js.slice(positions[i].pos, end);
  if (positions[i].file === null) {
    files[files.length - 1].content += chunk;
  } else {
    files.push({ name: positions[i].file, content: (files.length === 0 ? preamble : '') + chunk });
  }
}

// --- 4. 무손실 검증: 분할 파일 재결합 === 패치된 원본 ---
const rejoined = files.map(f => f.content).join('');
if (rejoined !== js) {
  throw new Error('재결합 불일치! rejoined=' + rejoined.length + ' original=' + js.length);
}

// --- 5. index.html 골격 생성 ---
let indexHtml = html
  .replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="/client/style.css">')
  .replace(/<script>[\s\S]*?<\/script>/, '<script src="/client/app.js"></script>');

// --- 6. 쓰기 ---
fs.mkdirSync(APP, { recursive: true });
fs.writeFileSync(path.join(CLIENT, 'index.html'), indexHtml);
fs.writeFileSync(path.join(CLIENT, 'style.css'), css);
for (const f of files) fs.writeFileSync(path.join(APP, f.name), f.content);
fs.writeFileSync(path.join(APP, 'manifest.json'),
  JSON.stringify({ order: files.map(f => f.name) }, null, 2) + '\n');

// --- 7. 문법 게이트 ---
new Function(rejoined); // throw 시 실패
console.log('OK: client/index.html (' + indexHtml.length + ' bytes), style.css (' + css.length + ' bytes)');
console.log('OK: app/ ' + files.length + '개 파일, 재결합 무손실 검증 + new Function 문법 통과');
console.log(files.map(f => '  ' + f.name + ' (' + f.content.length + ')').join('\n'));
