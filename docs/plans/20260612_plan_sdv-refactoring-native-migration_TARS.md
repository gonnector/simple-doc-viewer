# SDV 리팩토링 및 Tauri 네이티브 전환 기획안

> 작성: TARS | 2026-06-12 09:39 KST
> 대상: E:/projects/simple-doc-viewer (server.js 4,122줄 단일 파일, npm 의존성 0)
> 분석 방법: 서브에이전트 4기 병렬 — 보안 / 버그 / 성능 / 아키텍처 관점, 전 코드 라인 검증 기반
> AIOS: goal 01KTWKK2DQDMFSTP993PH8B706 / task 01KTWKKDB0NZAC8S6Q90PRXJZE
> 상태: **Dylan 컨펌 대기**

---

## 1. 요약 (Executive Summary)

4관점 분석 결과 **31건의 발견사항** (보안 11, 버그 9, 성능 12 — 중복 2건 통합 시 순 29건).

- **보안이 가장 심각**: `isPathSafe()`가 항상 `true`를 반환하는 스텁 + CSRF 방어 전무 →
  **임의의 웹사이트가 사용자 PC의 아무 폴더나 재귀 삭제 가능** (SEC-1+SEC-2 결합, Critical 2건)
- **서버 크래시 버그 1건**: 잘못된 Range 헤더 하나로 서버 프로세스 전체 사망 (BUG-1, High)
- **구조적 근본 원인**: 클라이언트 JS 3,411줄(전체의 83%)이 template literal 안에 살면서
  이중 이스케이프 버그 클래스를 양산 — 정적 파일 분리로 **구조적 소멸** 가능
- **Tauri 전환**: 서버 책임의 대부분이 plugin-fs/dialog로 대체 가능. MMM 검증 패턴 재사용으로
  옵션 3(플러그인 + 프론트 재구성)이 최적 — 단, 구조 리팩토링 선행이 전제

**권고 경로**: 보안 핫픽스 → 구조 분리 → 버그·성능 수정 → Tauri 전환 (4 Phase)

---

## 2. 분석 결과 — 보안 (11건)

로컬 HTTP 서버 특성상 "localhost니까 안전"이 성립하지 않음이 핵심.
브라우저의 다른 탭(임의 웹사이트)이 공격 주체가 될 수 있다.

| ID | 심각도 | 위치 (server.js) | 내용 |
|----|--------|------------------|------|
| SEC-1 | **Critical** | :236-243, :3938-3961 | CSRF로 임의 파일/폴더 삭제·이동 — `text/plain` 바디는 CORS preflight를 우회하므로 악성 페이지가 `/api/delete`에 `{"path":"C:/Users/Pro/Documents"}` 발사 가능. `fs.rmSync(recursive)` 실행됨 |
| SEC-2 | **Critical** | :105-108 | `isPathSafe()`가 무조건 `true` 반환 — 모든 파일 API가 전체 파일시스템 접근 가능. SEC-1의 피해 범위를 무한 확장 |
| SEC-3 | High | :3923-3925 | DNS rebinding — Host 헤더 미검증. 공격자 도메인이 127.0.0.1로 rebind되면 same-origin이 되어 `/api/read` 응답까지 탈취 (SSH 키, AWS credential 등) |
| SEC-4 | High | :2733-2751, :3020-3028 | 마크다운 렌더러 XSS 다수 — raw HTML passthrough가 `on*` 속성 허용, img/link href·src·alt 미이스케이프, `javascript:` 스킴 허용. 악성 .md 열람 = 코드 실행 |
| SEC-5 | High | :2608-2615 | HTML 파일 미리보기가 sandbox 없는 same-origin iframe — 악성 .html 열람 즉시 파일 API 전권 |
| SEC-6 | Medium | :404-414 | `/api/chroot`가 GET + 무인증 — CSRF로 ROOT_DIR 변경 가능 |
| SEC-7 | Medium | :494-499 | 폴더 피커 명령 주입 (macOS/Linux) — ROOT_DIR을 셸 문자열에 직접 연결, `$()` 포함 경로명으로 임의 명령 실행 |
| SEC-8 | Medium | :4003-4029 | `/public/`, `/lib/katex/` 정적 핸들러 path traversal — `..` 검증 없음 |
| SEC-9 | Low | :245-287 | mermaid.min.js CDN 다운로드 무결성 미검증 (해시 핀 없음) |
| SEC-10 | Low | :386-401, :3966-3993 | SVG 직접 내비게이션 시 same-origin 스크립트 실행 |
| SEC-11 | Low | :3994-4002 | CSP 부재 + Service Worker 루트 스코프 — XSS 시 영속화 경로 |

