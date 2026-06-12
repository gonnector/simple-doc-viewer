# 테스트 시나리오 — Phase 3 버그·성능 수정

> 작성: TARS | 2026-06-12
> 대상: XSS 방어(SEC-4·BUG-5), 잔여 버그(BUG-2/3/4/7/8/9), 성능 Top 3(PERF-1/2/3) + 테마 토글
> 기획안: docs/plans/20260612_plan_sdv-refactoring-native-migration_TARS.md Phase 3

## 단위 테스트 — 마크다운 파서 (scripts/dev/test-markdown.js, Node VM 직접 로드)

| 그룹 | 시나리오 (28건) | 기대 결과 |
|------|----------------|----------|
| XSS 방어 8건 | img 속성 따옴표 탈출, javascript: 링크, raw `<script>`/`<img onerror>`, 화이트리스트 태그의 on* 속성·javascript: href, summary 주입 | 이스케이프/제거됨, `href="#"` 치환 |
| 정상 보존 12건 | bold/link/image/kbd/br/인라인 코드 내 HTML·&·$&/heading/autolink/details 내부 마크다운 | 기존과 동일 렌더 |
| BUG-3 3건 | 빈 내부 셀 테이블, 일반 테이블, 정렬 | 빈 `<td>` 보존, 열 밀림 없음 |
| BUG-8 2건 | 들여쓰기 닫는 펜스, 일반 펜스 | 이후 본문 정상 파싱 |
| 회귀 3건 | 각주, 체크리스트, 인용 | 기존과 동일 |

## 통합 테스트 (서버 기동)

| ID | 시나리오 | 기대 결과 |
|----|----------|----------|
| P3-001 | 보안 회귀 핵심 4종 (T1/T3/T6/T8) | 403/403/416/403 |
| P3-010 | mermaid 캐시 헤더 | `Cache-Control: public, max-age=86400` + ETag |
| P3-011 | mermaid ETag 재검증 | If-None-Match → 304 |
| P3-020 | BOM 파일 /api/read | content 선두에 U+FEFF 없음 (BUG-4) |
| P3-030 | 동일 검색 쿼리 2회 | 결과 동일 (mtime 캐시 일관성, PERF-1) |
| P3-040 | 문법 게이트 | 서버 모듈 + 결합 app.js + 마크다운 테스트 전부 통과 |

## 코드 검토 기반 (런타임 재현이 어려운 항목)

| ID | 항목 | 검증 방법 |
|----|------|----------|
| P3-101 | BUG-7 launcher 콜백 이중 호출 | done 래치 코드 검토 — timeout 후 destroy의 error 이벤트가 fire() 재진입 불가 |
| P3-102 | BUG-9 mermaid 부분 파일 | temp(.download) 작성 → finish 시에만 rename. 중단 시 unlink |
| P3-103 | BUG-2 검색 하이라이트 regex | `/[s&]+/` → `/[\s&]+/` (cooked 버그 교정) |
| P3-104 | PERF-3 Find debounce 200ms | 코드 검토 + 수동 |

## 수동 확인 (브라우저)

| ID | 시나리오 | 기대 결과 |
|----|----------|----------|
| P3-M01 | mermaid 없는 문서 열람 시 네트워크 탭 | mermaid.min.js 요청 없음 (lazy), mermaid 문서 열면 로드 후 렌더 |
| P3-M02 | 테마 토글 (큰 md 문서) | 즉각 전환 (재파싱 없음), mermaid 문서는 다이어그램 테마 재적용 |
| P3-M03 | Ctrl+F 타이핑 | 입력 지연 없음 (200ms debounce) |
| P3-M04 | `a < b`, `<kbd>`, 인라인 코드 내 `<div>` 포함 문서 | 기존과 동일하게 표시 (전역 이스케이프 회귀 없음) |
