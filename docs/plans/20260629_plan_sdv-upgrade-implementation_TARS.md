---
TITLE: SDV 업그레이드 구현 계획 (4개 기능)
AUTHOR: TARS
CREATED: 2026-06-29
UPDATED: 2026-06-29
CONTRIBUTORS: [TARS, Dylan]
TAGS: [sdv, implementation-plan, zoom, refresh, csv, file-association]
RELATED:
  - 20260629_plan_sdv-upgrade-4features_TARS.md
---

# SDV 업그레이드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SDV(v0.79)에 문서 줌, 새로고침 트리 갱신, CSV/TSV 표+정렬, 파일연결(md/pdf) 4개 기능을 추가해 v0.80.0으로 올린다.

**Architecture:** 2에디션 단일 코드베이스. 기능 1~3은 `client/app/*.js`(공통 클라이언트)만 수정, 기능 4는 `src-tauri/tauri.conf.json`. 신규 클라 파일은 `client/app/manifest.json` 순서에 등록하면 `buildAppJs()`(server/routes/static.js)가 결합하고 `npm run build:frontend`가 문법 검증한다.

**Tech Stack:** Vanilla JS(전역 스코프, template literal 미사용), Node 테스트 하네스(vm), Tauri v2 / NSIS, CSS.

## Global Constraints

- 버전: 최종 0.80.0 (package.json / src-tauri/Cargo.toml / src-tauri/tauri.conf.json 3곳 동기화)
- 신규 전역 식별자는 `sdv` 접두 (Tauri 주입 전역 `isTauri`/`invoke`와 충돌 방지)
- template literal 금지 (작은따옴표 문자열만 — 서버 결합 시 이스케이프 깨짐 방지)
- 신규 `client/app/*.js`는 반드시 `manifest.json` `order`에 등록
- 외부 런타임 의존성 추가 금지 (CSV는 자체 파서)
- 커밋: `git add -A` 금지, 명시 파일 add, `git diff --cached --stat` 검증. 메시지 Gonnector 문법(`Worker: TARS` / `Coworker: Dylan gonnector@gonnector.com`)
- 브랜치 `feat/sdv-upgrade-4features`. push는 안정 마일스톤마다 (Dylan 승인됨)
- 각 변경 후 `npm run build:frontend`로 결합 app.js 문법 검증 (PASS 필수)

---

### Task 1: 기능2 — 새로고침이 폴더 트리도 갱신

**Files:**
- Modify: `client/app/navigation.js` (refreshTree 추가)
- Modify: `client/app/find.js:161-182` (reloadActiveDoc 확장)
- Test scenario: `docs/testing/components/refresh-tree/20260629_test-scenario_refresh-tree_TARS.md`

**Interfaces:**
- Produces: `refreshTree()` — 현재 디렉토리(또는 활성 검색) 재나열 후 renderTree, 트리 스크롤 보존
- Consumes (기존 전역): `apiList`, `renderTree`, `doSearch`, `state`, `$tree`, `$pathBadge`

- [ ] **Step 1: navigation.js에 refreshTree 추가** (`navigateTo` 함수 뒤, 33행 부근)

```javascript
// 새로고침 — 현재 디렉토리(또는 활성 검색)를 재나열. navigateTo와 달리 검색을 비우지 않음.
function refreshTree() {
  if (state.searchQuery) {
    doSearch(state.searchQuery); // 검색 모드: 결과 재조회 (스크롤은 best-effort)
    return;
  }
  var sc = $tree ? $tree.scrollTop : 0;
  apiList(state.currentPath, function (data) {
    if (data.error) return; // 현재 폴더가 외부 삭제 등으로 접근 불가 시 트리 유지
    state.currentPath = data.path;
    state.parentPath = data.parent;
    state.items = data.items;
    $pathBadge.textContent = data.path;
    $pathBadge.title = data.path;
    renderTree();
    if ($tree) $tree.scrollTop = sc; // 스크롤 위치 복원 (선택 .selected는 activeTab 기반이라 자동 보존)
  });
}
```

- [ ] **Step 2: find.js reloadActiveDoc()를 확장** (161-182행 전체 교체)

```javascript
// Reload active document + 좌측 폴더 트리 동시 갱신 (F5는 앱 전체 초기화이지만 이 버튼/단축키 R은 현재 뷰 갱신)
function reloadActiveDoc() {
  // 1) 좌측 폴더 트리 갱신 (외부에서 추가/삭제/이름변경된 파일 반영)
  if (typeof refreshTree === 'function') refreshTree();

  // 2) 활성 문서 재로드
  if (!state.activeTab) return;
  var filePath = state.activeTab;
  if (filePath.indexOf('__dropped__/') === 0) return; // 가상 파일은 재로드 불가(트리는 위에서 이미 갱신)

  var tab = state.tabCache[filePath];
  if (!tab) return;

  var btn = document.getElementById('btn-reload');
  if (btn) { btn.style.opacity = '0.5'; btn.disabled = true; }

  tab.loading = true;
  renderContent();

  apiRead(filePath, function (data) {
    tab.data = data;
    tab.loading = false;
    if (state.activeTab === filePath) renderContent();
    if (btn) { btn.style.opacity = ''; btn.disabled = false; }
  });
}
```

