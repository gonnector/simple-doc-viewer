# Simple Doc Viewer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** PRD.md 기반으로 npm 의존성 없는 단일 server.js 파일의 로컬 문서 뷰어를 5 Phase 점진적 강화 방식으로 구현한다.

**Architecture:** Node.js 내장 모듈(`http`, `fs`, `path`, `url`, `https`)만 사용하는 HTTP 서버가 API 엔드포인트와 인라인 SPA 프론트엔드를 서빙한다. 프론트엔드 HTML/CSS/JS는 server.js 내 함수에서 문자열로 반환하며, reference 프로토타입의 검증된 마크다운 파서와 UI 컴포넌트를 통합한다.

**Tech Stack:** Node.js 18+ (내장 모듈만), 순수 HTML/CSS/JS (인라인)

---

## Task 1: Phase 1 — HTTP 서버 골격 + /api/list + 최소 UI

**Files:**
- Create: `server.js`

**Step 1: server.js 기본 구조 작성**

서버의 전체 골격을 만든다. 6개 논리적 섹션:
1. 설정 & 상수
2. 유틸리티 함수
3. Mermaid 다운로더 (Phase 5에서 구현, 빈 함수)
4. API 핸들러
5. HTML 프론트엔드 (getHTML 함수)
6. 서버 시작

```javascript
// === [1] 설정 & 상수 ===
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const args = process.argv.slice(2);
let PORT = 3000;
let ROOT_DIR = process.cwd();

// 커맨드라인 인자 파싱
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--port' || args[i] === '-p') && args[i+1]) { PORT = parseInt(args[i+1]); i++; }
  if ((args[i] === '--root' || args[i] === '-r') && args[i+1]) { ROOT_DIR = path.resolve(args[i+1]); i++; }
}

// 텍스트 파일 확장자
const TEXT_EXTENSIONS = new Set([
  'md','txt','js','ts','jsx','tsx','json','yaml','yml','toml','cfg',
  'env','gitignore','dockerignore','html','css','xml','svg','sh','bash',
  'py','rb','java','c','cpp','h','hpp','cs','go','rs','php','sql',
  'makefile','dockerfile','log','ini','conf','properties','gradle',
  'bat','cmd','ps1','lock','editorconfig','prettierrc','eslintrc'
]);

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
```

**Step 2: 유틸리티 함수 작성**

```javascript
// === [2] 유틸리티 함수 ===
function isTextFile(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const base = path.basename(filePath).toLowerCase();
  // 확장자 없는 알려진 텍스트 파일
  if (['makefile','dockerfile','license','readme','changelog','gemfile','rakefile','.gitignore','.dockerignore','.editorconfig','.env'].includes(base)) return true;
  if (!ext) return false;
  return TEXT_EXTENSIONS.has(ext);
}

function isPathSafe(requestedPath) {
  const resolved = path.resolve(requestedPath);
  return resolved.startsWith(ROOT_DIR) || resolved === ROOT_DIR;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function sendJSON(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendError(res, message, status = 400) {
  sendJSON(res, { error: message }, status);
}
```

**Step 3: /api/list 핸들러 작성**

```javascript
// === [4] API 핸들러 ===
function handleList(req, res, query) {
  const dirPath = query.path ? path.resolve(query.path) : ROOT_DIR;

  if (!isPathSafe(dirPath)) {
    return sendError(res, 'Access denied', 403);
  }

  try {
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      return sendError(res, 'Not a directory');
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const items = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        const entryStat = fs.statSync(fullPath);
        const item = {
          name: entry.name,
          type: entry.isDirectory() ? 'dir' : 'file',
          modified: entryStat.mtime.toISOString()
        };
        if (!entry.isDirectory()) {
          item.size = entryStat.size;
        }
        items.push(item);
      } catch (e) {
        // 접근 불가 파일 무시
      }
    }

    // 정렬: 폴더 먼저, 이름순
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const parent = path.dirname(dirPath);
    sendJSON(res, {
      path: dirPath.replace(/\\/g, '/'),
      parent: parent !== dirPath ? parent.replace(/\\/g, '/') : null,
      items
    });
  } catch (e) {
    sendError(res, 'Cannot read directory: ' + e.message);
  }
}
```

