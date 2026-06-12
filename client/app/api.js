// --- API (런타임 어댑터) ---
// 브라우저판: node server.js의 /api/* fetch · Tauri판: Rust command invoke.
// Rust command가 HTTP API와 동일한 응답 형태를 반환하므로 (src-tauri/src/commands.rs)
// 이 파일이 두 에디션의 유일한 분기점이다. 호출부는 에디션을 모른다.

function sdvIsTauri() {
  return typeof window !== 'undefined' && !!window.__TAURI__;
}

// invoke 결과/에러를 콜백 컨벤션({...} | {error})으로 변환
function tauriCall(cmd, args, callback, errorExtra) {
  window.__TAURI__.core.invoke(cmd, args || {})
    .then(callback)
    .catch(function(e) {
      var resp = { error: typeof e === 'string' ? e : (e && e.message) || String(e) };
      if (errorExtra) { for (var k in errorExtra) resp[k] = errorExtra[k]; }
      callback(resp);
    });
}

function apiList(dirPath, callback) {
  if (sdvIsTauri()) {
    tauriCall('list_dir', { path: dirPath || state.rootDir }, callback, { items: [] });
    return;
  }
  var url = '/api/list';
  if (dirPath) url += '?path=' + encodeURIComponent(dirPath);
  fetch(url).then(function(r) { return r.json(); }).then(callback).catch(function(e) {
    callback({ error: e.message, items: [] });
  });
}

function apiRead(filePath, callback) {
  if (sdvIsTauri()) {
    tauriCall('read_file', { path: filePath }, callback);
    return;
  }
  fetch('/api/read?path=' + encodeURIComponent(filePath))
    .then(function(r) { return r.json(); })
    .then(callback)
    .catch(function(e) { callback({ error: e.message }); });
}

function apiChroot(dirPath, callback) {
  if (sdvIsTauri()) {
    // 네이티브 앱은 서버 측 컨테인먼트가 없으므로 디렉토리 존재 검증만
    tauriCall('check_dir', { path: dirPath }, callback);
    return;
  }
  fetch('/api/chroot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: dirPath })
  })
    .then(function(r) { return r.json(); })
    .then(callback)
    .catch(function(e) { callback({ error: e.message }); });
}

function apiSearch(dirPath, query, callback) {
  if (sdvIsTauri()) {
    tauriCall('search_dir', { path: dirPath, q: query }, callback, { results: [] });
    return;
  }
  fetch('/api/search?path=' + encodeURIComponent(dirPath) + '&q=' + encodeURIComponent(query))
    .then(function(r) { return r.json(); })
    .then(callback)
    .catch(function(e) { callback({ error: e.message, results: [] }); });
}

function apiRename(oldPath, newPath, callback) {
  if (sdvIsTauri()) {
    tauriCall('rename_path', { oldPath: oldPath, newPath: newPath }, callback);
    return;
  }
  fetch('/api/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPath: oldPath, newPath: newPath })
  })
    .then(function(r) { return r.json(); })
    .then(callback)
    .catch(function(e) { callback({ error: e.message }); });
}

function apiDelete(filePath, callback) {
  if (sdvIsTauri()) {
    tauriCall('delete_path', { path: filePath }, callback);
    return;
  }
  fetch('/api/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath })
  })
    .then(function(r) { return r.json(); })
    .then(callback)
    .catch(function(e) { callback({ error: e.message }); });
}

function apiPickFolder(callback) {
  if (sdvIsTauri()) {
    // 네이티브 다이얼로그 (plugin-dialog) — 브라우저판의 PowerShell 방식 대체
    window.__TAURI__.dialog.open({ directory: true, defaultPath: state.rootDir || undefined })
      .then(function(selected) {
        if (!selected) return callback({ cancelled: true });
        callback({ root: String(selected).replace(/\\/g, '/') });
      })
      .catch(function(e) { callback({ error: String(e) }); });
    return;
  }
  fetch('/api/pick-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  })
    .then(function(r) { return r.json(); })
    .then(callback)
    .catch(function(e) { callback({ error: e.message }); });
}

function apiConfig(callback) {
  if (sdvIsTauri()) {
    tauriCall('get_boot_config', {}, callback);
    return;
  }
  fetch('/api/config')
    .then(function(r) { return r.json(); })
    .then(callback)
    .catch(function(e) { callback({ error: e.message }); });
}

// 미디어/이미지 URL — Tauri는 asset protocol(convertFileSrc, Range 스트리밍 지원)
function mediaSrc(absPath) {
  if (sdvIsTauri()) return window.__TAURI__.core.convertFileSrc(absPath);
  return '/api/media?path=' + encodeURIComponent(absPath);
}

function imageSrc(absPath) {
  if (sdvIsTauri()) return window.__TAURI__.core.convertFileSrc(absPath);
  return '/api/image?path=' + encodeURIComponent(absPath);
}