- [ ] **Step 3: 결합 문법 검증**

Run: `npm run build:frontend`
Expected: `client/app.js ... (syntax OK)` 출력, 종료코드 0

- [ ] **Step 4: 테스트 시나리오 작성 + 수동 검증 기록**

`docs/testing/components/refresh-tree/20260629_test-scenario_refresh-tree_TARS.md`에 시나리오:
- T-001: 외부에서 현재 폴더에 새 파일 생성 → 새로고침(R) → 트리에 새 파일 등장
- T-002: 외부에서 파일 삭제 → 새로고침 → 트리에서 사라짐
- T-003: 활성 문서 열린 상태에서 새로고침 → 문서 재로드 + 트리 갱신 동시
- T-004: 검색 활성 상태에서 새로고침 → 검색 결과 재조회, 검색어 유지
- T-005: 트리 스크롤 내린 상태에서 새로고침 → 스크롤 위치 유지(비검색)

- [ ] **Step 5: Commit**

```bash
git -C "E:/projects/simple-doc-viewer" add client/app/navigation.js client/app/find.js docs/testing/components/refresh-tree/20260629_test-scenario_refresh-tree_TARS.md
git -C "E:/projects/simple-doc-viewer" diff --cached --stat
git -C "E:/projects/simple-doc-viewer" commit -F - <<'EOF'
feat: 새로고침이 좌측 폴더 트리도 갱신 (기능2)

reloadActiveDoc()가 활성 문서 재로드와 함께 refreshTree()로 현재
디렉토리(또는 활성 검색)를 재나열. 트리 스크롤/선택/검색어 보존.

Worker: TARS
Coworker: Dylan gonnector@gonnector.com
EOF
```

---

### Task 2: 기능1 — 문서 영역 줌 (Ctrl +/-/0)

**Files:**
- Create: `client/app/doc-zoom.js`
- Modify: `client/app/manifest.json` (media-zoom.js 뒤에 doc-zoom.js)
- Modify: `client/app/shortcuts.js` (Ctrl 조합 줌 키)
- Modify: `client/style.css` (zoom 규칙 + 토스트)
- Test scenario: `docs/testing/components/doc-zoom/20260629_test-scenario_doc-zoom_TARS.md`

**Interfaces:**
- Produces: 전역 `sdvZoomIn()`, `sdvZoomOut()`, `sdvZoomReset()`. `#content`에 CSS 변수 `--doc-zoom` 설정. 텍스트 컨테이너(`.md-rendered`, `.raw-view`, `.csv-wrap`)가 `zoom: var(--doc-zoom,1)`로 배율 적용
- Consumes: `$content`(state.js), localStorage

- [ ] **Step 1: doc-zoom.js 생성**

```javascript
// --- Document zoom (텍스트 뷰 전용, 미디어/사이드바 제외) ---
(function () {
  var KEY = 'sdv-doc-zoom';
  var MIN = 50, MAX = 300, STEP = 10;
  var level = 100;
  try { var saved = parseInt(localStorage.getItem(KEY), 10); if (saved >= MIN && saved <= MAX) level = saved; } catch (e) {}

  var $toast = null, _t = null;
  function toast() {
    if (!$toast) { $toast = document.createElement('div'); $toast.id = 'doc-zoom-toast'; document.body.appendChild($toast); }
    $toast.textContent = level + '%';
    $toast.classList.add('visible');
    clearTimeout(_t);
    _t = setTimeout(function () { $toast.classList.remove('visible'); }, 900);
  }
  function apply() {
    if ($content) $content.style.setProperty('--doc-zoom', (level / 100).toString());
    try { localStorage.setItem(KEY, String(level)); } catch (e) {}
  }
  function setLevel(v, withToast) {
    var clamped = Math.max(MIN, Math.min(MAX, v));
    if (clamped === level && !withToast) return;
    level = clamped; apply(); if (withToast) toast();
  }
  window.sdvZoomIn = function () { setLevel(level + STEP, true); };
  window.sdvZoomOut = function () { setLevel(level - STEP, true); };
  window.sdvZoomReset = function () { setLevel(100, true); };

  // Ctrl/Cmd + 휠 줌 (브라우저식). passive:false로 preventDefault 가능
  if ($content) {
    $content.addEventListener('wheel', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      if (e.deltaY < 0) window.sdvZoomIn(); else window.sdvZoomOut();
    }, { passive: false });
  }
  apply(); // 로드 시 저장된 배율 복원 (토스트 없음)
})();
```

