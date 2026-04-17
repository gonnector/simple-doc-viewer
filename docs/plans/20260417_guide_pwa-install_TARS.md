# SDV PWA 설치 가이드 (Windows / macOS / Linux)

> 작성: TARS | 일자: 2026-04-17
> 대상: SDV v0.74+ (PWA 지원)

---

## 1. 사전 준비

1. SDV 서버 실행
   ```bash
   node E:/project/simple-doc-viewer/server.js
   # 또는 bash alias: sdv
   ```
2. 브라우저에서 접속: `http://localhost:3000`
3. 주소창 우측 "설치" 아이콘 확인

---

## 2. OS별 설치

### Windows (Chrome / Edge)

1. `http://localhost:3000` 접속
2. 주소창 우측 **모니터 + 다운로드 아이콘** 또는 **⋮ 메뉴 → "SDV 설치..."** 클릭
3. "설치" 버튼
4. **시작메뉴 등록 확인** — 시작 누르고 "SDV" 검색
5. 작업표시줄 고정: 아이콘 우클릭 → "작업 표시줄에 고정"

### macOS (Chrome / Edge / Safari 16.4+)

1. `http://localhost:3000` 접속
2. **Chrome/Edge**: 주소창 우측 **설치 아이콘** → "설치"
3. **Safari**: 파일 → "Dock에 추가..." → "추가"
4. **Launchpad에서 "SDV" 검색**
5. **Dock 고정**: Dock의 SDV 아이콘 우클릭 → 옵션 → "Dock에 유지"

### Linux (Chrome / Chromium / Brave)

1. `http://localhost:3000` 접속
2. 주소창 우측 **설치 아이콘** 클릭
3. **Activities에서 "SDV" 검색**
4. **즐겨찾기 추가**: 아이콘 우클릭 → "Add to Favorites"

GNOME/KDE 모두 지원.

---

## 3. 설치 후 특징

- **독립 창** — 브라우저 UI(주소창, 탭) 없이 네이티브 앱처럼 실행
- **오프라인 동작** — Service Worker가 정적 자원 캐시
- **시작메뉴/Dock/Launchpad 등록** — 검색·고정 가능
- **업데이트** — SDV 서버 업데이트 후 앱 재시작 시 자동 SW 갱신

---

## 4. 제거

- Chrome/Edge 주소창 → 설치한 PWA → ⋮ → "제거"
- 또는 `chrome://apps` → SDV 우클릭 → "Chrome에서 제거"

---

## 5. 트러블슈팅

### 설치 아이콘이 안 뜸
- manifest.json이 로드됐는지 확인: `view-source:http://localhost:3000` → `<link rel="manifest">` 존재
- DevTools (F12) → Application → Manifest 탭에서 오류 확인
- 최소 요건: `name`, `icons (192+512)`, `start_url`, `display: standalone` ✓ 이미 충족

### Service Worker 등록 실패
- DevTools → Application → Service Workers 탭
- 에러 메시지 확인 (HTTPS 요구사항? — localhost는 예외로 허용됨)

### 업데이트가 적용 안 됨
- DevTools → Application → Service Workers → "Update on reload" 체크 + 새로고침
- 또는 설치한 PWA 재시작

---

## 6. 기술 구조

- **manifest**: `/public/manifest.json` (서버가 `application/manifest+json` 으로 서빙)
- **Service Worker**: `/sw.js` (root scope, `Service-Worker-Allowed: /` 헤더 포함)
- **아이콘**: `/public/icon-{192,512,maskable-512}.png`, `/public/icon.svg`
- **캐시 전략**: 네트워크 우선 → 실패 시 캐시 fallback
