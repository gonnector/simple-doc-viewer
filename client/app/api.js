// --- API ---
function apiList(dirPath, callback) {
  var url = '/api/list';
  if (dirPath) url += '?path=' + encodeURIComponent(dirPath);
  fetch(url).then(function(r) { return r.json(); }).then(callback).catch(function(e) {
    callback({ error: e.message, items: [] });
  });
}

function apiRead(filePath, callback) {
  fetch('/api/read?path=' + encodeURIComponent(filePath))
    .then(function(r) { return r.json(); })
    .then(callback)
    .catch(function(e) { callback({ error: e.message }); });
}

function apiChroot(dirPath, callback) {
  fetch('/api/chroot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: dirPath })
  })
    .then(function(r) { return r.json(); })
    .then(callback)
    .catch(function(e) { callback({ error: e.message }); });
}