- [ ] **Step 2: manifest.json 등록** (`"media-zoom.js",` 다음 줄에 추가)

```json
    "media-zoom.js",
    "doc-zoom.js",
    "find.js",
```

- [ ] **Step 3: shortcuts.js에 줌 키 추가** (Ctrl+F 블록(12행) 다음에 삽입)

```javascript
  // Ctrl/Cmd +/-/0 문서 줌 (WebView2 내장 줌 가로채기 차단)
  if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); sdvZoomIn(); }
  if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); sdvZoomOut(); }
  if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); sdvZoomReset(); }
```

- [ ] **Step 4: style.css에 규칙 추가** (파일 끝에 append)

```css
/* 문서 영역 줌 (텍스트 뷰 전용 — 미디어/사이드바 제외) */
.md-rendered, .raw-view, .csv-wrap { zoom: var(--doc-zoom, 1); }
#doc-zoom-toast {
  position: fixed; bottom: 48px; right: 24px;
  background: rgba(0,0,0,0.78); color: #fff;
  padding: 6px 12px; border-radius: 6px;
  font-size: 13px; font-variant-numeric: tabular-nums;
  opacity: 0; transform: translateY(6px);
  transition: opacity .15s ease, transform .15s ease;
  pointer-events: none; z-index: 9999;
}
#doc-zoom-toast.visible { opacity: 1; transform: translateY(0); }
```

- [ ] **Step 5: 결합 문법 검증 + doc-zoom.js 포함 확인**

Run: `npm run build:frontend && node -e "var s=require('fs').readFileSync('dist-tauri/client/app.js','utf8'); process.exit(s.indexOf('sdvZoomIn')>=0?0:1)"`
Expected: syntax OK + 종료코드 0 (결합본에 sdvZoomIn 포함)

- [ ] **Step 6: 테스트 시나리오 작성**

`docs/testing/components/doc-zoom/...`: T-001 Ctrl+= 확대 / T-002 Ctrl+- 축소 / T-003 Ctrl+0 리셋 / T-004 Ctrl+휠 / T-005 50~300% 한계 / T-006 재시작 후 배율 유지 / T-007 마크다운·코드·CSV 표 모두 확대되고 사이드바/탭바는 불변 / T-008 미디어(이미지) 뷰는 문서 줌 영향 없음

- [ ] **Step 7: Commit**

```bash
git -C "E:/projects/simple-doc-viewer" add client/app/doc-zoom.js client/app/manifest.json client/app/shortcuts.js client/style.css docs/testing/components/doc-zoom/20260629_test-scenario_doc-zoom_TARS.md
git -C "E:/projects/simple-doc-viewer" diff --cached --stat
git -C "E:/projects/simple-doc-viewer" commit -F - <<'EOF'
feat: 문서 영역 줌 Ctrl +/-/0 + Ctrl 휠 (기능1)

네이티브 셸에서 사라진 브라우저 줌을 앱 레벨로 구현. CSS zoom을
텍스트 컨테이너에만 적용(사이드바/미디어 제외), localStorage 영속화,
WebView2 내장 줌 preventDefault.

Worker: TARS
Coworker: Dylan gonnector@gonnector.com
EOF
```

---

### Task 3: 기능3a — CSV/TSV 파서 (TDD, 순수 함수)

**Files:**
- Create: `client/app/csv-parser.js`
- Create: `scripts/dev/test-csv.js`
- Modify: `package.json` (`test:csv` 스크립트)

**Interfaces:**
- Produces: 전역 `sdvParseDelimited(text, delim)` → `string[][]`, `sdvCsvColumnIsNumeric(rows, colIdx)` → `boolean`, `sdvCsvNum(v)` → `number`
- Consumes: 없음 (순수, DOM 미접근 → vm 테스트 가능)

- [ ] **Step 1: 실패 테스트 작성** — `scripts/dev/test-csv.js`

