# Simple Doc Viewer

## 프로젝트 개요

로컬 파일시스템의 텍스트/마크다운 문서를 브라우저에서 탐색하고 열람하는 경량 문서 뷰어.
Node.js 단일 파일(`server.js`)로 구현, npm 의존성 0개.

## 현재 버전: v0.72

### 핵심 기능
- 파일 트리 탐색 (폴더 진입, 상위 이동, hidden 토글, OS 네이티브 폴더 피커)
- 마크다운 렌더링 (커스텀 파서: 헤딩, 리스트, 테이블, 코드 블록, 각주, YAML frontmatter 카드)
- 구문 강조 (JS, Python, Bash, CSS, HTML, JSON, YAML, SQL, Go, Rust, C/C++, Java, TypeScript)
- Mermaid 다이어그램 (9종: Flowchart, Sequence, Class, State, ER, Gantt, Pie, Mindmap, Git Graph)
- KaTeX 수학 렌더링 (인라인 `$...$`, 블록 `$$...$$`)
- Day/Night 모드 (라이트/다크 테마 토글)
- Split View (마크다운 소스 + 렌더링 동시 보기, 스크롤 동기화)
- 탭 시스템 (다중 파일 열기, Ctrl/Cmd+클릭 복수 선택, 헤더 우상단 Close all/Selected)
- **전문 검색** (파일명 + 본문 매칭, AND/OR 연산자, 매치 카운트 정렬·필터)
- **문서 내 검색 (Ctrl+F)** — 하이라이트, N/M 카운터, 전체 단어 토글
- **날짜 필터** (Modified/Created 각각 from~to)
- **파일 관리** — Rename(F2)/Delete(Del)/**Copy Path**(📋 풀 경로 클립보드)
- **PDF 인쇄** (Pretendard 웹폰트, 인쇄 최적화 CSS)
- **미디어 뷰어** (이미지·비디오·오디오 인라인 재생, 줌 10~400%)
- 스마트 시작 (포트 충돌 자동 해결 + 브라우저 자동 열기, localhost)
- **파일 드래그 앤 드롭** (OS 탐색기 → 브라우저 창, 루트 외 파일도 chroot 자동 확장)
- **CLI 파일 직접 열기** (`node server.js README.md` 형태)
- **반응형 사이드바** (드래그 리사이즈 200~800px, 428px 이하 narrow 모드)
- **마크다운 인라인 이미지** (상대 경로 해석 + `/api/image` 서빙)

## 프로젝트 구조

```
simple-doc-viewer/
  server.js                  <- 단일 파일 (Node.js 내장 모듈만 사용)
  launcher.js                <- 컨텍스트 메뉴 런처 (서버 체크/kill/재시작/로깅)
  install-context-menu.js    <- Windows 컨텍스트 메뉴 등록/해제
  sdv-open.vbs               <- (생성됨) 콘솔 숨김 래퍼
  lib/
    mermaid.min.js            <- 첫 실행 시 CDN에서 자동 다운로드
  reference/                  <- 프로토타입 및 테스트 문서
  docs/                       <- 설계 문서, 개발 일지
  PRD.md                      <- 요구사항 정의서
```

## 기술 제약

### Template Literal 제약 (가장 중요)
`getHTML()` 함수가 template literal(\`...\`)로 전체 HTML을 반환하므로,
클라이언트 JS 코드 전체에 다음 규칙이 적용된다.

**1. backtick · `${}` 금지 — single quote + 문자열 연결만 사용**
```javascript
// 금지
var html = `<div class="${cls}">`;
// 허용
var html = '<div class="' + cls + '">';
```

**2. 이스케이프 시퀀스 이중 이스케이프 필수**

Node.js가 template literal을 평가할 때 `\n`, `\t` 등을 실제 문자로 변환하므로,
브라우저에 `\n`을 전달하려면 server.js 소스에 `\\n`으로 작성해야 한다.

| server.js 소스 | 브라우저 수신 | 용도 |
|----------------|--------------|------|
| `'\\n'` | `'\n'` | 줄바꿈 문자 |
| `'\\t'` | `'\t'` | 탭 문자 |
| `/\\.([^.]+)/` | `/\.([^.]+)/` | regex 이스케이프 |
| `'\\\\path'` | `'\\path'` | 백슬래시 리터럴 |

```javascript
// 금지 (Node.js가 \n을 개행으로 변환 → JS 구문 오류)
data.content.split('\n')

// 허용
data.content.split('\\n')
```

**3. 변경 후 검증 — served JS 문법 확인**
```bash
node -e "
const http = require('http');
http.get('http://localhost:3000/', (res) => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    const m = d.match(/<script>([\s\S]*?)<\/script>/);
    if (m) { try { new Function(m[1]); console.log('JS OK'); }
             catch(e) { console.log('JS ERROR:', e.message); } }
  });
});
"
```

### server.js 내부 구조 (약 2300줄)
| 섹션 | 라인 범위 | 설명 |
|------|-----------|------|
| 모듈 & 설정 | 1-52 | 포트, 루트, 확장자 목록, INITIAL_FILE 파싱 |
| 유틸리티 함수 | 54-75 | 텍스트 판별, 경로 검증, JSON 응답 |
| Mermaid 다운로더 | 77-110 | HTTPS redirect following |
| API 핸들러 | 112-260 | /api/list, /api/read, /api/image, /api/chroot |
| HTML 프론트엔드 | 260~ | getHTML() — CSS, Body, Client JS |
| 서버 시작 | 마지막 | createServer, 라우팅, listen |

### API 엔드포인트
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | 프론트엔드 SPA 서빙 |
| GET | `/api/list?path=...` | 디렉토리 목록 (JSON) |
| GET | `/api/read?path=...` | 파일 내용 읽기 (JSON) |
| GET | `/api/image?path=...` | 이미지 파일 서빙 (GIF, PNG, JPG, SVG, WebP) |
| GET | `/api/chroot?path=...` | 서버 루트 변경 (드래그 앤 드롭용) |
| GET | `/lib/mermaid.min.js` | Mermaid 라이브러리 |

### 보안
- 경로 순회 방지: `path.resolve()` 후 `ROOT_DIR` 접두사 확인
- 바이너리 차단: 확장자 화이트리스트 기반
- 대용량 차단: 1MB 초과 거부
- 로컬 전용: `127.0.0.1` 바인딩

## 실행 방법

```bash
# 현재 폴더를 문서 루트로
node server.js

# 특정 폴더 지정
node server.js --root /path/to/docs

# 파일 직접 열기 (v0.52+)
node server.js README.md
node server.js docs/report.md

# 글로벌 alias (sdv) 설정 완료 시
sdv              # 현재 폴더
sdv /path/to/docs  # 특정 폴더
sdv README.md    # 파일 직접 열기
```

---

## 변화 누적 방지 — 적정 단위 commit & push 제안 의무 (절대 규칙)

에이전트는 코드·문서 어떤 종류든 변경을 발생시켰거나 `git status`에서 누적된 변경분을 발견하면, **적정 단위로 commit & push를 사용자에게 제시**한다. 누적시키지 않는다.

- **단위 기준**: 컴포넌트별 / 기능 단위 / 단일 의도. 여러 영역의 변경을 한 commit에 섞지 않는다 ("한 세션 한 patch" SemVer 원칙과 정렬)
- **제시 시점**: 작업 종료 직전 / 한 작업 단위 완료 직후 / `git status`에 무관 변경분 누적 발견 즉시
- **방식**: `git add -A` 금지 → 명시 파일 selective add → `git diff --cached --stat` 검증 → commit. push는 보안 규칙에 따라 사용자 명시 지시 시에만
- **제시 형식**: `git status` 영역별 분류 → 권장 commit 그룹 (3~5개) + 각 commit의 prefix·메시지 초안 → 사용자 승인 → 단위별 진행

**부재 시 위험**: 한 달 이상 누적되면 history 추적·rollback 불가능. 디스크 손실·실수 rollback 시 working tree 데이터 유실. 다른 세션·다른 멤버 작업과 충돌. (사례: 2026-05-10 aios-dev 레포 13 modified + 14 untracked dirs 누적 발견 — 4월 초~5월 작업 다수가 commit 없이 working tree에만 존재)
