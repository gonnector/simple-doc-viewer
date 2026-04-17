# sdv 네이티브 앱 전환 계획

> 작성: TARS | 일자: 2026-04-16
> 상위 문서: `aios/components/desktop-apps/design/20260416_plan_native-app-strategy_TARS.md`

---

## 1. 현재 상태

- Node.js HTTP 서버 (`server.js`) + 브라우저 접속 방식
- 실행: `sdv()` bash 함수 또는 `launcher.js`, `sdv-open.vbs`
- 한계:
  - 하단 런처(시작메뉴/Dock) 자동 등록 안 됨
  - `.md` 파일 더블클릭 → sdv 자동 실행 연결이 수동 설정 필요
  - AIOS 대시보드에서 파일 경로 클릭 → 바로 열기 불가

## 2. 전환 옵션

### 1단계: PWA (권장, 1-2시간)

현재 Node 서버 구조 **유지**하고 PWA 레이어만 추가.

**필요 작업**:
- `public/manifest.json` — 앱 메타정보 (이름, 아이콘, start_url)
- `public/icon-192.png`, `public/icon-512.png` — 앱 아이콘
- `lib/sw.js` — service worker (오프라인 캐싱, 선택)
- `server.js` — manifest.json 서빙 라우트 추가, HTML `<head>`에 `<link rel="manifest">` 추가

**사용자 경험**:
- Chrome/Edge: 주소창 우측 "앱 설치" 버튼 → 시작메뉴/Launchpad 자동 등록
- 설치 후 독립 창으로 실행 (브라우저 UI 없음)
- 파일 연결은 불가 (PWA 한계)

### 2단계: Tauri (선택, 1-2일)

PWA로 부족한 부분(파일 연결, 시스템 트레이, 글로벌 단축키) 필요 시 Tauri로 전환.

**필요 작업**:
- `src-tauri/` 디렉토리 추가 (Rust backend)
- 기존 `server.js` 로직 → Tauri Rust command로 이전
- 프론트엔드 HTML/CSS/JS 재사용
- 파일 연결: `tauri.conf.json`의 `bundle.fileAssociations`
- 단일 `.exe` / `.app` / `.AppImage` 빌드

## 3. AIOS 대시보드 연동

### AIOS 대시보드에서 호출 플로우

1. 대시보드에 태스크 input/output 파일 경로 표시
2. 사용자: "SDV로 열기" 버튼 클릭
3. 대시보드 → AIOS todo 서버 `/fs/open` 엔드포인트 호출 (또는 Tauri 대시보드의 경우 직접 shell.open)
4. 서버: sdv 프로세스가 떠있는지 확인 → 없으면 spawn
5. 서버: `http://localhost:3000/?file=<path>` URL 반환
6. 대시보드: 해당 URL을 새 창으로 열기

### server.js 요구사항 (변경 없음)

- 쿼리 파라미터 `?file=<absolute-path>` 로 특정 파일 바로 열기 지원
- 이미 구현되어 있는지 확인 필요 (구현 안 됐다면 별도 작업)

## 4. 추천

**1단계 PWA 먼저 진행**, 사용하면서 부족한 기능 생기면 2단계 Tauri로 이식.