```javascript
// CSV 파서 단위 테스트 — node scripts/dev/test-csv.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP = path.join(__dirname, '..', '..', 'client', 'app');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, 'csv-parser.js'), 'utf8'), ctx);

let pass = 0, fail = 0;
function eq(name, got, exp) {
  const g = JSON.stringify(got), e = JSON.stringify(exp);
  if (g === e) pass++; else { fail++; console.log('FAIL [' + name + ']\n  got: ' + g + '\n  exp: ' + e); }
}
const P = (t, d) => ctx.sdvParseDelimited(t, d || ',');

eq('simple', P('a,b,c\n1,2,3'), [['a','b','c'],['1','2','3']]);
eq('quoted-comma', P('a,"b,c",d'), [['a','b,c','d']]);
eq('escaped-quote', P('a,"b""c",d'), [['a','b"c','d']]);
eq('embedded-newline', P('a,"l1\nl2",c'), [['a','l1\nl2','c']]);
eq('crlf', P('a,b\r\n1,2'), [['a','b'],['1','2']]);
eq('trailing-newline', P('a,b\n1,2\n'), [['a','b'],['1','2']]);
eq('empty-fields', P('a,,c'), [['a','','c']]);
eq('tsv', ctx.sdvParseDelimited('a\tb\tc', '\t'), [['a','b','c']]);
eq('bom', P('﻿a,b'), [['a','b']]);
eq('numeric-col', ctx.sdvCsvColumnIsNumeric([['1'],['2'],['3,000']], 0), true);
eq('numeric-col-empty-skip', ctx.sdvCsvColumnIsNumeric([['1'],[''],['2']], 0), true);
eq('non-numeric-col', ctx.sdvCsvColumnIsNumeric([['1'],['x']], 0), false);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node scripts/dev/test-csv.js`
Expected: FAIL (csv-parser.js 없음 → require/eval 에러 또는 sdvParseDelimited undefined)

- [ ] **Step 3: csv-parser.js 구현**

```javascript
// --- CSV/TSV 파싱 (순수, DOM 미접근) ---
// RFC4180: 따옴표 필드, "" 이스케이프, 따옴표 내 구분자/줄바꿈 허용
function sdvParseDelimited(text, delim) {
  var rows = [], row = [], field = '';
  var i = 0, n = text.length, inQ = false;
  if (text.charCodeAt(0) === 0xFEFF) i = 1; // BOM 제거
  while (i < n) {
    var c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === delim) { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function sdvCsvIsNumeric(v) {
  if (v === null || v === undefined) return false;
  var s = String(v).trim();
  if (s === '') return false;
  return /^[+-]?(\d{1,3}(,\d{3})*|\d+)(\.\d+)?$/.test(s);
}

function sdvCsvColumnIsNumeric(rows, colIdx) {
  var seen = false;
  for (var r = 0; r < rows.length; r++) {
    var cell = rows[r][colIdx];
    if (cell === undefined || String(cell).trim() === '') continue;
    seen = true;
    if (!sdvCsvIsNumeric(cell)) return false;
  }
  return seen;
}

function sdvCsvNum(v) { return parseFloat(String(v).replace(/,/g, '')); }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node scripts/dev/test-csv.js`
Expected: `12 passed, 0 failed`, 종료코드 0

- [ ] **Step 5: package.json에 test:csv 추가**

```json
    "test:md": "node scripts/dev/test-markdown.js",
    "test:csv": "node scripts/dev/test-csv.js",
```

- [ ] **Step 6: Commit**

```bash
git -C "E:/projects/simple-doc-viewer" add client/app/csv-parser.js scripts/dev/test-csv.js package.json
git -C "E:/projects/simple-doc-viewer" diff --cached --stat
git -C "E:/projects/simple-doc-viewer" commit -F - <<'EOF'
feat: CSV/TSV 자체 파서 + 단위 테스트 12건 (기능3 파서)

RFC4180 따옴표/이스케이프/내장 구분자·줄바꿈 처리. 숫자 컬럼 감지.
의존성 없음, vm 단위 테스트.

Worker: TARS
Coworker: Dylan gonnector@gonnector.com
EOF
```

---

### Task 4: 기능3b — CSV/TSV 표 렌더 + 컬럼 정렬 + 표/원문 토글

**Files:**
- Create: `client/app/csv-table.js`
- Modify: `client/app/manifest.json` (content.js 다음에 csv-parser.js, csv-table.js)
- Modify: `client/app/content.js:118` (csv/tsv 분기 추가)
- Modify: `client/style.css` (표 스타일)
- Test scenario: `docs/testing/components/csv-table/20260629_test-scenario_csv-table_TARS.md`

**Interfaces:**
- Consumes: `sdvParseDelimited`, `sdvCsvColumnIsNumeric`, `sdvCsvNum`(Task 3), `escHtml`, `renderRaw`, `state`, `$content`
- Produces: 전역 `renderCsv(data)` — `data.content`/`data.ext`로 표 렌더 (content.js가 호출)

- [ ] **Step 1: manifest.json 등록** (`"content.js",` 다음에 두 줄 추가 — Task 2의 doc-zoom 등록과 함께 반영)

```json
    "content.js",
    "csv-parser.js",
    "csv-table.js",
    "markdown.js",
```

- [ ] **Step 2: csv-table.js 생성**