**Step 4: 최소 프론트엔드 HTML 작성**

사이드바에 파일 목록만 표시하는 최소 UI. CSS는 doc-explorer.html의 다크 테마 기반.

```javascript
// === [5] HTML 프론트엔드 ===
function getHTML() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Doc Viewer</title>
<style>
/* ... 다크 테마 CSS (doc-explorer.html 기반) ... */
</style>
</head>
<body>
<!-- 헤더, 사이드바, 콘텐츠 영역 -->
<script>
/* ... 파일 트리 로딩/렌더링 JS ... */
</script>
</body>
</html>`;
}
```

프론트엔드 포함 요소:
- 헤더 (Doc Viewer 타이틀 + 현재 경로)
- 사이드바 (파일 목록, 폴더 클릭으로 이동, `..` 상위 이동)
- 빈 콘텐츠 영역 (환영 화면)
- `/api/list` 호출하여 파일 목록 표시

**Step 5: 서버 시작 + 라우팅 작성**

```javascript
// === [6] 서버 시작 ===
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getHTML());
  } else if (pathname === '/api/list') {
    handleList(req, res, parsed.query);
  } else {
    sendError(res, 'Not found', 404);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Doc Viewer running at http://localhost:${PORT}`);
  console.log(`Root: ${ROOT_DIR}`);
});
```

**Step 6: 브라우저에서 Phase 1 테스트**

Run: `node server.js`
Expected:
- `http://localhost:3000` 접속 → 다크 테마 2컬럼 레이아웃
- 사이드바에 현재 디렉토리 파일/폴더 목록 표시
- 폴더 클릭 → 하위 목록으로 전환
- `..` 클릭 → 상위 디렉토리로 이동

---

## Task 2: Phase 2 — /api/read + 파일 트리 UI 완성

**Files:**
- Modify: `server.js`

**Step 1: /api/read 핸들러 추가**

```javascript
function handleRead(req, res, query) {
  const filePath = query.path ? path.resolve(query.path) : null;

  if (!filePath) return sendError(res, 'Path required');
  if (!isPathSafe(filePath)) return sendError(res, 'Access denied', 403);

  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) return sendError(res, 'Is a directory');
    if (stat.size > MAX_FILE_SIZE) {
      return sendJSON(res, {
        path: filePath.replace(/\\/g, '/'),
        name: path.basename(filePath),
        ext: path.extname(filePath).slice(1).toLowerCase(),
        size: stat.size,
        error: 'File too large (max 1MB)',
        content: null
      });
    }
    if (!isTextFile(filePath)) {
      return sendJSON(res, {
        path: filePath.replace(/\\/g, '/'),
        name: path.basename(filePath),
        ext: path.extname(filePath).slice(1).toLowerCase(),
        size: stat.size,
        error: 'Binary file - preview not available',
        content: null
      });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    sendJSON(res, {
      path: filePath.replace(/\\/g, '/'),
      name: path.basename(filePath),
      ext: path.extname(filePath).slice(1).toLowerCase(),
      size: stat.size,
      content
    });
  } catch (e) {
    sendError(res, 'Cannot read file: ' + e.message);
  }
}
```

라우터에 `/api/read` 추가.

**Step 2: 프론트엔드 파일 트리 UI 강화**

doc-explorer.html의 UI 패턴을 적용:
- 확장자별 아이콘 매핑 (📁📘📦🔷🟡⚙️🐳📄)
- 확장자별 배지 색상 (--badge-md, --badge-json 등)
- 파일 크기 표시
- 검색/필터 입력란
- 폴더 먼저 → 파일 (이름 알파벳순) 정렬 (서버에서 처리)

