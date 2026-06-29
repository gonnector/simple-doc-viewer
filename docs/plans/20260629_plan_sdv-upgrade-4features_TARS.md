---
TITLE: SDV 업그레이드 설계 — 문서 줌 / 트리 새로고침 / CSV 표 / 파일연결
AUTHOR: TARS
CREATED: 2026-06-29
UPDATED: 2026-06-29
CONTRIBUTORS: [TARS, Dylan]
TAGS: [sdv, tauri, zoom, refresh, csv, file-association, design-spec]
RELATED:
  - 20260612_test-scenario_phase4-tauri-migration_TARS.md
  - prd.md
---

# SDV 업그레이드 설계 (4개 기능)

AIOS goal: `01KW9P971QCCSFWQV4HA9ZSZMV` (SDV 업그레이드)
대상 레포: `E:/projects/simple-doc-viewer` (현재 v0.79.0, 브랜치 `feat/sdv-upgrade-4features`)
목표 버전: **v0.80.0** (기능 4개 묶음 = minor 1회 상향)

## 1. 배경과 목표

SDV는 브라우저판(`node server.js`)과 Tauri 네이티브판을 단일 코드베이스에서 빌드한다. 네이티브 전환(v0.79) 후 빠진 기능과 미구현 기능 4가지를 보완한다.

1. 문서 영역 확대/축소 (브라우저식 단축키). 네이티브 셸에는 브라우저 내장 줌이 없어 앱에서 직접 구현해야 함
2. 새로고침이 좌측 폴더 트리도 함께 갱신
3. CSV/TSV를 표로 렌더 + 컬럼 정렬
4. 파일 확장자 연결(fileAssociations): Windows 우클릭 "SDV로 열기" 등장 (md, pdf)

## 2. 범위

### 포함
- 기능 1: 문서 텍스트 뷰(마크다운/원문/코드/CSV 표) 줌. Ctrl +/Ctrl -/Ctrl 0
- 기능 2: 새로고침 시 활성 문서 + 현재 디렉토리 트리 동시 갱신
- 기능 3: CSV/TSV 표 렌더 + 컬럼 정렬 + 표/원문 토글 (자체 파서, 외부 의존 없음)
- 기능 4: tauri.conf.json `fileAssociations`에 md, pdf 등록. .md/.pdf 디폴트는 기존 앱 유지

### 비범위 (이번 작업 아님, Dylan 확정)
- xlsx/xls 등 엑셀 바이너리 파싱 (CSV 표 기능만)
- csv를 fileAssociations에 등록 (이번엔 md/pdf만. 추후 한 줄 추가 가능)
- macOS/Linux 빌드 및 파일연결 (Windows 우선. 설정은 크로스플랫폼 호환 형태로 두되 검증은 Windows)
- 미디어(이미지/영상) 줌은 기존 transform 방식 유지, 본 작업과 분리

## 3. 공통 아키텍처 제약

- 2에디션 단일 코드베이스. 클라이언트 JS는 공통, `client/app/api.js` 어댑터가 `sdvIsTauri()`로 fetch↔invoke 스왑
- 신규 클라 파일은 `client/app/manifest.json` `order` 배열에 로드 순서 등록 필수 (전역 함수/변수 의존성 순서 유지)
- 전역 네임스페이스 충돌 주의: Tauri가 `isTauri`/`invoke` 전역 주입 → 신규 식별자는 `sdv` 접두 권장
- `renderContent()`(content.js)는 매 호출 시 `#content`의 innerHTML을 통째로 교체. 따라서 렌더 후에도 살아남아야 하는 상태(줌 배율 등)는 `#content` 자체의 style/속성 또는 외부(localStorage)에 보관

## 4. 기능별 설계

### 기능 1 — 문서 영역 줌

**현재 상태**: 텍스트/마크다운/코드 줌 없음. 미디어 전용 줌(`media-zoom.js`, transform scale)만 존재. `shortcuts.js`에 Ctrl 조합은 W/F뿐.