```javascript
// --- CSV/TSV 표 뷰 (정렬 + 표/원문 토글) ---
(function () {
  var _csv = {}; // key=activeTab → { sortCol, sortDir(1 asc/-1 desc/0 none), mode('table'|'raw') }
  var MAXROWS = 5000;

  function buildTable(rows, key) {
    if (!rows.length) return '<div class="csv-empty">빈 파일</div>';
    var header = rows[0], body = rows.slice(1);
    var st = _csv[key];
    var view = body.slice();
    if (st.sortCol >= 0 && st.sortDir !== 0) {
      var numeric = sdvCsvColumnIsNumeric(body, st.sortCol);
      view.sort(function (a, b) {
        var av = a[st.sortCol] === undefined ? '' : a[st.sortCol];
        var bv = b[st.sortCol] === undefined ? '' : b[st.sortCol];
        var cmp;
        if (av === '' && bv === '') cmp = 0;
        else if (av === '') cmp = 1;
        else if (bv === '') cmp = -1;
        else if (numeric) cmp = sdvCsvNum(av) - sdvCsvNum(bv);
        else cmp = av.localeCompare(bv);
        return st.sortDir === 1 ? cmp : -cmp;
      });
    }
    var truncated = view.length > MAXROWS;
    var shown = truncated ? view.slice(0, MAXROWS) : view;
    var h = '';
    if (truncated) h += '<div class="csv-notice">' + view.length.toLocaleString() + '행 중 처음 ' + MAXROWS.toLocaleString() + '행만 표시</div>';
    h += '<div class="csv-wrap"><table class="csv-table"><thead><tr>';
    for (var c = 0; c < header.length; c++) {
      var arrow = (st.sortCol === c) ? (st.sortDir === 1 ? '▲' : (st.sortDir === -1 ? '▼' : '')) : '';
      h += '<th data-col="' + c + '">' + escHtml(header[c]) + '<span class="csv-arrow">' + arrow + '</span></th>';
    }
    h += '</tr></thead><tbody>';
    for (var r = 0; r < shown.length; r++) {
      h += '<tr>';
      for (var cc = 0; cc < header.length; cc++) {
        var cell = shown[r][cc] === undefined ? '' : shown[r][cc];
        h += '<td title="' + escHtml(cell) + '">' + escHtml(cell) + '</td>';
      }
      h += '</tr>';
    }
    h += '</tbody></table></div>';
    return h;
  }

  window.renderCsv = function (data) {
    var key = state.activeTab || '';
    if (!_csv[key]) _csv[key] = { sortCol: -1, sortDir: 0, mode: 'table' };
    var st = _csv[key];
    var delim = data.ext === 'tsv' ? '\t' : ',';
    var toolbar = '<div class="csv-toolbar"><button id="csv-toggle">' + (st.mode === 'table' ? '원문 보기' : '표 보기') + '</button></div>';
    var bodyHtml;
    if (st.mode === 'raw') {
      bodyHtml = '<div class="raw-view' + (state.wordWrap ? ' word-wrap' : '') + '">' + renderRaw(data.content, data.ext) + '</div>';
    } else {
      var rows = null;
      try { rows = sdvParseDelimited(data.content, delim); } catch (e) { rows = null; }
      bodyHtml = rows ? buildTable(rows, key) : '<div class="raw-view">' + renderRaw(data.content, data.ext) + '</div>';
    }
    $content.innerHTML = toolbar + bodyHtml;
  };

  function reRender() {
    var tab = state.tabCache[state.activeTab];
    if (tab && tab.data && (tab.data.ext === 'csv' || tab.data.ext === 'tsv')) window.renderCsv(tab.data);
  }

  $content.addEventListener('click', function (e) {
    var key = state.activeTab || '';
    if (e.target && e.target.id === 'csv-toggle') {
      var st = _csv[key]; if (!st) return;
      st.mode = st.mode === 'table' ? 'raw' : 'table';
      reRender(); return;
    }
    var th = e.target && e.target.closest ? e.target.closest('th[data-col]') : null;
    if (th && $content.querySelector('.csv-table')) {
      var st2 = _csv[key]; if (!st2) return;
      var col = parseInt(th.getAttribute('data-col'), 10);
      if (st2.sortCol !== col) { st2.sortCol = col; st2.sortDir = 1; }
      else if (st2.sortDir === 1) st2.sortDir = -1;
      else if (st2.sortDir === -1) { st2.sortDir = 0; st2.sortCol = -1; }
      else st2.sortDir = 1;
      reRender();
    }
  });
})();
```

- [ ] **Step 3: content.js에 csv/tsv 분기 추가** (118행 `} else {` 앞에 삽입)

기존:
```javascript
  } else {
    $content.innerHTML = '<div class="raw-view' + (state.wordWrap ? ' word-wrap' : '') + '">' + renderRaw(data.content, data.ext) + '</div>';
    if (!preserveScroll) $content.scrollTop = 0;
  }
```
교체:
```javascript
  } else if (data.ext === 'csv' || data.ext === 'tsv') {
    renderCsv(data);
    if (!preserveScroll) $content.scrollTop = 0;
  } else {
    $content.innerHTML = '<div class="raw-view' + (state.wordWrap ? ' word-wrap' : '') + '">' + renderRaw(data.content, data.ext) + '</div>';
    if (!preserveScroll) $content.scrollTop = 0;
  }
```

