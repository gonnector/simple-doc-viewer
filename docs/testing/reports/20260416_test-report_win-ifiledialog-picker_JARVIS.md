# Test Report — Windows IFileDialog 폴더 피커 (v0.73)

- 일시: 2026-04-16 KST
- 실행 환경: GONNECTOR-HL (Windows 11 Pro 10.0.26200), PowerShell 5.1.26100.8115
- 대상: `server.js::handlePickFolder` Windows 분기
- 시나리오 문서: `docs/testing/components/pick-folder/20260416_test-scenario_win-ifiledialog-picker_JARVIS.md`

---

## 자동 검증 결과

### T-001 — PS1 구문 파싱  **PASS**

```
$ powershell -NoProfile -File /tmp/ps_syntax_check.ps1 -ScriptPath _sdv_pick_test.ps1
PARSE_OK
```

### T-002 — C# Add-Type 컴파일  **PASS**

```
$ powershell -NoProfile -File /tmp/ps_compile_check.ps1
COMPILE_OK
Method: System.String Pick(System.String, System.String)
```

IFileDialog COM interop wrapper와 `SHCreateItemFromParsingName` P/Invoke 모두 clean compile.

### T-008 — macOS/Linux 분기 회귀  **PASS**

`server.js:494-498` — darwin(osascript) / linux(zenity·kdialog) 분기 코드 변경 없음. win32 분기만 PowerShell로 교체.

---

## 수동 검증 필요 (Dylan 확인 예정)

### T-003 — 모던 다이얼로그 표시  **PENDING**

- 확인 방법: SDV 기동 후 브라우저에서 폴더 아이콘 클릭
- 기대 화면: Windows 10/11 탐색기 스타일 (주소 바 + Quick Access + 검색창)
- 이전(VBS): 좁은 트리 전용 XP-스타일 다이얼로그
- 비교 판단: 모던 다이얼로그가 표시되면 PASS

### T-004 — 폴더 선택 → chroot  **PENDING**

- 임의 폴더 선택 후 `Select Folder` 클릭
- 사이드바가 해당 폴더로 전환되면 PASS

### T-005 — 취소 처리  **PENDING**

- `Cancel` 클릭 시 기존 ROOT_DIR 유지 확인

### T-006 — 한글 경로 처리  **PENDING**

- 한글 포함 경로 선택 시 정상 chroot 확인
- PS 스크립트에 `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` 명시 완료, `exec()`도 `encoding: 'utf8'` 고정

### T-007 — 초기 경로 부재  **PENDING (low risk)**

- C# 측 `try { ... SHCreateItemFromParsingName ... } catch { }` 처리됨 — 실패 시 기본 위치 오픈 동작 기대

---

## 요약

- 자동 검증 3건 PASS (구문·컴파일·회귀)
- 수동 시각·상호작용 검증 5건은 Dylan이 SDV 기동 후 실측 필요
- 런타임 의존성 없음 (PowerShell은 Windows 기본 탑재)

## 후속 조치

Dylan이 T-003~T-007 확인 후 이슈 없으면 v0.73 태그 및 `git push`. 문제 발견 시 본 보고서에 FAIL 기록 후 수정.
