---
TITLE: 문서 영역 줌 테스트 시나리오 (기능1)
AUTHOR: TARS
CREATED: 2026-06-29
UPDATED: 2026-06-29
CONTRIBUTORS: [TARS]
TAGS: [sdv, test-scenario, zoom]
RELATED:
  - 20260629_plan_sdv-upgrade-implementation_TARS.md
---

# 문서 영역 줌 — 테스트 시나리오

대상: `client/app/doc-zoom.js`, `client/app/shortcuts.js`, `client/style.css`
방식: CSS `zoom` 변수(`--doc-zoom`)를 `#content`에 설정, 텍스트 컨테이너(`.md-rendered`/`.raw-view`/`.csv-table`)가 소비. 50~300%, 10%p 단위, localStorage 영속화.

| ID | 전제조건 | 입력 | 기대 결과 |
|----|----------|------|-----------|
| T-001 | 마크다운 문서 열림 | Ctrl + `=` | 본문 110%로 확대, 우하단 토스트 "110%" |
| T-002 | 확대 상태 | Ctrl + `-` | 한 단계 축소 |
| T-003 | 임의 배율 | Ctrl + `0` | 100%로 리셋 |
| T-004 | 본문에 마우스 위치 | Ctrl + 마우스휠 | 휠 방향대로 확대/축소 |
| T-005 | 100% | Ctrl + `-` 반복 | 50%에서 더 안 줄어듦 |
| T-006 | 300% | Ctrl + `=` 반복 | 300%에서 더 안 늘어남 |
| T-007 | 배율 130%로 설정 | 앱 종료 후 재시작 | 130% 유지(localStorage 복원) |
| T-008 | 코드 파일/CSV 표 열림 | Ctrl + `=` | 코드/표도 확대됨 |
| T-009 | 확대 상태 | 좌측 사이드바/탭바 확인 | 사이드바/탭바는 배율 영향 없음(문서 영역만) |
| T-010 | 이미지(미디어) 뷰 | Ctrl + 마우스휠 | 문서 줌 미적용(기존 미디어 줌과 분리), 휠 통과 |
| T-011 | 배율 != 100%에서 Ctrl+F 검색 | 매치로 이동 | 중앙 정렬 좌표가 어긋날 수 있음(WebView2 zoom×rect 한계) — 리포트에 결과 기록 |

## 검증 방법
- Tauri 빌드본(WebView2)과 브라우저판 양쪽에서 확인 (CSS zoom 동작 차이 실측)
- 결합 문법: `npm run build:frontend` PASS (확인됨), 번들에 `sdvZoomIn` 포함(확인됨)
- 결과는 `docs/testing/reports/`에 PASS/FAIL 기록

## 관련 문서
- [구현 계획](file:///E:/projects/simple-doc-viewer/docs/plans/20260629_plan_sdv-upgrade-implementation_TARS.md)
