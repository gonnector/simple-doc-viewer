# 검색 강화 구현 플랜

> **에이전트 실행 시:** superpowers:subagent-driven-development (추천) 또는 superpowers:executing-plans 사용. 체크박스(`- [ ]`)로 진행 추적.

**목표:** 사이드바에서 파일명 + 파일 본문을 동시 검색, AND/OR 쿼리 문법 지원, 매치 타입별 시각 구분.

**아키텍처:** 서버사이드 `/api/search` 엔드포인트가 현재 디렉토리의 모든 텍스트 파일을 읽고 매치 결과 + snippet을 반환. 클라이언트는 AND/OR 쿼리를 파싱하고 결과를 매치 타입별 시각 지표(파일명 하이라이트, 본문 snippet, 컬러 좌측 바)로 렌더링. debounce(300ms)로 과도한 요청 방지.

**기술 스택:** Node.js `fs` (서버), vanilla JS (클라이언트), 기존 CSS 변수 시스템.

**제약 조건:**
- 클라이언트 JS에서 백틱/`${}` 사용 불가 (template literal 제약)
- 문자열 결합은 `+` 연산자만
- 외부 라이브러리 없음

---

## 구현 접근법 비교 및 선택

### A. 서버사이드 `/api/search` ★ 채택

서버가 현재 디렉토리의 모든 파일을 읽고 검색 후 결과를 JSON으로 반환.

- **장점:** 파일 I/O를 서버가 일괄 처리, HTTP 요청 1회로 완료, 디렉토리 크기 무관하게 안정적, SDV의 기존 패턴(서버 API + 클라이언트 렌더링)과 일관
- **단점:** 새 API 엔드포인트 추가 필요 (소량의 서버 코드)
- **적합:** 파일 100개+ 디렉토리

### B. 클라이언트 개별 fetch — 불채택

파일 목록의 각 파일에 대해 `/api/read`를 개별 호출, 클라이언트에서 검색.

- **장점:** 서버 변경 없음
- **단점:** 파일 50개 = HTTP 요청 50개 → 느림 + 서버 부하, 매 키 입력마다 전부 재요청
- **불채택 이유:** 확장성 부족, 네트워크 병목

### C. 클라이언트 캐시 + 서버 벌크 — 불채택

디렉토리 진입 시 서버가 모든 파일 내용을 한번에 전송, 클라이언트가 메모리에 캐시.

- **장점:** 키 입력마다 즉시 검색 (네트워크 0)
- **단점:** 메모리 폭발 위험 (파일 100개 × 50KB = 5MB), 디렉토리 이동 시 매번 전체 재로딩
- **불채택 이유:** 메모리 부담, 초기 로딩 지연

### 선택 근거

A안 채택. debounce(300ms)를 걸면 타이핑 중 과도한 요청도 방지되고, 서버의 `fs.readFileSync`는 로컬 디스크 I/O라 수십 개 파일도 수 ms 내 완료. B/C 대비 아키텍처적 오버헤드가 가장 낮으면서 확장성이 가장 높다.

---

## 파일 구조

| 액션 | 파일 | 역할 |
|------|------|------|
| 수정 | `server.js:handleList 영역` | `/api/search` 핸들러 추가 |
| 수정 | `server.js:CSS 섹션` | 검색 결과 스타일 (하이라이트, snippet, 바) |
| 수정 | `server.js:HTML 섹션` | 검색 입력 placeholder 변경, help 섹션 추가 |
| 수정 | `server.js:클라이언트 JS` | 쿼리 파서, 검색 API 호출, 결과 렌더링 |

모든 변경은 `server.js` (단일 파일 아키텍처).

---

## UX/UI 설계

### 쿼리 문법

| 입력 | 해석 | 예시 |
|------|------|------|
| 공백 또는 `&` | AND (모두 매치) | `api server` → api AND server |
| 쉼표 또는 `\|` | OR (하나라도 매치) | `api,server` → api OR server |
| 대소문자 | 항상 무시 | `README` = `readme` |

### 매치 타입 시각 구분