- [ ] **Step 4: style.css에 표 스타일 추가** (파일 끝에 append)

```css
/* CSV/TSV 표 뷰 */
.csv-toolbar { padding: 6px 10px; border-bottom: 1px solid var(--border, #333); }
.csv-toolbar button { cursor: pointer; padding: 3px 10px; font-size: 12px; }
.csv-notice { padding: 6px 10px; font-size: 12px; opacity: 0.75; }
.csv-wrap { overflow: auto; max-height: 100%; }
.csv-table { border-collapse: collapse; font-variant-numeric: tabular-nums; font-size: 13px; }
.csv-table th, .csv-table td {
  border: 1px solid var(--border, #333); padding: 4px 8px;
  text-align: left; white-space: nowrap; max-width: 360px;
  overflow: hidden; text-overflow: ellipsis;
}
.csv-table thead th {
  position: sticky; top: 0; z-index: 1; cursor: pointer;
  background: var(--bg-elev, #1e1e1e); user-select: none;
}
.csv-table thead th:hover { filter: brightness(1.15); }
.csv-arrow { margin-left: 4px; opacity: 0.8; font-size: 10px; }
.csv-table tbody tr:nth-child(even) { background: rgba(127,127,127,0.06); }
```

- [ ] **Step 5: 결합 문법 검증 + renderCsv 포함 확인**

Run: `npm run build:frontend && node -e "var s=require('fs').readFileSync('dist-tauri/client/app.js','utf8'); process.exit((s.indexOf('renderCsv')>=0 && s.indexOf('sdvParseDelimited')>=0)?0:1)"`
Expected: syntax OK + 종료코드 0

- [ ] **Step 6: 테스트 시나리오 작성 + 샘플 CSV 준비**

`docs/testing/components/csv-table/...`: T-001 단순 csv 표 렌더 / T-002 따옴표·내장 구분자 정확 파싱 / T-003 숫자 컬럼 헤더 클릭 → 숫자 정렬(오름↔내림↔원래) / T-004 문자 컬럼 로케일 정렬 / T-005 표↔원문 토글 / T-006 TSV / T-007 헤더 sticky / T-008 줌과 연동(표 확대) / T-009 대용량(>5000행) 안내 표시 / T-010 빈 셀·불균형 행

- [ ] **Step 7: Commit**

```bash
git -C "E:/projects/simple-doc-viewer" add client/app/csv-table.js client/app/manifest.json client/app/content.js client/style.css docs/testing/components/csv-table/20260629_test-scenario_csv-table_TARS.md
git -C "E:/projects/simple-doc-viewer" diff --cached --stat
git -C "E:/projects/simple-doc-viewer" commit -F - <<'EOF'
feat: CSV/TSV 표 렌더 + 컬럼 정렬 + 표/원문 토글 (기능3 뷰)

content.js에 csv/tsv 분기. sticky 헤더, 숫자/문자 자동 정렬, 5000행
가드, 줌 연동. 파싱 실패 시 원문 폴백.

Worker: TARS
Coworker: Dylan gonnector@gonnector.com
EOF
```

---

### Task 5: 기능4 — 파일 연결 fileAssociations (md, pdf)

**Files:**
- Modify: `src-tauri/tauri.conf.json` (fileAssociations + version)
- Test scenario: `docs/testing/components/file-association/20260629_test-scenario_file-association_TARS.md`

**Interfaces:**
- Consumes: 기존 single-instance open-file 배선(`src-tauri/src/lib.rs`, main.js)은 변경 없음

- [ ] **Step 1: Tauri v2 fileAssociation 디폴트 동작 조사 (research-first)**

공식 문서/이슈에서 확인: Tauri v2 NSIS `bundle.fileAssociations`가 (a) 확장자 ProgID 등록 + OpenWithProgIds 추가에 그치는지 (b) 디폴트 핸들러(UserChoice)까지 설정하는지. `installMode: currentUser` 기준. 결과를 시나리오 문서 상단에 근거와 함께 기록. (Windows 10/11은 설치 프로그램의 디폴트 강제를 보호 → "열기 목록 추가"에 그칠 가능성이 높지만 실측으로 확정)

- [ ] **Step 2: tauri.conf.json에 fileAssociations 추가** (`"bundle"` 객체 안, `"icon"` 배열 뒤에 추가)

```json
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "fileAssociations": [
      { "ext": ["md", "markdown"], "name": "Markdown", "description": "Markdown document", "role": "Viewer" },
      { "ext": ["pdf"], "name": "PDF", "description": "PDF document", "role": "Viewer" }
    ]
```
(markdown 확장자 동반 등록 — Step 1 조사 후 .md만 원하면 `"markdown"` 제거. role은 디폴트 비강제 의미의 Viewer)

