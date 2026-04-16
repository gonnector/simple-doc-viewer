# Test Scenario — Windows IFileDialog 폴더 피커 (v0.73)

- 대상: `server.js::handlePickFolder` (Windows 분기)
- 변경: VBScript `BrowseForFolder` → PowerShell `Add-Type` + `IFileDialog` (FOS_PICKFOLDERS)
- 전제: Windows 10 이상, PowerShell 5.1+ 설치, `powershell.exe`가 PATH에 있음

---

## T-001 — PS1 구문 파싱

- **입력**: 임시 `_sdv_pick.ps1`을 PowerShell AST Parser로 파싱
- **실행**: `[System.Management.Automation.Language.Parser]::ParseFile(...)`
- **기대**: `errors.Count == 0`, 결과 `PARSE_OK`

## T-002 — C# Add-Type 컴파일

- **입력**: PS1 내 `@"...@"` here-string을 추출하여 `Add-Type -TypeDefinition`
- **기대**: 컴파일 성공, `[SdvFolderPicker]::Pick(string, string)` 시그니처 존재

## T-003 — 다이얼로그 표시 (수동)

- **전제**: SDV 서버 기동 (`node server.js`), 브라우저로 `http://localhost:3000/` 접속
- **실행**: 좌상단 폴더 아이콘(`#btn-pick-folder`) 클릭
- **기대**:
  - Windows 10/11 탐색기 스타일 모던 다이얼로그가 표시됨 (주소 바, 좌측 Quick Access, 검색창 포함)
  - 제목: `Select folder for SDV`
  - 초기 위치가 현재 `ROOT_DIR` 경로

## T-004 — 폴더 선택 → chroot

- **실행**: T-003 다이얼로그에서 임의 폴더 선택 → **Select Folder** 클릭
- **기대**:
  - `/api/pick-folder` 응답이 `{ root: "<선택한 경로>" }` (forward-slash 정규화)
  - 사이드바가 해당 폴더 내용으로 갱신

## T-005 — 취소 처리

- **실행**: T-003 다이얼로그에서 **Cancel** 클릭
- **기대**:
  - `/api/pick-folder` 응답이 `{ cancelled: true }`
  - 기존 `ROOT_DIR` 유지, 사이드바 변화 없음

## T-006 — 한글 경로 처리

- **입력**: 경로에 한글 포함된 폴더(예: `E:/프로젝트/문서`) 선택
- **기대**: stdout UTF-8 인코딩으로 전달, `fs.statSync()` 정상 통과, chroot 성공

## T-007 — 초기 경로 존재하지 않는 경우

- **입력**: `ROOT_DIR`이 존재하지 않는 경로일 때 버튼 클릭
- **기대**: `SHCreateItemFromParsingName` 실패는 `catch { }`로 삼킴 → 기본 위치(This PC)에서 다이얼로그가 열림

## T-008 — 다른 플랫폼 회귀 검증 (macOS/Linux)

- **범위**: 본 변경은 `process.platform === 'win32'` 분기만 수정
- **기대**: macOS(osascript), Linux(zenity/kdialog) 분기는 기존 동작 유지 (코드 diff 확인)
