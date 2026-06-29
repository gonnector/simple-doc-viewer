---
TITLE: 새로고침 폴더 트리 갱신 테스트 시나리오 (기능2)
AUTHOR: TARS
CREATED: 2026-06-29
UPDATED: 2026-06-29
CONTRIBUTORS: [TARS]
TAGS: [sdv, test-scenario, refresh, tree]
RELATED:
  - 20260629_plan_sdv-upgrade-implementation_TARS.md
---

# 새로고침 폴더 트리 갱신 — 테스트 시나리오

대상: `client/app/navigation.js`(refreshTree), `client/app/find.js`(reloadActiveDoc)
실행 에디션: 브라우저판(`npm start`) 및 Tauri 빌드본 공통

| ID | 전제조건 | 입력 | 기대 결과 |
|----|----------|------|-----------|
| T-001 | 폴더 A 열림, 문서 없음 | 외부에서 A에 `new.txt` 생성 후 새로고침(R 키 또는 버튼) | 좌측 트리에 `new.txt` 등장 |
| T-002 | 폴더 A 열림, `old.txt` 표시됨 | 외부에서 `old.txt` 삭제 후 새로고침 | 트리에서 `old.txt` 사라짐 |
| T-003 | A의 문서 1개 탭으로 열림 | 문서 내용 외부 수정 + 같은 폴더에 파일 추가, 새로고침 | 문서 내용 재로드 + 트리 새 파일 동시 반영 |
| T-004 | A에서 검색어 입력해 검색 결과 표시 중 | 새로고침 | 검색 결과 재조회, 검색어 유지(트리가 전체 목록으로 리셋되지 않음) |
| T-005 | A 파일 많아 트리 스크롤 내림(비검색) | 새로고침 | 스크롤 위치 유지 |
| T-006 | 트리에서 파일 이름변경 입력(F2) 진행 중 | 새로고침 트리거 시도 | 이름변경 입력이 날아가지 않음(refreshTree skip 가드) |
| T-007 | 가상 파일(드래그-드롭) 활성 | 새로고침 | 문서 재로드는 skip되지만 트리는 현재 폴더 기준 갱신 |
| T-008 | 활성 탭 없음(welcome) | 새로고침 | 에러 없이 트리만 현재 폴더 기준 갱신 |

## 검증 방법
- 브라우저판: `npm start` → 브라우저에서 조작, 외부 파일 변경은 탐색기/터미널로 수행
- 결합 문법: `npm run build:frontend` PASS
- 결과는 `docs/testing/reports/`에 PASS/FAIL 기록

## 관련 문서
- [구현 계획](file:///E:/projects/simple-doc-viewer/docs/plans/20260629_plan_sdv-upgrade-implementation_TARS.md)