| 매치 타입 | 좌측 바 | 파일명 | 추가 표시 |
|-----------|---------|--------|-----------|
| 파일명만 | 없음 | 매칭 부분 하이라이트 (반투명 파랑 배경) | — |
| 본문만 | 좌측 보라색 바 `▎` (accent3) | 일반 표시 | 매칭 snippet 1줄 |
| 양쪽 모두 | 좌측 파란색 바 `▎` (accent) | 매칭 부분 하이라이트 | 매칭 snippet 1줄 |

### 인터랙션 흐름

1. 사용자가 검색 입력 → 300ms debounce
2. 서버에 `/api/search` 요청 (현재 디렉토리 + 쿼리)
3. 서버가 파일명 + 본문 검색 → 결과 반환
4. 트리를 검색 결과로 교체 (폴더 숨김, 매칭 파일만)
5. 결과 상단에 "N results" 표시
6. 입력을 비우면 → 원래 파일 목록 복원
7. 결과 파일 클릭 → 탭으로 열기 (기존과 동일)
8. snippet 클릭 → 해당 파일 열기

---

### Task 1: 서버사이드 `/api/search` 엔드포인트

**파일:**
- 수정: `server.js` — `handleSearch()` 함수 및 라우트 추가

- [ ] **Step 1: 쿼리 파서 유틸리티 추가 (서버)**

```javascript
// handlePostBody 함수 뒤에 추가 (~line 115)
function parseSearchQuery(q) {
  // 쉼표/파이프로 분할 (OR), 각 그룹을 공백/&로 분할 (AND)
  var orGroups = q.split(/[,|]/).map(function(g) { return g.trim(); }).filter(Boolean);
  return orGroups.map(function(group) {
    return group.split(/[\s&]+/).map(function(t) { return t.trim().toLowerCase(); }).filter(Boolean);
  });
  // 결과: [[and1, and2], [and3, and4]] = (and1 AND and2) OR (and3 AND and4)
}

function matchesQuery(text, parsedQuery) {
  var lower = text.toLowerCase();
  for (var i = 0; i < parsedQuery.length; i++) {
    var andGroup = parsedQuery[i];
    var allMatch = true;
    for (var j = 0; j < andGroup.length; j++) {
      if (lower.indexOf(andGroup[j]) === -1) { allMatch = false; break; }
    }
    if (allMatch) return true;
  }
  return false;
}
```

- [ ] **Step 2: snippet 추출기 추가**

```javascript
function extractSnippet(content, parsedQuery, maxLen) {
  maxLen = maxLen || 80;
  var lower = content.toLowerCase();
  // 첫 매칭 위치 찾기
  var bestPos = -1;
  for (var i = 0; i < parsedQuery.length; i++) {
    for (var j = 0; j < parsedQuery[i].length; j++) {
      var pos = lower.indexOf(parsedQuery[i][j]);
      if (pos !== -1 && (bestPos === -1 || pos < bestPos)) bestPos = pos;
    }
  }
  if (bestPos === -1) return '';
  // 매칭 포함 줄 추출
  var lineStart = content.lastIndexOf('\n', bestPos) + 1;
  var lineEnd = content.indexOf('\n', bestPos);
  if (lineEnd === -1) lineEnd = content.length;
  var line = content.substring(lineStart, lineEnd).trim();
  if (line.length > maxLen) {
    var start = Math.max(0, bestPos - lineStart - 30);
    line = (start > 0 ? '...' : '') + line.substring(start, start + maxLen) + '...';
  }
  return line;
}
```

- [ ] **Step 3: handleSearch 함수 추가**