**설계**
- 배율 적용 방식: CSS `zoom` 속성을 텍스트 컨테이너에 적용. 이유: 브라우저 Ctrl+= 와 동일하게 px 단위까지 비례 확대 + 리플로우됨. `font-size` 스케일은 px 고정 요소(코드블록 등)에 안 먹어 부분적. WebView2(Chromium)/WKWebView 모두 CSS `zoom` 지원. (구현 단계에서 양 셸 실측 검증, 문제 시 `transform`+레이아웃 보정으로 폴백)
- 적용 대상: 렌더 분기에서 텍스트 최상위 컨테이너에 `doc-zoomable` 클래스 부여. CSS `.doc-zoomable { zoom: var(--doc-zoom, 1); }`. 대상은 `.md-rendered`(미리보기), `.raw-view`(원문/코드), split 뷰의 양 패널, CSV 표 래퍼. **미디어 뷰어에는 미부여** (사이드바/탭바도 제외 → "문서 영역만")
- 배율 상태: `--doc-zoom` CSS 변수를 `#content`에 설정(innerHTML 교체에도 element 자체 style은 유지, 자식은 var 상속). 따라서 매 렌더마다 재적용 불필요
- 단축키 (`shortcuts.js` Ctrl 조합 블록 추가):
  - Ctrl/Cmd + `=` 또는 `+` (numpad 포함) → 확대
  - Ctrl/Cmd + `-` → 축소
  - Ctrl/Cmd + `0` → 100% 리셋
  - 각 핸들러는 `e.preventDefault()`로 WebView2 내장 줌 가로채기 차단 (충돌 방지)
- 배율 범위: 50%~300%, 10%p 단위. 기본 100%
- 영속화: localStorage 키 `sdv-doc-zoom`에 저장, 앱 시작 시 복원 (전역 단일 배율)
- 선택 UX(한 단계 더): 상태바 또는 툴바에 현재 배율(%) 표시 + 줌 버튼. Ctrl+휠 확대/축소도 추가 가능(옵션, 구현 시 결정)

**변경 파일**: 신규 `client/app/doc-zoom.js` (manifest 등록, `media-zoom.js` 뒤 권장) + `shortcuts.js`(키 핸들러) + CSS(`doc-zoomable` 규칙, 배율 표시 UI) + content.js(텍스트 컨테이너에 클래스 부여)

**엣지/에러**: 입력 포커스(검색창/find) 상태에서 Ctrl+0 등은 텍스트 편집과 무관하므로 항상 동작 OK. 배율 적용 대상이 없는 welcome 화면에서는 무시. localStorage 접근 실패 시 기본 100%로 폴백.

### 기능 2 — 새로고침이 폴더 트리도 갱신

**현재 상태**: `reloadActiveDoc()`(find.js:161~182)이 `apiRead(activeTab)`로 활성 문서만 재로드. 좌측 트리는 폴더 이동 시에만 `navigateTo()`→`apiList()`→`renderTree()`로 갱신.

**설계**
- `reloadActiveDoc()` 확장: 활성 문서 재로드와 동시에 현재 디렉토리(`state.currentPath`) 재나열 후 트리 재렌더
- 상태 보존: 재나열 전 현재 선택 항목 경로와 트리 스크롤 위치를 기억, 재렌더 후 복원 (사용자가 보던 위치 유지). 검색 필터(`state.searchQuery`) 활성 시 필터 유지
- 외부 변경 반영: 다른 프로그램이 현재 폴더에 파일을 추가/삭제/이름변경한 결과가 트리에 나타남. 활성 문서가 외부에서 삭제된 경우 `apiRead` 에러 → 기존 에러 표시 분기로 처리(별도 처리 불필요)
- 활성 탭이 없을 때(welcome): 트리만 현재 경로 기준 재나열 (현재는 early-return이라 아무것도 안 함 → 트리 갱신은 수행하도록 분리)

**변경 파일**: `find.js`(reloadActiveDoc) + 기존 `navigation.js`/`tree.js`/`search.js`의 트리 재렌더 함수 재사용. 구현 시 정확한 함수 시그니처 재확인 후 결선.

**엣지/에러**: 가상 파일(`__dropped__/`)은 문서 재로드 불가(기존 가드 유지)하되 트리 갱신은 진행. 현재 디렉토리가 외부에서 삭제된 경우 `apiList` 에러 → 부모 또는 루트로 폴백(기존 navigation 에러 처리 따름).

### 기능 3 — CSV/TSV 표 + 컬럼 정렬

**현재 상태**: csv/tsv는 백엔드 TEXT_EXTENSIONS에 포함되어 평문으로 읽힘. content.js의 `else` 분기에서 `.raw-view`로 평문 렌더. 표/정렬/파서 전무.

