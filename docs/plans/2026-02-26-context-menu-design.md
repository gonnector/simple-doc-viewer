# SDV 윈도우 파일탐색기 단축메뉴 설계

## 개요

Windows 파일탐색기에서 파일 우클릭 시 "SDV로 읽기" 컨텍스트 메뉴를 추가한다.
실행하면 SDV 서버 상태를 확인하고, 해당 파일의 폴더를 루트로 서버를 시작하여 문서를 보여준다.

## 결정 사항

- **서버 처리 방식**: 방식2 (기존 서버 kill + 재시작). 방식1(서버 재활용)은 향후 업그레이드 (td0000000014)
- **파일 확장자 범위**: 모든 파일에 메뉴 표시. 지원/미지원 여부를 로깅하여 확장자 추가 우선순위 판단용 데이터 수집
- **런처 형식**: Node.js 스크립트 (launcher.js) + VBS 래퍼 (콘솔 창 숨김)
- **로그 위치**: `~/.sdv/access.jsonl` (JSONL 포맷)

## 아키텍처

```
레지스트리 (HKCU\Software\Classes\*\shell\SDV)
    → wscript.exe "sdv-open.vbs" "%1"     (콘솔 창 없음)
        → node launcher.js "파일경로"      (숨겨진 프로세스)
            ├─ 서버 체크 (HTTP GET localhost:PORT)
            ├─ YES → kill 후 재시작
            └─ NO  → 바로 시작
            └─ ~/.sdv/access.jsonl 에 기록
```

## 파일 구성

```
simple-doc-viewer/
  launcher.js                ← 핵심 로직 (서버 체크, 시작, 로깅)
  sdv-open.vbs               ← 콘솔 숨김 래퍼
  install-context-menu.js    ← 레지스트리 등록/해제
```

## 각 파일 상세

### 1. sdv-open.vbs

콘솔 창 없이 Node.js 호출. WScript.Shell.Run의 두 번째 인자 0이 창 숨김.

### 2. launcher.js

- `http.get('http://localhost:PORT/')` 으로 서버 생존 체크
- 살아있으면 기존 프로세스 kill (netstat 기반 PID 탐색)
- `child_process.spawn('node', ['server.js', filePath], { detached: true, stdio: 'ignore' })` 로 백그라운드 서버 시작
- `~/.sdv/access.jsonl` 에 접근 로그 기록
- server.js의 TEXT_EXTENSIONS와 동일한 목록으로 지원 여부 판별

### 3. install-context-menu.js

- `HKCU\Software\Classes\*\shell\SDV` 레지스트리 키 등록 (관리자 권한 불필요)
- command 값: `wscript.exe "절대경로\sdv-open.vbs" "%1"`
- `--uninstall` 플래그로 제거 지원

## 로그 형식 (~/.sdv/access.jsonl)

```jsonl
{"ts":"2026-02-26T08:30:00","action":"OPEN","ext":".md","path":"E:\\docs\\README.md"}
{"ts":"2026-02-26T08:31:00","action":"REJECT","ext":".pdf","path":"E:\\docs\\report.pdf","reason":"unsupported"}
```

- `OPEN`: 지원 확장자, 서버 시작
- `REJECT`: 미지원 확장자 (서버 시작하지 않음, 로그만 기록)

## 사용법

```bash
# 설치 (1회)
node install-context-menu.js

# 제거
node install-context-menu.js --uninstall
```