**Step 3: 파일 클릭 → 원본 텍스트 표시**

- 파일 클릭 시 `/api/read` 호출
- 라인 번호 포함 원본 텍스트 표시 (doc-explorer.html의 renderRaw 패턴)
- 바이너리/대용량 파일 에러 메시지 표시

**Step 4: 브라우저에서 Phase 2 테스트**

Run: `node server.js`
Expected:
- 파일에 확장자별 아이콘/배지 표시
- 검색란에 타이핑 → 파일명 필터링
- 파일 클릭 → 오른쪽에 라인번호 + 원본 텍스트
- .exe, .png 등 바이너리 파일 → "미리보기 불가" 안내
- 1MB 초과 파일 → "파일이 너무 큽니다" 안내

---

## Task 3: Phase 3 — 마크다운 렌더링

**Files:**
- Modify: `server.js`

**Step 1: 마크다운 파서 통합**

reference/markdown-viewer.html의 `md.parse()` 로직을 프론트엔드 JS에 통합.
핵심 함수: `escapeHtml`, `highlightCode`, `inlineFormat`, `parse`

지원 요소:
- 제목 (h1~h6), 단락, 굵게/기울임/취소선
- 순서/비순서 목록, 체크리스트 (중첩 포함)
- 코드 블록 (언어별 구문 강조 + 언어 배지)
- 테이블 (정렬 지원)
- 인용문 (재귀적 중첩)
- 링크, 이미지 (lazy loading)
- 수평선, 각주, 정의 목록
- `<details>/<summary>`, `<kbd>`, `==하이라이트==`
- Mermaid 코드 블록 감지 (Phase 5에서 렌더링, 여기서는 코드 블록으로 표시)

**Step 2: 마크다운 렌더링 CSS 추가**

doc-explorer.html의 `.md-rendered` 스타일 + markdown-viewer.html의 상세 스타일 병합.
다크 테마 기준.

**Step 3: 뷰어 분기 로직**

```javascript
// .md 파일 → 마크다운 렌더링
// 그 외 텍스트 → 라인번호 + 원본 텍스트
// 에러 → 에러 메시지 표시
function renderFile(data) {
  if (data.error) { showError(data); return; }
  if (data.ext === 'md') {
    contentBody.innerHTML = '<div class="md-rendered">' + md.parse(data.content) + '</div>';
  } else {
    contentBody.innerHTML = '<div class="raw-view">' + renderRaw(data.content, data.ext) + '</div>';
  }
}
```

**Step 4: reference/markdown-test.md로 검증**

Run: `node server.js --root E:\project\simple-doc-viewer\reference`
Expected:
- markdown-test.md 클릭 → 12가지 마크다운 요소가 올바르게 렌더링
- 제목에 하단 보더, 코드 블록에 언어 배지
- 테이블 정렬 (좌/중앙/우)
- 체크리스트 체크박스
- 인용문 중첩 (색상 구분)

---

## Task 4: Phase 4 — 구문 강조 + 탭 시스템

**Files:**
- Modify: `server.js`

**Step 1: 구문 강조 강화**

doc-explorer.html의 `renderRaw` 구문 강조를 확장:
- JavaScript/TypeScript: 키워드, 문자열, 주석, 숫자, 함수
- JSON: 키, 값, 문자열, true/false/null
- YAML: 키, 주석
- Dockerfile: 지시어(FROM, RUN 등), 주석

토큰 클래스: `.tok-kw`, `.tok-str`, `.tok-num`, `.tok-cm`, `.tok-fn`, `.tok-op`, `.tok-key`

**Step 2: 탭 시스템 구현**

doc-explorer.html의 상태 관리 + 탭 렌더링 패턴 적용:

```javascript
const state = {
  currentPath: ROOT_DIR,
  openTabs: [],      // [{ path, name, ext }]
  activeTab: null,    // path
  showHidden: false,
  wordWrap: false
};
```

