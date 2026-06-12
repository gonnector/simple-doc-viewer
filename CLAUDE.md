# Simple Doc Viewer

## 프로젝트 개요

로컬 파일시스템의 텍스트/마크다운 문서를 브라우저에서 탐색하고 열람하는 경량 문서 뷰어.
Node.js 내장 모듈만 사용, npm 의존성 0개. v0.77부터 서버 모듈 + 정적 클라이언트 구조.

## 현재 버전: v0.79

### 핵심 기능
- 파일 트리 탐색 (폴더 진입, 상위 이동, hidden 토글, OS 네이티브 폴더 피커)
- 마크다운 렌더링 (커스텀 파서: 헤딩, 리스트, 테이블, 코드 블록, 각주, YAML frontmatter 카드)
- 구문 강조 (JS, Python, Bash, CSS, HTML, JSON, YAML, SQL, Go, Rust, C/C++, Java, TypeScript)
- Mermaid 다이어그램 (9종) + KaTeX 수학 렌더링
- Day/Night 모드, Split View(소스+렌더 동시, 스크롤 동기화), 탭 시스템
- 전문 검색 (파일명+본문, AND/OR 연산자), 문서 내 검색(Ctrl+F), 날짜 필터
- 파일 관리 — Rename(F2)/Delete(Del)/Copy Path
- PDF 인쇄, 미디어 뷰어(이미지·비디오·오디오, 줌), PWA 설치
- 파일 드래그 앤 드롭(chroot 자동 확장), CLI 파일 직접 열기, 반응형 사이드바

## 프로젝트 구조 (v0.77 리팩토링 — template literal 해체)

```
simple-doc-viewer/
  server.js                  <- thin entry: CLI 파싱, 보안 게이트, 라우팅, 기동
  server/
    state.js                 <- 런타임 가변 상태 (rootDir, initialFile, port, noOpen)
    config.js                <- 상수 (확장자 화이트리스트, MAX_FILE_SIZE, HIDDEN_NAMES)
    util.js                  <- isTextFile, isPathSafe(경로 봉쇄), isHiddenFile
    respond.js               <- sendJSON, sendError, handlePostBody(JSON 강제)
    mermaid-download.js      <- 첫 실행 시 CDN 다운로드
    pick-folder.ps1          <- Windows IFileDialog 폴더 피커 (PowerShell)
    routes/
      list.js read.js search.js manage.js(rename·delete) media.js(image·media)
      chroot.js pick-folder.js config.js(부트스트랩) static.js(정적 서빙)
  client/
    index.html               <- HTML 골격 (style.css·app.js 링크)
    style.css                <- 전체 CSS
    app/
      manifest.json          <- 결합 순서 정의 (order 배열)
      state.js helpers.js api.js dragdrop.js navigation.js tree.js search.js
      tabs.js content.js markdown.js highlight.js ui.js print.js ui2.js
      media-zoom.js find.js search-wiring.js mermaid-loader.js shortcuts.js main.js
  launcher.js                <- 컨텍스트 메뉴 런처
  install-context-menu.js    <- Windows 컨텍스트 메뉴 등록/해제
  lib/ public/ reference/ docs/ scripts/
```

## Tauri 네이티브 에디션 (v0.79+)

- **두 에디션 한 코드베이스**: 브라우저판(`node server.js`)과 Tauri판이 client/를 공유.
  유일한 분기점은 `client/app/api.js` 어댑터 — `isTauri()`로 fetch ↔ invoke 스왑
