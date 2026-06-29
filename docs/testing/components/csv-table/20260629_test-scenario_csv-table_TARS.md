---
TITLE: CSV/TSV 표 렌더 + 정렬 테스트 시나리오 (기능3)
AUTHOR: TARS
CREATED: 2026-06-29
UPDATED: 2026-06-29
CONTRIBUTORS: [TARS]
TAGS: [sdv, test-scenario, csv, table, sort]
RELATED:
  - 20260629_plan_sdv-upgrade-implementation_TARS.md
---

# CSV/TSV 표 렌더 + 정렬 — 테스트 시나리오

대상: `client/app/csv-parser.js`(파서, 단위테스트 16건 PASS), `client/app/csv-table.js`(렌더/정렬/토글), `client/app/content.js`(분기), `client/style.css`
픽스처: `docs/testing/fixtures/sample.csv`, `docs/testing/fixtures/sample.tsv`

| ID | 전제조건 | 입력 | 기대 결과 |
|----|----------|------|-----------|
| T-001 | sample.csv 열기 | - | 표로 렌더, 첫 행이 헤더 |
| T-002 | 따옴표·내장 구분자 행 | - | 따옴표 안 콤마가 분리되지 않고 한 셀 |
| T-003 | 숫자 컬럼 헤더 클릭 | 1클릭/2클릭/3클릭 | 오름차순 → 내림차순 → 원래순서, 숫자 크기 기준 정렬 |
| T-004 | 문자 컬럼 헤더 클릭 | 클릭 | 로케일 문자열 정렬, 빈 값은 끝 |
| T-005 | 표 보기 상태 | "원문 보기" 클릭 | 원본 텍스트로 전환, 버튼 "표 보기"로 |
| T-006 | sample.tsv 열기 | - | 탭 구분 표로 렌더 |
| T-007 | 표 세로 스크롤 | 스크롤 | 헤더 sticky 고정 (WebView2/브라우저 실측 — zoom과 상호작용 확인) |
| T-008 | 표 열린 상태 | Ctrl + `=` | 표 폰트/셀 확대 (zoom은 .csv-table 적용) |
| T-009 | 5000행 초과 CSV | 열기 | 상단 "N행 중 처음 5,000행만 표시" 안내 |
| T-010 | 헤더만 있는 CSV | 열기 | 헤더 + "데이터 없음" 행 |
| T-011 | 빈 파일 | 열기 | "빈 파일" 표시 |
| T-012 | 표 스크롤 | 스크롤 | 상태바가 "N rows" + % 갱신 (B1) |

## 검증 방법
- 단위 테스트: `npm run test:csv` (16건 PASS 확인됨)
- 결합 문법: `npm run build:frontend` PASS (확인됨), 번들에 renderCsv/sdvParseDelimited 포함(확인됨)
- 런타임: 브라우저판(`npm start`)에서 픽스처 열어 실제 렌더/정렬/토글 확인 (Task 6 통합 검증)
- 결과는 `docs/testing/reports/`에 PASS/FAIL 기록

## 관련 문서
- [구현 계획](file:///E:/projects/simple-doc-viewer/docs/plans/20260629_plan_sdv-upgrade-implementation_TARS.md)
