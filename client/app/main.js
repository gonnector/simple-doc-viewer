// --- Init ---
var INITIAL_FILE_PATH = null;
fetch('/api/config')
  .then(function(r) { return r.json(); })
  .then(function(cfg) {
    state.rootDir = cfg.rootDir;
    INITIAL_FILE_PATH = cfg.initialFile;
    navigateTo('', INITIAL_FILE_PATH ? function() {
      openFile(INITIAL_FILE_PATH, INITIAL_FILE_PATH.split('/').pop());
    } : null);
  });
initMermaid();

// PWA Service Worker 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch(function(err) { console.warn('[SDV] SW registration failed:', err); });
  });
}