- **Rust command가 HTTP API 형태를 미러링** (`src-tauri/src/commands.rs`):
  get_boot_config/list_dir/read_file/search_dir/rename_path/delete_path/check_dir.
  응답 JSON 형태가 /api/*와 동일해야 함 — 한쪽 변경 시 양쪽 동기화 필수
- **미디어**: asset protocol(`convertFileSrc`) — Range 스트리밍 내장. 폴더 피커: plugin-dialog
  (브라우저판의 PowerShell 방식은 브라우저판에만 잔존)
- **launcher.js/포트/kill 로직은 Tauri판에 없음** — plugin-single-instance가 대체
  (두 번째 실행 → 기존 창 포커스 + 파일 인자는 open-file 이벤트로 전달)
- **빌드**: `npm run tauri build` (beforeBuildCommand가 `scripts/build-tauri-frontend.js` 실행 —
  client/ + lib/ + public/을 dist-tauri/로 어셈블, 번들러 없음). dev는 `npm run tauri dev`
  (포트 3299에 node 서버 + webview)
- **주의**: `withGlobalTauri: true` — 클라이언트는 `window.__TAURI__` 전역만 사용 (npm import 금지).
  파일 연결(fileAssociations)은 의도적 미설정 — .md가 MMM과 충돌하므로 Dylan 결정 대기

## 핵심 설계 원칙

### 클라이언트 결합 서빙 (hoisting 의미 보존)
`/client/app.js`는 `client/app/*.js`를 **manifest.json의 order 순서로 결합해 단일 스크립트로 서빙**한다
(`server/routes/static.js`의 `buildAppJs()`). 파일 분리는 개발 편의용이고, 브라우저는 분리 전과
동일한 한 덩어리 스크립트를 받으므로 파일 간 전역 함수 호이스팅 의존이 그대로 보존된다.
**새 클라이언트 파일 추가 시 manifest.json의 order에 반드시 등록할 것.**

### 부트스트랩 — /api/config
구버전의 template literal 서버 값 주입(rootDir, INITIAL_FILE) 2곳은 `/api/config` 런타임 fetch로
대체됐다 (`client/app/main.js`). 클라이언트 파일은 100% 정적이다.

### ~~Template Literal 제약~~ (v0.77에서 폐기)
클라이언트 JS가 server.js의 template literal 안에 살던 시절의 제약(backtick·`${}` 금지,
`\\n` 이중 이스케이프, served-JS 문법 검증 의무)은 **전부 폐기**됐다. client/app/*.js는
일반 JS 파일이며 현대 문법 사용 가능. 단 기존 코드는 single quote + 문자열 연결 스타일이므로
수정 시 주변 스타일을 따른다.

### 변경 후 검증
```bash
# 서버 모듈 문법
node --check server.js && for f in server/**/*.js; do node --check "$f"; done
# 결합된 클라이언트 문법
node -e "new Function(require('./server/routes/static').buildAppJs()); console.log('OK')"
```

## API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | client/index.html 서빙 |
| GET | `/client/app.js`, `/client/style.css` | 결합 JS / CSS |
| GET | `/api/config` | 부트스트랩 (rootDir, initialFile) |
| GET | `/api/list?path=` `/api/read?path=` `/api/search?q=&path=` | 조회 (경로 봉쇄 적용) |
| GET | `/api/image?path=` `/api/media?path=` | 미디어 (media는 Range 스트리밍) |
| POST | `/api/chroot` `/api/rename` `/api/delete` `/api/pick-folder` | 상태 변경 (JSON 강제) |
| GET | `/sw.js` `/public/*` `/lib/katex/*` `/lib/mermaid.min.js` | PWA·라이브러리 |

## 보안 (v0.76 핫픽스 기준)

- **경로 봉쇄**: `isPathSafe()` — realpath 기반 rootDir prefix 검증, 전 파일 API 적용. 루트 확장은 chroot(POST)만
- **CSRF/DNS rebinding**: 전 요청 Host/Origin 검증 (localhost 외 403), POST는 application/json 강제(415)
- **HTML 미리보기 격리**: `sandbox="allow-scripts"` iframe + srcdoc — 스크립트는 실행되나 opaque origin이라 SDV API 접근 불가 (Origin: null → 403)
- **명령 주입 차단**: 피커는 execFile 인자 배열만 사용 (셸 문자열 조립 금지)
- 바이너리 차단(확장자 화이트리스트), 1MB 텍스트 캡, 127.0.0.1 바인딩

## 실행 방법

```bash
node server.js                # 현재 폴더를 문서 루트로
node server.js --root /path   # 특정 폴더 지정
node server.js README.md      # 파일 직접 열기

# 글로벌 alias
sdv / sdv /path / sdv README.md
```

---

## 변화 누적 방지 — 적정 단위 commit & push 제안 의무 (절대 규칙)

에이전트는 코드·문서 어떤 종류든 변경을 발생시켰거나 `git status`에서 누적된 변경분을 발견하면, **적정 단위로 commit & push를 사용자에게 제시**한다. 누적시키지 않는다.

- **단위 기준**: 컴포넌트별 / 기능 단위 / 단일 의도. 여러 영역의 변경을 한 commit에 섞지 않는다 ("한 세션 한 patch" SemVer 원칙과 정렬)
- **제시 시점**: 작업 종료 직전 / 한 작업 단위 완료 직후 / `git status`에 무관 변경분 누적 발견 즉시
- **방식**: `git add -A` 금지 → 명시 파일 selective add → `git diff --cached --stat` 검증 → commit. push는 보안 규칙에 따라 사용자 명시 지시 시에만
- **제시 형식**: `git status` 영역별 분류 → 권장 commit 그룹 (3~5개) + 각 commit의 prefix·메시지 초안 → 사용자 승인 → 단위별 진행

**부재 시 위험**: 한 달 이상 누적되면 history 추적·rollback 불가능. 디스크 손실·실수 rollback 시 working tree 데이터 유실. 다른 세션·다른 멤버 작업과 충돌. (사례: 2026-05-10 aios-dev 레포 13 modified + 14 untracked dirs 누적 발견 — 4월 초~5월 작업 다수가 commit 없이 working tree에만 존재)