- [ ] **Step 3: 빌드 + 설치 + 실기 검증** (배포 Task 7과 연계 — 여기서는 설정만 커밋, 검증은 빌드 후)

검증 항목(설치 후):
- 탐색기에서 .md/.pdf 우클릭 → "연결 프로그램"에 SDV 등장
- .md 더블클릭 디폴트 = MMM 유지 (변하지 않음)
- .pdf 더블클릭 디폴트 = 기존 뷰어 유지
- "SDV로 열기" 선택 → 해당 파일이 SDV에 열림 (open-file 배선 동작)
- 디폴트가 가로채진 경우: NSIS installerHook으로 UserChoice 미설정 조정 후 재검증

- [ ] **Step 4: Commit (설정)**

```bash
git -C "E:/projects/simple-doc-viewer" add src-tauri/tauri.conf.json docs/testing/components/file-association/20260629_test-scenario_file-association_TARS.md
git -C "E:/projects/simple-doc-viewer" diff --cached --stat
git -C "E:/projects/simple-doc-viewer" commit -F - <<'EOF'
feat: 파일연결 fileAssociations md/pdf (기능4)

Windows 우클릭 "연결 프로그램"에 SDV 등장. 디폴트(.md=MMM)는
비강제 유지 목표. open-file 배선은 기존 활용.

Worker: TARS
Coworker: Dylan gonnector@gonnector.com
EOF
```

---

### Task 6: 통합 테스트/평가 + 독립 검증

**Files:**
- Create: `docs/testing/reports/20260629_test-report_sdv-upgrade-4features_TARS.md`

- [ ] **Step 1: 단위 테스트 전체 통과**

Run: `npm run test:md && npm run test:csv`
Expected: md 28건 + csv 12건 모두 PASS

- [ ] **Step 2: 결합 빌드 문법 검증**

Run: `npm run build:frontend`
Expected: syntax OK

- [ ] **Step 3: 4개 기능 시나리오 실행 + 리포트 작성**

각 시나리오(refresh-tree/doc-zoom/csv-table/file-association) PASS/FAIL을 리포트에 기록. 브라우저판(`npm start`)에서 1~3 기능 동작 확인, Tauri 빌드본에서 4 기능 확인. 실기 의존 항목(파일연결 디폴트)은 Dylan 확인 요청으로 표시.

- [ ] **Step 4: 독립 검증 (clean subagent)**

답을 모르는 깨끗한 서브에이전트로 변경 코드 adversarial 리뷰 + 보안(파일연결 레지스트리/경로 처리) 관점 검토. blocking 이슈는 수정 후 재검증.

- [ ] **Step 5: Commit (테스트 산출물)**

```bash
git -C "E:/projects/simple-doc-viewer" add docs/testing/reports/20260629_test-report_sdv-upgrade-4features_TARS.md
git -C "E:/projects/simple-doc-viewer" commit -F - <<'EOF'
test: SDV 업그레이드 4기능 통합 검수 리포트

단위(md28/csv12) + 시나리오 PASS 기록. 독립 검증 반영.

Worker: TARS
Coworker: Dylan gonnector@gonnector.com
EOF
```

---

### Task 7: 배포 — 버전 / 빌드 / CHANGELOG / 머지 / 태그 / push

**Files:**
- Modify: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` (version 0.80.0)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 버전 0.80.0 동기화 (3곳)**

`package.json` `"version": "0.80.0"`, `src-tauri/tauri.conf.json` `"version": "0.80.0"`, `src-tauri/Cargo.toml` `version = "0.80.0"`

- [ ] **Step 2: CHANGELOG.md에 0.80.0 항목 추가** (최상단)

```markdown
## [0.80.0] - 2026-06-29
### Added
- 문서 영역 줌: Ctrl +/-/0, Ctrl+휠. 텍스트/마크다운/코드/CSV 표에 적용(사이드바·미디어 제외), 배율 영속화
- CSV/TSV 표 렌더 + 컬럼 정렬(숫자/문자 자동) + 표/원문 토글
- 파일 연결(fileAssociations): Windows 우클릭 "연결 프로그램"에 SDV(md/pdf) 등장
### Changed
- 새로고침(R/버튼)이 활성 문서와 함께 좌측 폴더 트리도 갱신
```

- [ ] **Step 3: Tauri 빌드**

Run: `npm run tauri build`
Expected: NSIS/MSI 인스톨러 생성 (`src-tauri/target/release/bundle/...`)

- [ ] **Step 4: 빌드 산출물 gitignore 확인**

`git -C "E:/projects/simple-doc-viewer" status --short` 에 `src-tauri/target/` 미포함 확인 (.gitignore 적용). 포함되면 .gitignore 보강.

- [ ] **Step 5: 버전/CHANGELOG Commit**

```bash
git -C "E:/projects/simple-doc-viewer" add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json CHANGELOG.md
git -C "E:/projects/simple-doc-viewer" diff --cached --stat
git -C "E:/projects/simple-doc-viewer" commit -F - <<'EOF'
chore: v0.80.0 — SDV 업그레이드 4기능 릴리스

