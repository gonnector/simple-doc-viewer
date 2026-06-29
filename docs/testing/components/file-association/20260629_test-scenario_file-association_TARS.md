---
TITLE: 파일 연결 fileAssociations 테스트 시나리오 (기능4)
AUTHOR: TARS
CREATED: 2026-06-29
UPDATED: 2026-06-29
CONTRIBUTORS: [TARS]
TAGS: [sdv, test-scenario, file-association, tauri, nsis, windows]
RELATED:
  - 20260629_plan_sdv-upgrade-implementation_TARS.md
---

# 파일 연결 fileAssociations (md/pdf) — 테스트 시나리오

대상: `src-tauri/tauri.conf.json` (`bundle.fileAssociations`)
기존 배선: `src-tauri/src/lib.rs`(single-instance open-file emit) + `client/app/main.js`(수신) — 변경 없음

## 사전 조사 결과 (research-first, 실기 확정 필요)

- WebSearch + constantinos.dev 블로그("Tauri 앱을 **디폴트**로 만드는 법 — NSIS") 검토 결과: Tauri v2 기본 `fileAssociations`는 확장자 association/ProgID를 등록해 "연결 프로그램(Open with)"에 앱이 나타나게 하되, **디폴트(UserChoice)는 가로채지 않는 것으로 보임**(디폴트로 만들려면 별도 NSIS hook 필요). 이는 Dylan 요구(.md 디폴트 MMM 유지 + SDV 우클릭 등장)와 일치
- **단, 이는 추정이며 실기 설치로 확정해야 함**. 출처: [constantinos.dev](https://constantinos.dev/blog/tauri-default-file-associations-nsis/), [Tauri v2 config](https://v2.tauri.app/reference/config/)

## 시나리오 (설치 후 실기)

| ID | 전제조건 | 입력 | 기대 결과 |
|----|----------|------|-----------|
| T-001 | v0.80.0 인스톨러로 설치 | 탐색기에서 `.md` 우클릭 → "연결 프로그램" | 목록에 SDV 등장 |
| T-002 | 설치됨 | `.pdf` 우클릭 → "연결 프로그램" | 목록에 SDV 등장 |
| T-003 | MMM이 .md 디폴트 | `.md` 더블클릭 | **MMM이 열림(디폴트 유지)**, SDV로 바뀌지 않음 |
| T-004 | 기존 PDF 뷰어가 디폴트 | `.pdf` 더블클릭 | 기존 뷰어 유지 |
| T-005 | 설치됨 | `.md` 우클릭 → "SDV로 열기" 선택 | SDV가 해당 파일을 열어 표시 (open-file 배선) |
| T-006 | SDV 이미 실행 중 | 다른 파일 "SDV로 열기" | 기존 창에서 해당 파일 열림(single-instance) |
| T-007 | (디폴트 가로챔 발생 시) | T-003 실패 | NSIS installerHook으로 UserChoice 미설정/제거 조정 후 재검증 |

## 레거시 공존 메모 (N5 — Dylan 결정 항목)

- 레포에 `install-context-menu.js`(레거시)가 존재. 이는 **브라우저/node 에디션**용으로 `HKCU\Software\Classes\*\shell\SDV`("SDV로 읽기", 모든 파일)에 wscript→launcher.js를 등록함
- 새 Tauri fileAssociations(네이티브 exe, md/pdf)와 **공존 가능**하나, 레거시를 설치해둔 사용자는 우클릭에 두 종류 SDV 항목이 보일 수 있음(레거시=모든 파일 "SDV로 읽기"→node, 신규=md/pdf "연결 프로그램"→네이티브)
- **deprecate 여부는 Dylan 결정 대기**. 이번 작업은 레거시 스크립트를 변경하지 않음

## 검증 방법
- `npm run tauri build`로 인스톨러 생성 → 설치 → 위 시나리오 실기 (Dylan 확인 항목)
- 결과는 `docs/testing/reports/`에 PASS/FAIL 기록

## 관련 문서
- [구현 계획](file:///E:/projects/simple-doc-viewer/docs/plans/20260629_plan_sdv-upgrade-implementation_TARS.md)