검증 완료(문제 아님): PID 보간(`/^\d+$/` 검증됨), openBrowser(고정 리터럴), install-context-menu(외부 입력 미도달).

## 3. 분석 결과 — 버그 (9건)

| ID | 심각도 | 위치 | 내용 |
|----|--------|------|------|
| BUG-1 | **High** | server.js:3966-3993 | `/api/media` 스트림 error 핸들러 부재 + Range 파싱 NaN → `Range: bytes=abc-` 요청 하나로 **서버 프로세스 전체 크래시** (재현 확인됨). fd 누수 동반 |
| BUG-2 | Medium | :1949 | template literal 이스케이프 버그 실증 1건 — `/[\s&]+/`가 `/[s&]+/`로 cook되어 검색 하이라이트 오동작. 전 템플릿 영역 스캔 결과 유일한 발생 (cook + `new Function()` 검증 완료) |
| BUG-3 | Medium | :2935-2949 | 마크다운 테이블 빈 셀 드롭 → 열 밀림 |
| BUG-4 | Medium | :375 | UTF-8 강제 디코딩 — cp949/EUC-KR 한글 파일 깨짐, BOM 미제거 |
| BUG-5 | Low | :2739-2748 | 링크/이미지 속성 미이스케이프 (SEC-4와 중복, 보안 픽스로 흡수) |
| BUG-6 | Low | :404-414 | chroot GET 상태 변경 (SEC-6과 중복) |
| BUG-7 | Low | launcher.js:134-147 | `checkServerAlive` 콜백 이중 호출 → 서버 2개 spawn 레이스 |
| BUG-8 | Low | server.js:2892 | 들여쓰기된 닫는 코드 펜스 미인식 → 문서 잔여 전체가 코드로 삼켜짐 |
| BUG-9 | Low | :262-283 | mermaid 다운로드 중단 시 부분 파일 잔존 → 다음 실행부터 다이어그램 영구 파손 |

## 4. 분석 결과 — 성능 (12건, Top 3 중심)

전 서버 fs I/O가 동기(sync) — 비동기 호출 0건. 마크다운 렌더링은 100% 클라이언트 측.

| 우선 | ID | 내용 | 효과 |
|------|----|----- |------|
| 1 | PERF-2 | mermaid.min.js **2.89MB(실측)** 를 매 페이지 eager 로드 + 캐시 헤더 전무 | 헤더 1줄 + lazy-load로 매 로드 2.9MB 절감 |
| 2 | PERF-1 | 검색이 매 쿼리마다 디렉토리 전 파일 full re-read (mtime 캐시 없음, 중복 stat) | mtime 키 캐시로 I/O ~100배 절감 (추정) |
| 3 | PERF-3+4 | Ctrl+F 무debounce 전체 DOM 재작성 / 테마 토글·탭 전환마다 전체 re-parse | 렌더 캐시 + debounce로 대형 문서 체감 지연 대부분 제거 |

기타: 디렉토리 stat storm(PERF-5), 대형 파일 가상화 부재(PERF-6), getHTML 137.8KB(실측) 무캐시(PERF-7), highlightCode O(n²) 토큰 복원(PERF-8), launcher가 파일 열 때마다 서버 kill+재시작 2~3초(PERF-9), /api/image 전체 버퍼링(PERF-10), 스크롤 핸들러 무throttle(PERF-11), SW가 매 로드 2.9MB 재캐시(PERF-12).