- 파일 클릭 → 새 탭 추가 (이미 열려있으면 해당 탭 활성화)
- 탭 닫기 (×) → 다음 탭 또는 환영 화면
- 탭 클릭 → 전환 (캐시된 데이터 사용)
- 활성 탭 하이라이트 (하단 파란 보더)

**Step 3: 브라우저에서 Phase 4 테스트**

Run: `node server.js`
Expected:
- .js 파일 → 키워드 빨간색, 문자열 파란색, 주석 회색
- .json 파일 → 키 녹색, 값 파란색
- 여러 파일 열기 → 탭 바에 탭 추가됨
- 탭 클릭으로 전환, × 클릭으로 닫기
- 마지막 탭 닫기 → 환영 화면

---

## Task 5: Phase 5 — Mermaid 자동 다운로드 + 설정 패널 + 마무리

**Files:**
- Modify: `server.js`

**Step 1: Mermaid 자동 다운로더 구현**

```javascript
const https = require('https');

function downloadMermaid() {
  const libDir = path.join(__dirname, 'lib');
  const mermaidPath = path.join(libDir, 'mermaid.min.js');

  if (fs.existsSync(mermaidPath)) return;

  console.log('Downloading mermaid.min.js...');
  if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });

  const cdnUrl = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
  // HTTPS GET → follow redirects → 파일에 저장
  // 실패 시 console.warn만 출력, 서버는 정상 시작
}
```

**Step 2: /lib/mermaid.min.js 서빙 라우트 추가**

```javascript
// 라우터에 추가
if (pathname === '/lib/mermaid.min.js') {
  const mermaidPath = path.join(__dirname, 'lib', 'mermaid.min.js');
  if (fs.existsSync(mermaidPath)) {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(fs.readFileSync(mermaidPath));
  } else {
    sendError(res, 'Mermaid not available', 404);
  }
}
```

**Step 3: 프론트엔드 Mermaid 렌더링**

마크다운 파서에서 ` ```mermaid ` 코드 블록을 감지하여 `<div class="mermaid">` 로 변환.
페이지 로드 시 mermaid.min.js 동적 로드 후 `mermaid.init()` 호출.
로드 실패 시 코드 블록 그대로 표시 (graceful degradation).

**Step 4: 설정 패널 구현**

헤더 오른쪽에 토글 버튼 2개:
- 숨김 파일 표시 (기본 OFF) → `.git`, `node_modules` 등 필터링
- 줄 바꿈 (기본 OFF) → `white-space: pre-wrap` 토글

```javascript
// 숨김 파일 필터링
const HIDDEN_PATTERNS = ['node_modules', '.git', '.svn', '.hg', '.DS_Store', 'Thumbs.db'];
function isHidden(name) {
  return name.startsWith('.') || HIDDEN_PATTERNS.includes(name);
}
```

**Step 5: 최종 점검**

Run: `node server.js --root E:\project\simple-doc-viewer`
PRD 요구사항 대비 체크리스트:
- [ ] 파일 트리 탐색 (폴더 클릭, 상위 이동, 검색)
- [ ] 마크다운 렌더링 (12가지 요소)
- [ ] 코드 뷰 (라인번호, 구문 강조)
- [ ] 탭 시스템 (열기, 닫기, 전환)
- [ ] Mermaid 다이어그램 (자동 다운로드, 렌더링)
- [ ] 설정 토글 (숨김 파일, 줄 바꿈)
- [ ] 보안 (경로 순회 방지, 바이너리 거부, 1MB 제한, localhost 바인딩)
- [ ] 커맨드라인 옵션 (--port, --root)

---

## Task 6: 개발 일지 최종 업데이트

**Files:**
- Modify: `docs/dev-journal.md`

각 Phase별 실제 결정사항, 사용한 스킬, 대안 분석, 교훈을 기록.
