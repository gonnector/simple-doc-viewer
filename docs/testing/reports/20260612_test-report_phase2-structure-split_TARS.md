# 검수 보고서 — Phase 2 구조 분리 (template literal 해체)

> 작성: TARS | 2026-06-12
> 시나리오: docs/testing/components/server-refactor/20260612_test-scenario_phase2-structure-split_TARS.md
> 환경: GONNECTOR-HL (Windows 11 Pro), Node.js v22.22.0, 테스트 포트 3213/3214

## 결과 요약

**자동 테스트 전건 PASS** — 무손실 게이트 4, 부트스트랩 3, 보안 회귀 17, 정적 자원 5.
수동 스모크 3건은 Dylan 실기 확인 대기.

## 상세

| ID | 시나리오 | 실측 | 판정 |
|----|----------|------|------|
| P2-001 | 재결합 무손실 | concat === 패치 원본 (extract-client.js 내장 assert 통과, 20개 파일) | PASS |
| P2-002 | 서버 모듈 문법 | 15개 전체 node --check 통과 | PASS |
| P2-003 | served app.js 문법 | new Function OK (91,964 chars) | PASS |
| P2-004 | 라인 diff | 정확히 부트 패치 2곳만 상이 (L22 rootDir + Init 블록 +6줄) | PASS |
| P2-010 | index.html 골격 | link/script 태그 확인 | PASS |
| P2-011 | /api/config 기본 | `{"rootDir":"E:/projects/simple-doc-viewer","initialFile":null}` | PASS |
| P2-012 | CLI 직접 열기 | initialFile에 README.md 절대 경로 반영 | PASS |
| P2-020 | 보안 회귀 17건 | T1 403 / T2 200 / T3 403 / T4 415 / T5 403 / T6 416 / T7 206 / T8 403 / T9 404 / T10 200 / T11 200 / T12 200 / T13 200 / T15 206 / T16 200 / T17 403 / T18 403 / T19 403 — Phase 1과 전부 동일 | PASS |
| P2-030 | 정적 자원 5종 | 전부 200 | PASS |
| P2-M01~M03 | 브라우저 수동 | — | **대기** (Dylan 실기) |

## 특이사항

- 분리 방법: 서버를 띄워 `GET /` 응답(cooked HTML)을 덤프 → 분할. Node가 template literal의
  이중 이스케이프를 이미 해석한 산출물이므로 수작업 역변환 0건, 이스케이프 버그 재생산 위험 0
- 클라이언트는 22개 파일로 분리됐지만 서빙은 단일 결합 스크립트 — hoisting 의미 100% 보존
- 서버 값 주입 2곳은 /api/config 런타임 fetch로 대체 — client/ 전체가 순수 정적
- PWA sw.js가 구버전 HTML(인라인 스크립트)을 캐시하고 있을 수 있음 — 첫 접속 시 network-first라
  자동 갱신되나, 설치 앱에서 이상 시 새로고침 1회 안내
