# Simple Doc Viewer

## 프로젝트 개요

로컬 파일시스템의 텍스트/마크다운 문서를 브라우저에서 탐색하고 열람하는 경량 문서 뷰어.
Node.js 단일 파일(`server.js`)로 구현, npm 의존성 0개.

## 현재 버전: v0.5

### 핵심 기능
- 파일 트리 탐색 (폴더 진입, 상위 이동, hidden 토글)
- 마크다운 렌더링 (커스텀 파서: 헤딩, 리스트, 테이블, 코드 블록, 각주 등)
- 구문 강조 (JS, Python, Bash, CSS, HTML, JSON, YAML, SQL, Go, Rust, C/C++, Java, TypeScript)
- Mermaid 다이어그램 (9종: Flowchart, Sequence, Class, State, ER, Gantt, Pie, Mindmap, Git Graph)
- Day/Night 모드 (라이트/다크 테마 토글)
- Split View (마크다운 소스 + 렌더링 동시 보기, 스크롤 동기화)
- 탭 시스템 (다중 파일 열기, 전환, 닫기)
- 검색/필터 (파일명 부분 매칭)

## 프로젝트 구조

```
simple-doc-viewer/
  server.js          <- 단일 파일 (Node.js 내장 모듈만 사용)
  lib/
    mermaid.min.js    <- 첫 실행 시 CDN에서 자동 다운로드
  reference/          <- 프로토타입 및 테스트 문서
  docs/               <- 설계 문서, 개발 일지
  PRD.md              <- 요구사항 정의서
```

## 기술 제약

### Template Literal 제약 (가장 중요)
`getHTML()` 함수가 template literal(\`...\`)로 전체 HTML을 반환하므로,
클라이언트 JS에서 **backtick(\`)과 `${}`를 절대 사용 불가**.
반드시 **single quote + 문자열 연결**만 사용.

```javascript
// 금지
var html = `<div class="${cls}">`;
// 허용
var html = '<div class="' + cls + '">';
```

### server.js 내부 구조 (약 2100줄)
| 섹션 | 라인 범위 | 설명 |
|------|-----------|------|
| 모듈 & 설정 | 1-52 | 포트, 루트, 확장자 목록 |
| 유틸리티 함수 | 54-75 | 텍스트 판별, 경로 검증, JSON 응답 |
| Mermaid 다운로더 | 77-110 | HTTPS redirect following |
| API 핸들러 | 112-178 | /api/list, /api/read |
| HTML 프론트엔드 | 180~ | getHTML() — CSS, Body, Client JS |
| 서버 시작 | 마지막 | createServer, 라우팅, listen |

### API 엔드포인트
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/` | 프론트엔드 SPA 서빙 |
| GET | `/api/list?path=...` | 디렉토리 목록 (JSON) |
| GET | `/api/read?path=...` | 파일 내용 읽기 (JSON) |
| GET | `/lib/mermaid.min.js` | Mermaid 라이브러리 |

### 보안
- 경로 순회 방지: `path.resolve()` 후 `ROOT_DIR` 접두사 확인
- 바이너리 차단: 확장자 화이트리스트 기반
- 대용량 차단: 1MB 초과 거부
- 로컬 전용: `127.0.0.1` 바인딩

## 다음 계획 (v0.6)

- LaTeX 수식 지원 (KaTeX)
- 폰트 파일 서빙 방식 설계 필요

## 실행 방법

```bash
# 현재 폴더를 문서 루트로
node server.js

# 특정 폴더 지정
node server.js --root /path/to/docs

# 글로벌 alias (sdv) 설정 완료 시
sdv              # 현재 폴더
sdv /path/to/docs  # 특정 폴더
```