메모리 누수 없음 확인 (tabCache는 탭 닫기 시 삭제, 1MB 캡 바운드).

## 5. 구조 분석 — 질량 분포와 근본 문제

```
server.js 4,122줄
├─ 서버 로직          712줄 (17%)  — 핸들러 14개 (rename/delete/media는 라우터 인라인)
└─ getHTML() 블롭   3,411줄 (83%)
   ├─ CSS    810줄
   ├─ HTML   218줄
   └─ 클라 JS 2,362줄 (마크다운 파서 408, Ctrl+F 201, 탭 190, ...)
```

`${}` 서버 값 주입은 **단 2곳** (L1577 rootDir, L3904 INITIAL_FILE). 나머지 3,400여 줄은 사실상 정적.
→ 클라이언트를 정적 파일로 분리하고 그 2개 값만 `/api/config`로 전달하면
이중 이스케이프 버그 클래스(BUG-2 류)와 served-JS 검증 의무가 **구조적으로 소멸**.

**무손실 분리 트릭**: `\\n`→`\n` 수작업 역변환(200+개소) 대신, 서버를 띄워 `GET /` 응답을 덤프하면
Node가 이미 정확히 cook한 산출물이 나옴 → `<style>`/`<body>`/`<script>` 경계로 분할 →
`new Function()` 문법 검증 + diff 확인. 변환이 기계적·검증 가능.

### 목표 구조

```
simple-doc-viewer/
  server.js              # thin entry (~120줄): 인자 파싱, createServer, 기동
  server/
    config.js respond.js pick-folder.ps1 mermaid-download.js
    routes/  list.js read.js search.js manage.js media.js chroot.js pick-folder.js static.js
  client/
    index.html style.css
    app/  state.js helpers.js api.js dragdrop.js tree.js tabs.js content.js
          markdown.js highlight.js find.js media-zoom.js print.js ui.js main.js
  launcher.js / install-context-menu.js / public/ / lib/   # 불변
```

- 번들러 불필요 — `<script src>` 순차 로드 (현 코드 전부 전역 var이므로 로드 순서만 유지하면 무변경 동작)
- 보존: npm 의존성 0, `node server.js` 단일 명령, 오프라인 동작, 전 기능
- 부수 효과: 프로젝트 CLAUDE.md의 Template Literal 제약 섹션 폐기, launcher.js와의 확장자 세트 중복 단일화
- 하우스키핑: PRD.md 루트 → docs/ 이동 (네이밍 규칙 위반 해소)

---

## 6. 실행 계획 — 4 Phase

### Phase 1 — 보안 핫픽스 (서버 측, 분리 전 즉시)

구조 변경 없이 서버 코드(712줄 영역)에만 적용. 분리 후에도 그대로 승계됨.

1. `isPathSafe()` 실제 구현 — realpath 후 ROOT_DIR prefix 검증, 403 (SEC-2)
2. Origin/Host 검증 미들웨어 — localhost 외 421 거부 (SEC-1, SEC-3 동시 방어)
3. `Content-Type: application/json` 강제 + chroot POST 전환 (SEC-1, SEC-6)
4. HTML 미리보기 iframe `sandbox` 속성 (SEC-5 — 클라 측이지만 1속성 추가라 핫픽스에 포함)
5. 폴더 피커 `execFile` 인자 배열 전환 (SEC-7), 정적 핸들러 prefix 검증 (SEC-8)
6. BUG-1 동시 수정 — Range 검증(416 응답) + 스트림 error 핸들러 (크래시 버그라 긴급)

### Phase 2 — 구조 분리 (template literal 해체)

1. served-HTML 덤프 → client/ 분할 → 문법 검증 + diff
2. 서버 핸들러 → server/routes/ 모듈화 (rename/delete/media 인라인 코드를 핸들러로 승격)
3. `/api/config` 엔드포인트로 주입 2개 대체
4. 회귀 테스트 시나리오 작성·실행 (docs/testing/ 3계층 의무 절차)

### Phase 3 — 버그·성능 수정 (분리 후 — 이스케이프 부담 없는 상태에서)