```javascript
function handleSearch(req, res, query) {
  var dirPath = (query.path || ROOT_DIR).replace(/\\/g, '/');
  var q = (query.q || '').trim();
  if (!q) return sendJSON(res, { results: [] });

  var resolved = path.resolve(dirPath).replace(/\\/g, '/');
  var parsedQ = parseSearchQuery(q);
  var results = [];

  try {
    var entries = fs.readdirSync(resolved, { withFileTypes: true });
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (entry.isDirectory()) continue;

      var fullPath = path.join(resolved, entry.name).replace(/\\/g, '/');
      var nameMatch = matchesQuery(entry.name, parsedQ);
      var contentMatch = false;
      var snippet = '';

      // 텍스트 파일만 본문 검색 (1MB 이하)
      var ext = path.extname(entry.name).slice(1).toLowerCase();
      if (TEXT_EXTENSIONS.has(ext) || KNOWN_TEXT_FILES.has(entry.name.toLowerCase())) {
        try {
          var stat = fs.statSync(fullPath);
          if (stat.size <= MAX_FILE_SIZE) {
            var content = fs.readFileSync(fullPath, 'utf-8');
            contentMatch = matchesQuery(content, parsedQ);
            if (contentMatch) {
              snippet = extractSnippet(content, parsedQ);
            }
          }
        } catch(e) { /* 읽기 불가 파일 스킵 */ }
      }

      if (nameMatch || contentMatch) {
        var entryStat = fs.statSync(fullPath);
        results.push({
          name: entry.name,
          type: 'file',
          size: entryStat.size,
          modified: entryStat.mtime.toISOString(),
          created: entryStat.birthtime.toISOString(),
          hidden: entry.name.startsWith('.'),
          matchType: nameMatch && contentMatch ? 'both' : (nameMatch ? 'name' : 'content'),
          snippet: snippet
        });
      }
    }
    sendJSON(res, { path: resolved, results: results });
  } catch(e) {
    sendError(res, 'Search failed: ' + e.message);
  }
}
```

- [ ] **Step 4: `/api/search` 라우트 추가**

서버 라우터에서 `/api/chroot` 핸들러 뒤에:

```javascript
} else if (pathname === '/api/search') {
    handleSearch(req, res, parsed.query);
}
```

- [ ] **Step 5: 서버 정상 시작 확인**

실행: `node server.js --no-open`
기대: "SDV running at http://sdv.local:3000"

- [ ] **Step 6: 검색 API 테스트**

```bash
curl -s "http://sdv.local:3000/api/search?path=E:/project/simple-doc-viewer/reference&q=markdown" | node -e "..."
```

기대: matchType이 'name', 'content', 'both'인 결과 다수

- [ ] **Step 7: 커밋**

```bash
git add server.js
git commit -m "feat: add /api/search endpoint with AND/OR query parsing"
```

---

### Task 2: 검색 결과 CSS

**파일:**
- 수정: `server.js` — CSS 섹션

- [ ] **Step 1: 검색 결과 스타일 추가**

`.tree-item.parent-dir` CSS 규칙 뒤에 추가:

```css
/* 검색 결과 지표 */
.tree-item.match-name .name {
  background: rgba(88,166,255,0.2);
  border-radius: 2px;
  padding: 0 2px;
}
.tree-item.match-content {
  border-left: 3px solid var(--accent3);
  padding-left: 9px;
}
.tree-item.match-both {
  border-left: 3px solid var(--accent);
  padding-left: 9px;
}
.tree-item.match-both .name {
  background: rgba(88,166,255,0.2);
  border-radius: 2px;
  padding: 0 2px;
}
.search-snippet {
  font-size: 11px;
  color: var(--text-dim);
  padding: 0 12px 4px 34px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}
.search-snippet mark {
  background: rgba(255,200,0,0.3);
  color: var(--text);
  font-weight: 600;
  border-radius: 2px;
  padding: 0 1px;
}
.search-mode-indicator {
  font-size: 10px;
  color: var(--accent);
  padding: 2px 8px;
  opacity: 0.7;
}
```

- [ ] **Step 2: 라이트 모드 오버라이드 추가**

```css
body.light-mode .tree-item.match-name .name { background: rgba(9,105,218,0.15); }
body.light-mode .tree-item.match-both .name { background: rgba(9,105,218,0.15); }
body.light-mode .search-snippet mark { background: rgba(255,200,0,0.4); }
```

- [ ] **Step 3: 커밋**

```bash
git add server.js
git commit -m "style: add search result CSS for match type indicators"
```

---

### Task 3: 클라이언트 검색 로직 및 결과 렌더링

**파일:**
- 수정: `server.js` — 클라이언트 JS 섹션

- [ ] **Step 1: 검색 입력 placeholder 변경**

HTML 검색 입력 변경:

