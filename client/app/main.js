// --- Init ---
var INITIAL_FILE_PATH = null;
apiConfig(function(cfg) {
  if (cfg.error) return;
  state.rootDir = cfg.rootDir;
  INITIAL_FILE_PATH = cfg.initialFile;
  navigateTo('', INITIAL_FILE_PATH ? function() {
    openFile(INITIAL_FILE_PATH, INITIAL_FILE_PATH.split('/').pop());
  } : null);
});
// initMermaid()는 eager 호출하지 않음 — renderMermaidBlocks()가 mermaid 블록 발견 시 lazy load

if (sdvIsTauri()) {
  // 두 번째 인스턴스 실행 시 (파일 더블클릭 등) single-instance 플러그인이 보내는 이벤트
  window.__TAURI__.event.listen('open-file', function(ev) {
    var fp = ev.payload;
    if (!fp) return;
    var dir = fp.substring(0, fp.lastIndexOf('/'));
    var name = fp.substring(fp.lastIndexOf('/') + 1);
    dropOpenFile(fp, dir, name);
  });
} else if ('serviceWorker' in navigator) {
  // PWA Service Worker 등록 (브라우저판 전용 — Tauri에서는 무의미)
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch(function(err) { console.warn('[SDV] SW registration failed:', err); });
  });
}