**설계**
- 백엔드 변경 없음 (이미 텍스트로 읽힘). 순수 클라이언트 기능
- 렌더 분기 추가: content.js에 `data.ext === 'csv' || data.ext === 'tsv'` 분기 → 표 렌더 함수 호출
- 파서: 자체 경량 파서. RFC4180 준수 — 따옴표 필드, 따옴표 내 구분자/줄바꿈, `""` 이스케이프 처리. 구분자는 csv=`,`, tsv=`\t`. 첫 행을 헤더로 간주
- 표 렌더: `<table>` 생성. `<thead>` 헤더 고정(CSS `position: sticky`), `<tbody>` 데이터. 컨테이너 `.csv-wrap`(가로/세로 스크롤) + `.doc-zoomable`(줌 연동)
- 컬럼 정렬: 헤더 `th` 클릭 → 해당 컬럼 정렬. 순환: 오름차순 → 내림차순 → 원래 순서. 정렬 방향 화살표 표시. 타입 자동 감지: 해당 컬럼 모든 셀이 숫자로 파싱되면 숫자 정렬, 아니면 로케일 문자열 정렬(빈 값은 끝으로)
- 표/원문 토글(한 단계 더): 표 보기 ↔ 원본 텍스트(`.raw-view`) 토글 버튼. 기존 viewMode와 별개의 csv 전용 토글
- 대용량 가드: 행 수가 매우 큰 경우(임계값 예: 5,000행) 전체 DOM 렌더가 느려질 수 있음. v1은 전체 렌더하되 임계 초과 시 상단에 "N행 중 일부만 표시" 또는 "대용량 파일" 안내 표시. 가상 스크롤은 후속 과제로 명시(silent 절단 금지, 반드시 안내)

**변경 파일**: 신규 `client/app/csv-table.js`(파서 + 렌더 + 정렬, manifest 등록, content.js 앞 순서 의존성 고려) + content.js(분기) + CSS(표 스타일, sticky 헤더, 정렬 화살표, 토글 버튼)

**엣지/에러**: 빈 파일/헤더만 있는 파일/열 수 불균형 행/BOM 처리. 파싱 실패 시 평문(`.raw-view`)으로 폴백하고 콘솔 경고. 매우 긴 셀은 CSS로 말줄임 + title 툴팁.

**테스트**: 파서 단위 테스트 추가 (`scripts/dev/test-csv.js`, 기존 test-markdown.js 패턴). 케이스: 단순/따옴표필드/내장 구분자/내장 줄바꿈/이스케이프 따옴표/TSV/빈 파일/불균형 행.

### 기능 4 — 파일 연결 (md, pdf)

**현재 상태**: `tauri.conf.json`에 `fileAssociations` 없음 → Windows 우클릭 "연결 프로그램"에 SDV 미등장. 단, 파일 인자 실행 배선은 동작(`src-tauri/src/lib.rs`의 single-instance가 `open-file` emit, 클라가 수신해 열기). NSIS `installMode: currentUser`.

**설계**
- `tauri.conf.json` `bundle`에 `fileAssociations` 추가:
  - `{ "ext": ["md", "markdown"], "name": "Markdown", "description": "Markdown document", "role": "Viewer" }`
  - `{ "ext": ["pdf"], "name": "PDF", "description": "PDF document", "role": "Viewer" }`
  - (md만 요청이지만 markdown 확장자도 동반 등록이 자연스러움. 구현 시 Dylan 확인 후 markdown 포함/제외 결정)
- 디폴트 비가로채기(핵심 요구): .md 더블클릭 디폴트는 MMM, .pdf는 기존 뷰어 유지. 목표는 "우클릭 열기 목록에 SDV 추가"까지만
  - Windows 10/11은 설치 프로그램이 디폴트(UserChoice)를 임의 변경하는 것을 보호함 → NSIS fileAssociation 등록은 보통 ProgID 등록 + OpenWithProgIds 추가에 그치고 디폴트는 유지될 가능성이 높음
  - 단 Tauri v2 NSIS의 fileAssociation이 디폴트까지 설정하는지는 **버전별 동작 검증 필요** (구현 단계 첫 작업으로 공식 문서/이슈 조사 + 실측). 만약 디폴트를 강제하면 NSIS installer 템플릿/hook으로 디폴트(UserChoice) 미설정 + OpenWithProgIds만 등록하도록 조정
- 빌드/설치 필요: 변경은 재빌드 + 재설치 시 레지스트리에 반영. 빌드 산출물(인스톨러)은 커밋 대상 아님
- Rust 변경: 원칙적으로 없음(open-file 배선 기존 활용). NSIS 커스터마이즈가 필요하면 `src-tauri/` 하위 NSIS 템플릿/installerHooks 추가

**변경 파일**: `src-tauri/tauri.conf.json`(+ 필요 시 NSIS 템플릿)

**검증(실기 필수)**: 재설치 후 (a) 탐색기 우클릭에 "SDV로 열기" 등장 (b) .md 더블클릭 디폴트가 MMM 유지 (c) .pdf 디폴트가 기존 뷰어 유지 (d) "SDV로 열기" 선택 시 해당 파일이 SDV에 열림(기존 open-file 배선 동작). Dylan 실기 확인 항목.