```html
<input type="text" id="search-input" placeholder="Search files &amp; content...">
```

- [ ] **Step 2: 클라이언트 쿼리 파서 추가 (서버와 동일 로직)**

`sortItems` 함수 뒤에 추가:

```javascript
function parseQueryClient(q) {
  var orGroups = q.split(/[,|]/).map(function(g) { return g.trim(); }).filter(Boolean);
  return orGroups.map(function(group) {
    return group.split(/[\s&]+/).map(function(t) { return t.trim().toLowerCase(); }).filter(Boolean);
  });
}

function highlightTerms(text, parsedQ) {
  // 고유 검색어 수집
  var terms = [];
  for (var i = 0; i < parsedQ.length; i++) {
    for (var j = 0; j < parsedQ[i].length; j++) {
      if (terms.indexOf(parsedQ[i][j]) === -1) terms.push(parsedQ[i][j]);
    }
  }
  // 길이 내림차순 정렬 (부분 치환 방지)
  terms.sort(function(a, b) { return b.length - a.length; });
  var result = escHtml(text);
  for (var k = 0; k < terms.length; k++) {
    var re = new RegExp('(' + terms[k].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    result = result.replace(re, '<mark>$1</mark>');
  }
  return result;
}
```

- [ ] **Step 3: debounce 검색 API 호출 추가**

```javascript
var _searchTimer = null;
var _searchResults = null;
var _searchParsedQ = null;

function doSearch(query) {
  if (!query) {
    _searchResults = null;
    renderTree();
    return;
  }
  var xhr = new XMLHttpRequest();
  xhr.open('GET', '/api/search?path=' + encodeURIComponent(state.currentPath) + '&q=' + encodeURIComponent(query));
  xhr.onload = function() {
    var resp = JSON.parse(xhr.responseText);
    _searchResults = resp.results || [];
    _searchParsedQ = parseQueryClient(query);
    renderTree();
  };
  xhr.send();
}
```

- [ ] **Step 4: 검색 입력 이벤트 핸들러 교체**

기존 `$search` input 이벤트를 교체:

```javascript
$search.addEventListener('input', function() {
  state.searchQuery = $search.value;
  if (_searchTimer) clearTimeout(_searchTimer);
  if (!state.searchQuery) {
    _searchResults = null;
    renderTree();
    return;
  }
  _searchTimer = setTimeout(function() {
    doSearch(state.searchQuery);
  }, 300);
});
```

- [ ] **Step 5: renderTree에 검색 결과 렌더링 추가**

`_searchResults`가 null이 아닐 때 일반 파일 목록 대신 검색 결과를 렌더링:

```javascript
// renderTree() 내부, 상위 디렉토리 링크 뒤에, 기존 items 루프 앞에 삽입:

// 검색 모드
if (_searchResults !== null) {
  if (_searchResults.length === 0) {
    html += '<div class="search-mode-indicator">No results</div>';
  } else {
    html += '<div class="search-mode-indicator">' + _searchResults.length + ' result' + (_searchResults.length > 1 ? 's' : '') + '</div>';
  }
  var sitems = sortItems(_searchResults);
  for (var i = 0; i < sitems.length; i++) {
    var item = sitems[i];
    if (!state.showHidden && item.hidden) continue;
    var ext = getExt(item.name);
    var icon = getIcon(item.name, false);
    var fullPath = state.currentPath + '/' + item.name;
    var isActive = state.activeTab === fullPath;
    var badgeColor = getBadgeColor(ext);
    var matchCls = item.matchType === 'both' ? ' match-both'
      : (item.matchType === 'content' ? ' match-content' : ' match-name');

    html += '<div class="tree-item' + (isActive ? ' selected' : '') + matchCls + '"'
      + ' data-action="open"'
      + ' data-path="' + escHtml(fullPath) + '"'
      + ' data-name="' + escHtml(item.name) + '"'
      + ' title="' + escHtml(item.name) + '">'
      + '<span class="icon">' + icon + '</span>'
      + '<span class="name">'
      + (item.matchType !== 'content'
        ? highlightTerms(item.name, _searchParsedQ)
        : escHtml(item.name))
      + '</span>';

    if (ext) {
      html += '<span class="file-meta">'
        + '<span class="badge" style="color:' + badgeColor
        + ';border:1px solid ' + badgeColor + '">' + ext + '</span>'
        + (item.size !== undefined
          ? '<span class="size">' + formatSize(item.size) + '</span>'
          : '')
        + '</span>';
    }
    html += '<span class="file-actions">'
      + '<button class="btn-ren" data-action="rename" title="Rename">&#9998;</button>'
      + '<button class="btn-del" data-action="delete" title="Delete">&#128465;</button>'
      + '</span>';
    html += '</div>';

    // 본문 매치 snippet
    if (item.snippet && (item.matchType === 'content' || item.matchType === 'both')) {
      html += '<div class="search-snippet" data-action="open"'
        + ' data-path="' + escHtml(fullPath) + '"'
        + ' data-name="' + escHtml(item.name) + '">'
        + highlightTerms(item.snippet, _searchParsedQ)
        + '</div>';
    }
  }
  $tree.innerHTML = html;
  return;
}

// ... 기존 일반 파일 목록 렌더링 계속
```

