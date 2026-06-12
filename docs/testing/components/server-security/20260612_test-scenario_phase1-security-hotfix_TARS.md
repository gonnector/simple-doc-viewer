# 테스트 시나리오 — Phase 1 보안 핫픽스

> 작성: TARS | 2026-06-12
> 대상: server.js 보안 핫픽스 (기획안: docs/plans/20260612_plan_sdv-refactoring-native-migration_TARS.md Phase 1)
> 수정 항목: isPathSafe 실구현(SEC-2), Origin/Host 검증(SEC-1·3), Content-Type 강제+chroot/pick-folder POST 전환(SEC-1·6), iframe sandbox(SEC-5), execFile 피커(SEC-7), 정적 핸들러 prefix 검증(SEC-8), /api/media Range 검증+스트림 에러 핸들러(BUG-1)

## 전제조건 (공통)

- 테스트 서버: `node server.js --root E:/projects/simple-doc-viewer --port 3210 --no-open`
- 도구: curl (Git Bash), node (served-JS 검증)

## 시나리오

### 문법 게이트

| ID | 시나리오 | 입력 | 기대 결과 |
|----|----------|------|----------|
| T-000a | 서버 문법 | `node --check server.js` | exit 0 |
| T-000b | served JS 문법 (CLAUDE.md 의무 절차) | `GET /` 응답의 `<script>` 추출 → `new Function()` | 예외 없음 |

### 보안 — 경로 봉쇄 (SEC-2)

| ID | 시나리오 | 입력 | 기대 결과 |
|----|----------|------|----------|
| T-001 | root 밖 파일 읽기 차단 | `GET /api/read?path=C:/Windows/win.ini` | 403 |
| T-002 | root 안 파일 읽기 정상 | `GET /api/read?path=<root>/README.md` | 200 |
| T-014 | rename으로 root 밖 이동 차단 | `POST /api/rename` newPath=C:/Users/... | 403 |
| T-016 | 검색 정상 | `GET /api/search?q=test&path=<root>` | 200 |
| T-017 | 검색 root 밖 차단 | `GET /api/search?q=test&path=C:/Windows` | 403 |

### 보안 — CSRF / DNS rebinding (SEC-1·3·6)

| ID | 시나리오 | 입력 | 기대 결과 |
|----|----------|------|----------|
| T-003 | 악성 Origin POST 차단 | `POST /api/delete` + `Origin: http://evil.example` | 403 |
| T-004 | text/plain 바디 우회 차단 | `POST /api/delete` + `Content-Type: text/plain` | 415 |
| T-005 | 비정상 Host 차단 (rebinding) | `GET /api/read` + `Host: evil.example` | 403 |
| T-009 | chroot GET 차단 (POST 전용) | `GET /api/chroot?path=C:/` | 404 |
| T-010 | chroot POST 정상 | `POST /api/chroot` + JSON `{"path":"E:/projects"}` | 200 + root 반영 |

### 보안 — 정적 핸들러 traversal (SEC-8)

| ID | 시나리오 | 입력 | 기대 결과 |
|----|----------|------|----------|
| T-008 | /public/ 상위 탈출 차단 | `GET /public/../server.js` (--path-as-is) | 403 |

### 안정성 — /api/media (BUG-1)

| ID | 시나리오 | 입력 | 기대 결과 |
|----|----------|------|----------|
| T-006 | 비정상 Range | `Range: bytes=abc-` | 416, 프로세스 생존 |
| T-007 | 정상 Range | `Range: bytes=0-99` | 206 |
| T-015 | suffix Range | `Range: bytes=-100` | 206 |
| T-011 | T-006 직후 서버 생존 | `GET /` | 200 |

### 회귀 — 정상 동작 보존

| ID | 시나리오 | 입력 | 기대 결과 |
|----|----------|------|----------|
| T-012 | 정상 rename (root 내) | `POST /api/rename` + JSON | 200 `{ok:true}` |
| T-013 | 정상 delete (root 내) | `POST /api/delete` + JSON | 200 `{ok:true}` |

### 수동 확인 (브라우저, 별도 세션)

| ID | 시나리오 | 기대 결과 |
|----|----------|----------|
| T-M01 | HTML 파일 미리보기 | sandbox iframe(srcdoc)으로 렌더, 내부 스크립트 미실행 |
| T-M02 | 폴더 피커 버튼 | 네이티브 다이얼로그 정상 (POST 전환 후) |
| T-M03 | path badge로 root 밖 경로 입력 | chroot POST 후 정상 이동 |
| T-M04 | 파일 드래그 앤 드롭 (root 밖) | chroot 확장 후 정상 열림 |
