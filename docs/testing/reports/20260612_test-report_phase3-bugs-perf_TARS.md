# 검수 보고서 — Phase 3 버그·성능 수정

> 작성: TARS | 2026-06-12
> 시나리오: docs/testing/components/markdown-renderer/20260612_test-scenario_phase3-bugs-perf_TARS.md
> 환경: GONNECTOR-HL (Windows 11 Pro), Node.js v22.22.0, 테스트 포트 3215

## 결과 요약

- **마크다운 파서 단위 테스트 28/28 PASS** (XSS 8 + 정상 보존 12 + 테이블 3 + 펜스 2 + 회귀 3)
- **통합 테스트 6/6 PASS** (보안 회귀 4종, mermaid 캐시/304, BOM, 검색 캐시 일관성, 문법 게이트)
- 수동 확인 4건 Dylan 실기 대기

## 상세

| ID | 시나리오 | 실측 | 판정 |
|----|----------|------|------|
| 단위 28건 | test-markdown.js | 28 passed, 0 failed | PASS |
| P3-001 | 보안 회귀 4종 | 403/403/416/403 | PASS |
| P3-010 | mermaid 캐시 헤더 | `Cache-Control: public, max-age=86400`, `ETag: "2887239-..."` | PASS |
| P3-011 | ETag 304 | 304 | PASS |
| P3-020 | BOM 제거 | `content starts with BOM: false` | PASS |
| P3-030 | 검색 캐시 일관성 | 2회 결과 동일 | PASS |
| P3-040 | 문법 게이트 | 서버 6모듈 + app.js 결합 + 단위 테스트 전부 OK | PASS |
| P3-101~104 | 코드 검토 4건 | done 래치 / temp+rename / regex 교정 / debounce | PASS (검토) |
| P3-M01~M04 | 브라우저 수동 | — | **대기** (Dylan 실기) |

## 적용 내역

- **XSS (SEC-4·BUG-5)**: inlineFormat을 placeholder-first 구조로 재편 — 인라인 코드·수식·화이트리스트
  태그를 먼저 추출(이때 on* 핸들러·javascript:/vbscript:/data: 스킴 제거) 후 잔여 `<>` 전면 이스케이프.
  img/link 속성은 escAttr + sanitizeUrl. summary는 inlineFormat 경유. restore는 함수형 replace($& 오해석 방지)
- **BUG-2**: 검색 하이라이트 split regex `/[s&]+/` → `/[\s&]+/` (template literal 시절 cooked 버그)
- **BUG-3**: 테이블 split을 "바깥 파이프 제거 후 분할"로 교체 — 빈 내부 셀 보존
- **BUG-4**: /api/read에서 UTF-8 BOM 제거 (cp949 자동 감지는 무의존성 제약상 미구현 — 알려진 한계로 유지)
- **BUG-7**: launcher checkServerAlive에 done 래치 (이중 spawn 방지)
- **BUG-8**: 닫는 코드 펜스 trim 비교 (들여쓰기 허용)
- **BUG-9**: mermaid 다운로드 temp(.download) → 완료 시 rename, 중단 시 unlink
- **PERF-1**: 검색 콘텐츠 mtime+size 캐시 (Map, 2000개 상한) + 중복 statSync 제거
- **PERF-2**: mermaid lazy load (블록 발견 시에만 2.9MB 로드) + Cache-Control/ETag/메모리 버퍼 캐시.
  app.js 결합도 mtime 합 기반 메모리 캐시
- **PERF-3**: Ctrl+F input 200ms debounce
- **PERF-4 lite**: 테마 토글 시 mermaid 문서가 아니면 재렌더 생략 (CSS 변수만으로 전환)

## 미적용 (의도적 보류)

- CSP 헤더(SEC-11): mermaid/KaTeX 인라인 스타일과의 호환을 브라우저에서 검증 후 별도 적용 권장
- mermaid 해시 핀(SEC-9), PERF-5/6/7/8/10/11/12: 저우선순위. launcher /api/open(PERF-9)은
  Phase 4에서 launcher 자체가 plugin-single-instance로 소멸 예정이라 투자 가치 없음
