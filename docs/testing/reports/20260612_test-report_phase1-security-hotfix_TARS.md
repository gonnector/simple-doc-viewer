# 검수 보고서 — Phase 1 보안 핫픽스

> 작성: TARS | 2026-06-12
> 시나리오: docs/testing/components/server-security/20260612_test-scenario_phase1-security-hotfix_TARS.md
> 환경: GONNECTOR-HL (Windows 11 Pro), Node.js, 테스트 포트 3210

## 결과 요약

**자동 테스트 19/19 PASS** (문법 게이트 2 + 기능 17). 수동 확인 4건은 Dylan 실기 확인 대기.

## 상세

| ID | 시나리오 | 기대 | 실측 | 판정 |
|----|----------|------|------|------|
| T-000a | 서버 문법 | exit 0 | SERVER SYNTAX OK | PASS |
| T-000b | served JS 문법 | 예외 없음 | SERVED JS OK (91,703 chars) | PASS |
| T-001 | root 밖 읽기 차단 | 403 | 403 | PASS |
| T-002 | root 안 읽기 정상 | 200 | 200 | PASS |
| T-003 | 악성 Origin POST 차단 | 403 | 403 | PASS |
| T-004 | text/plain 우회 차단 | 415 | 415 | PASS |
| T-005 | 비정상 Host 차단 | 403 | 403 | PASS |
| T-006 | 비정상 Range | 416 | 416 | PASS |
| T-007 | 정상 Range | 206 | 206 | PASS |
| T-008 | /public/ traversal 차단 | 403 | 403 | PASS |
| T-009 | chroot GET 차단 | 404 | 404 | PASS |
| T-010 | chroot POST 정상 | 200 | 200 `{"root":"E:/projects"}` | PASS |
| T-011 | 크래시 후 생존 | 200 | 200 (BUG-1 수정 검증) | PASS |
| T-012 | 정상 rename | 200 | 200 `{ok:true}` | PASS |
| T-013 | 정상 delete | 200 | 200 `{ok:true}` | PASS |
| T-014 | rename root 밖 차단 | 403 | 403 | PASS |
| T-015 | suffix Range | 206 | 206 | PASS |
| T-016 | 검색 정상 | 200 | 200 | PASS |
| T-017 | 검색 root 밖 차단 | 403 | 403 | PASS |
| T-M01~M04 | 브라우저 수동 4건 | — | — | **대기** (Dylan 실기) |

## 특이사항

- T-006이 수정 전 코드에서는 서버 프로세스 전체 크래시였음 (BUG-1) — 수정 후 416 응답 + 프로세스 생존 확인
- T-010 이후 ROOT_DIR이 E:/projects로 확장된 상태에서 T-014(C:/로 탈출)가 여전히 403 — containment가 chroot 후에도 유효함을 확인
- 테스트 중 생성한 임시 파일(_t*_phase1.txt)은 전부 정리 완료