- [ ] **Step 6: JS 문법 검증**

```bash
node -e "var http=require('http');http.get('http://sdv.local:3000/',function(r){...})"
```

기대: "JS OK"

- [ ] **Step 7: 커밋**

```bash
git add server.js
git commit -m "feat: integrate search with debounced input and result rendering"
```

---

### Task 4: Help 팝업 검색 섹션

**파일:**
- 수정: `server.js` — HTML help 오버레이 섹션

- [ ] **Step 1: Help에 Search 섹션 추가**

"Help" 섹션 앞에 추가:

```html
<div class="help-section">
  <div class="help-section-title">Search</div>
  <div class="help-row">
    <span class="help-desc">AND: space or &amp;</span>
    <span class="help-desc" style="opacity:0.6">api server = 둘 다 매치</span>
  </div>
  <div class="help-row">
    <span class="help-desc">OR: comma or |</span>
    <span class="help-desc" style="opacity:0.6">api,server = 하나라도 매치</span>
  </div>
  <div class="help-row">
    <span class="help-desc">파일명 + 본문 동시 검색</span>
    <span class="help-desc" style="opacity:0.6">대소문자 무시</span>
  </div>
</div>
```

- [ ] **Step 2: 커밋**

```bash
git add server.js
git commit -m "docs: add search query syntax to help popup"
```

---

### Task 5: 통합 테스트

- [ ] **Step 1: AND 쿼리 테스트**

검색창에 `markdown test` 입력.
기대: "markdown" AND "test" 모두 매치하는 파일만 표시.

- [ ] **Step 2: OR 쿼리 테스트**

검색창에 `markdown,mermaid` 입력.
기대: "markdown" OR "mermaid" 중 하나라도 매치하는 파일 표시.

- [ ] **Step 3: 본문 전용 매치 테스트**

파일 내용에만 존재하는 단어 입력 (예: `fibonacci`).
기대: 보라색 좌측 바 + 매칭 줄 snippet 표시.

- [ ] **Step 4: 양쪽 매치 테스트**

파일명과 내용 모두에 존재하는 단어 입력 (예: `markdown`).
기대: 파란색 좌측 바 + 하이라이트된 파일명 + snippet.

- [ ] **Step 5: 빈 결과 테스트**

`xyznonexistent123` 입력.
기대: "No results" 표시.

- [ ] **Step 6: 검색 초기화 테스트**

입력 비우기 또는 Escape.
기대: 원래 파일 목록 복원.

- [ ] **Step 7: 최종 커밋**

```bash
git add server.js
git commit -m "feat: search enhancement — filename + content search with AND/OR (v0.61)"
```

---

## 요약

| Task | 설명 | 스텝 수 |
|------|------|---------|
| 1 | 서버 `/api/search` 엔드포인트 | 7 |
| 2 | 매치 타입 CSS | 3 |
| 3 | 클라이언트 검색 로직 + 렌더링 | 7 |
| 4 | Help 팝업 검색 문서 | 2 |
| 5 | 통합 테스트 | 7 |
| **합계** | | **26 스텝** |