## 5. 버전 / 브랜치 / 커밋 / 푸시 기준

### 버전 (SemVer)
- 0.79.0 → **0.80.0**. 기능 4개를 하나의 업그레이드 묶음(minor 1회)으로 본다. (대안: 기능별 minor 4회 → 과분하다고 판단해 채택 안 함)
- package.json / Cargo.toml / tauri.conf.json 버전 3곳 동기화

### 브랜치
- 작업 브랜치 `feat/sdv-upgrade-4features` (master 격리). 완료 후 master 머지 + 태그 `v0.80.0`

### 커밋 단위 (1 기능 = 1 커밋 그룹, AIOS task와 매핑)
- 설계 task → `docs:` spec 커밋
- 기능 1~4 task → 각 `feat:` 커밋 1개씩 (논리적으로 크면 하위 분할)
- 테스트 task → `test:` 커밋 (시나리오/리포트/단위테스트)
- 배포 task → `chore:`(빌드설정/버전) + `docs:`(CHANGELOG)
- 규칙: `git add -A` 금지, 명시 파일 selective add, `git diff --cached --stat` 검증 후 커밋. 각 기능 테스트 통과 + 관련 문서 갱신 후에만 커밋
- 메시지 문법(Gonnector): prefix + 본문 + `Worker: TARS` / `Coworker: Dylan gonnector@gonnector.com / ...`

### 푸시 (Dylan 터미널 지시로 사전 승인됨)
- 각 기능이 테스트 통과 + 커밋된 안정 마일스톤마다 `feat/sdv-upgrade-4features` 브랜치 push
- 최종: 테스트/빌드 검증 후 master 머지 + 태그 + master push
- 빌드 산출물(`src-tauri/target/`, 인스톨러 exe)은 `.gitignore`로 push 제외 확인

## 6. 테스트 전략 (변경사항 테스트 의무)

- 단위: CSV 파서 신규 테스트(`scripts/dev/test-csv.js`) + 기존 마크다운 28건 회귀(`test-markdown.js`)
- 시나리오: `docs/testing/components/<모듈>/YYYYMMDD_test-scenario_*_TARS.md` (zoom / refresh-tree / csv-table / file-association 각각)
- 리포트: `docs/testing/reports/YYYYMMDD_test-report_*_TARS.md` 시나리오별 PASS/FAIL
- 실기 검증(Dylan): 줌 단축키 동작·범위, 새로고침 트리 반영, CSV 표/정렬, 파일연결 우클릭+디폴트 유지
- 독립 검증: 답을 모르는 깨끗한 서브에이전트로 spec/코드 adversarial 검토 (자기 점검의 사각 보완). 보안 민감(파일연결 레지스트리)은 보안 관점 별도 검토

## 7. 리스크와 검증 포인트

1. (기능1) CSS `zoom`의 WebView2/WKWebView 동작 차이, position:sticky(CSV 헤더)와 zoom 상호작용 → 실측
2. (기능1) WebView2 내장 줌(Ctrl+휠/Ctrl+=)과 앱 줌 충돌 → preventDefault로 차단 확인
3. (기능4, 최대 미지수) Tauri v2 NSIS fileAssociation이 .md/.pdf 디폴트를 강제하는지 → 문서/이슈 조사 + 실측. 강제 시 NSIS 조정 필요
4. (기능3) 대용량 CSV 렌더 성능 → 임계값 안내, 가상 스크롤 후속
5. (공통) manifest.json 로드 순서 누락 시 신규 파일 미동작 → 등록 확인

## 8. 진행 순서

1. 설계 spec (본 문서) → 자체검토
2. 구현 계획(writing-plans)
3. 설계+계획 독립 검증(clean subagent, 보안 포함) → blocking 0까지 수정
4. 기능 2 → 1 → 3 → 4 순 구현 (2가 가장 작고 안전, 4는 빌드 의존이라 마지막). 각 기능 단위 테스트/커밋
5. 통합 테스트/평가 + 독립 검증
6. 빌드(인스톨러) + CHANGELOG + master 머지/태그/push + AIOS task done + output 등록

## 관련 문서
- [Phase4 Tauri 전환 테스트 시나리오](file:///E:/projects/simple-doc-viewer/docs/testing/components/tauri/20260612_test-scenario_phase4-tauri-migration_TARS.md)
- [PRD](file:///E:/projects/simple-doc-viewer/docs/prd.md)