1. XSS 일괄 수정 — 속성 이스케이프, 스킴 화이트리스트, raw HTML sanitize (SEC-4, BUG-5)
2. 잔여 버그 — 테이블 빈 셀(BUG-3), 인코딩/BOM(BUG-4), launcher 이중 콜백(BUG-7), 펜스(BUG-8), mermaid 부분 파일(BUG-9), 이스케이프 버그(BUG-2는 분리 과정에서 자연 해소)
3. 성능 Top 3 — mermaid lazy+캐시 헤더, 검색 mtime 캐시, 렌더 캐시+Find debounce
4. 여력 시: launcher `/api/open` 엔드포인트(PERF-9), CSP 추가(SEC-11), mermaid 해시 핀(SEC-9)

### Phase 4 — Tauri v2 전환

서버 책임 분류 (아키텍처 분석 결과):
- **A. 순수 클라 (~2,800줄)**: 분리된 client/가 무수정 재사용. 예외: PWA SW 제거, PDF 인쇄는 WKWebView 검증 필요
- **B. 플러그인 대체**: list/read/rename/delete → plugin-fs, 폴더 피커 → plugin-dialog,
  이미지·미디어 → asset protocol(Range 지원), drag-drop → onDragDropEvent(현재보다 개선),
  CLI 인자 → MMM `get_open_file_arg` 재사용, 파일 연결 → fileAssociations + file_assoc.rs,
  launcher 전체 → plugin-single-instance로 소멸, mermaid → 리소스 번들
- **C. Rust command**: 검색(재귀 업그레이드 시 `ignore`+`grep` crate), 파일 연결 레지스트리 토글

#### 전환 전략 3안 비교

| | 1안: 전부 Rust 재구현 | 2안: Node sidecar | 3안: plugin-fs + 프론트 재구성 |
|---|---|---|---|
| 공수 | 2~3주 | 3~5일 | 1~2주 (Phase 2 전제) |
| 리스크 | 중상 — Rust 표면적 최대 | 중 — 포트·생명주기 문제 잔존 | 낮음~중 — MMM 패턴 전부 검증됨 |
| 산출물 | 성능 최상이나 과잉 | ~80MB+, 경량 정체성 상실 | 수 MB 단일 실행파일, 서버 개념 소멸 |
| 추천 | 3위 | 2위 (PoC 가교로만) | **1위** |

**3안 채택 시**: api.js를 MMM fileTarget.ts와 동일한 런타임 어댑터로 교체 —
`isTauri()` 분기로 fetch ↔ plugin-fs 스왑, **브라우저판(node server.js)과 Tauri판이 한 코드베이스 공존**.
보안 관점 보너스: HTTP 서버 소멸 = SEC-1/3/6/7/8 공격 표면 자체가 사라짐 (단 XSS는 webview에서 더 중요해짐 — Phase 3 선행 필수).

검증 필요 잔여 3건: WKWebView 인쇄, WebView2 코덱(mkv/avi), asset protocol scope.

---

## 7. 테스트·커밋 운영

- 각 Phase = 독립 커밋 단위 (체크포인트). Phase 내 작업 묶음별 selective add
- 3계층 테스트 의무: Phase별 시나리오(docs/testing/components/) + 검수 보고서(docs/testing/reports/)
- Phase 2 핵심 게이트: 분리 전후 served-JS `new Function()` 검증 + 전 기능 회귀 시나리오
- 커밋 컨벤션: Worker: TARS / Coworker: Dylan gonnector@gonnector.com
- 기존 untracked: reference/sdv-showcase.md.pdf — 커밋 여부 Dylan 확인 필요

## 8. 미결정 사항 (Dylan 판단 요청)

1. **본 기획안 전체 승인 여부** — Phase 1~4 순서 포함
2. **Tauri 전환 전략** — 3안 권고 (1위), 이견 시 재논의
3. **Phase 4에서 브라우저판 병행 유지 여부** — 어댑터 패턴이라 추가 비용 낮음, 유지 권고
4. reference/sdv-showcase.md.pdf 커밋 여부