Worker: TARS
Coworker: Dylan gonnector@gonnector.com
EOF
```

- [ ] **Step 6: feature 브랜치 push**

```bash
git -C "E:/projects/simple-doc-viewer" push -u origin feat/sdv-upgrade-4features
```

- [ ] **Step 7: master 머지 + 태그 + push**

```bash
git -C "E:/projects/simple-doc-viewer" checkout master
git -C "E:/projects/simple-doc-viewer" merge --no-ff feat/sdv-upgrade-4features -m "merge: SDV 업그레이드 4기능 (v0.80.0)"
git -C "E:/projects/simple-doc-viewer" tag v0.80.0
git -C "E:/projects/simple-doc-viewer" push origin master --tags
```

- [ ] **Step 8: AIOS task done 처리 + output 등록**

각 task `aios done task <id>`, spec/plan/report를 `aios register output`.

---

## Self-Review

- **Spec coverage:** 기능1(Task2)·2(Task1)·3(Task3+4)·4(Task5)·테스트(Task6)·배포(Task7) 전부 대응. 버전/커밋/브랜치/푸시 기준(spec §5)은 Global Constraints + Task7에 반영
- **Placeholder scan:** 모든 코드 단계에 실제 코드 포함. Task5 Step1만 "조사" 단계인데 이는 OS 동작 실측이 필요한 정당한 리서치 단계(근거 기록 의무 명시)
- **Type consistency:** `sdvParseDelimited`/`sdvCsvColumnIsNumeric`/`sdvCsvNum`(Task3 정의) ↔ Task4 사용 일치. `renderCsv`(Task4 정의) ↔ content.js 호출 일치. `refreshTree`(Task1) ↔ reloadActiveDoc 호출 일치. `sdvZoomIn/Out/Reset`(Task2 doc-zoom.js 정의) ↔ shortcuts.js 호출 일치
- **manifest 순서:** doc-zoom.js(media-zoom 뒤), csv-parser.js·csv-table.js(content 뒤) — 모두 main.js 앞, 런타임 호출이라 결합 순서 안전

## 독립 리뷰 반영 수정 (2026-06-29, clean subagent)

독립 검증(깨끗한 서브에이전트, 실제 소스 대조)에서 확인된 BLOCKING 4건 + 보완을 구현에 반영한다. 원 코드 블록 대비 델타:

- **B1 (CSV 상태바):** `renderCsv` 끝에서 `docLines = 데이터 행수` 설정 + `updateStatusBar()` 호출. 정렬/토글 재렌더(reRender) 시에도 상태바 갱신. (기존 트레일링 updateStatusBar는 $content 스크롤 기반이라 CSV에 부정확)
- **B2 (sticky × zoom):** CSS `zoom` 대상을 `.csv-wrap`이 아닌 `.csv-table`로. CSV는 별도 overflow 스크롤 컨테이너를 만들지 않고 기존 `#content` 스크롤을 사용 → sticky thead가 `#content` 기준으로 고정되고 상태바 %도 정상. `.csv-wrap`은 가로 스크롤 없이 단순 블록
- **B3 (refreshTree 가드):** `$tree`에 `.rename-input`이 있으면 트리 재렌더 skip (이름변경 입력 보존)
- **B4 (빈/헤더만 CSV):** `buildTable`에서 본문 0행이면 "데이터 없음" 행 표시. 파서 테스트에 `P('')`→`[]`, `P('\n')`→`[['']]` 추가
- **N3 (Ctrl+휠):** 줌 대상(`.md-rendered`/`.raw-view`/`.csv-table`) 위에서만 preventDefault+줌. 미디어 위 휠은 통과
- **N1:** CSV 클릭 핸들러는 CSV 컨텍스트에서만 동작 (조기 return)
- **N4 (find+zoom):** zoom≠100%에서 find 중앙정렬 좌표 오차 가능 → 테스트 케이스 추가, 한계로 리포트 기록
- **N5 (레거시 공존):** `install-context-menu.js`(레거시, node 에디션 우클릭)와 Tauri fileAssociations 공존 가능 → 테스트 리포트에 명시, deprecate 여부 Dylan 결정 항목

## 관련 문서
- [설계 spec](file:///E:/projects/simple-doc-viewer/docs/plans/20260629_plan_sdv-upgrade-4features_TARS.md)
