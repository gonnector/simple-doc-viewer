// --- Drag & Drop ---
var $dropOverlay = document.getElementById('drop-overlay');
var _dragDepth = 0;

// Tauri: 네이티브 drag-drop 이벤트가 실제 절대 경로를 제공 (브라우저판 uri-list 추정보다 정확).
// dragDropEnabled=true에서는 DOM drop 이벤트가 억제되므로 아래 DOM 리스너는 동작하지 않음
if (typeof sdvIsTauri === 'function' && sdvIsTauri()) {
  window.__TAURI__.event.listen('tauri://drag-enter', function() {
    $dropOverlay.classList.add('active');
  });
  window.__TAURI__.event.listen('tauri://drag-leave', function() {
    $dropOverlay.classList.remove('active');
  });
  window.__TAURI__.event.listen('tauri://drag-drop', function(ev) {
    $dropOverlay.classList.remove('active');
    var paths = (ev.payload && ev.payload.paths) || [];
    if (paths.length === 0) return;
    var fp = String(paths[0]).replace(/\\/g, '/');
    var dir = fp.substring(0, fp.lastIndexOf('/'));
    var name = fp.substring(fp.lastIndexOf('/') + 1);
    dropOpenFile(fp, dir, name);
  });
}

document.addEventListener('dragenter', function(e) {
  if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.indexOf('Files') !== -1) {
    e.preventDefault();
    _dragDepth++;
    $dropOverlay.classList.add('active');
  }
});

document.addEventListener('dragleave', function(e) {
  _dragDepth--;
  if (_dragDepth <= 0) { _dragDepth = 0; $dropOverlay.classList.remove('active'); }
});

document.addEventListener('dragover', function(e) {
  if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.indexOf('Files') !== -1) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
});

document.addEventListener('drop', function(e) {
  e.preventDefault();
  _dragDepth = 0;
  $dropOverlay.classList.remove('active');

  // 1차 시도: text/uri-list (파일 경로 추출 → 사이드바 이동 가능)
  var uriList = e.dataTransfer.getData('text/uri-list');
  if (uriList && uriList.trim()) {
    var lines = uriList.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var uri = lines[i].trim().replace('\r', '');
      if (!uri || uri.charAt(0) === '#') continue;
      var fp = parseFileUri(uri);
      if (!fp) continue;
      var dir = fp.substring(0, fp.lastIndexOf('/'));
      var name = fp.substring(fp.lastIndexOf('/') + 1);
      dropOpenFile(fp, dir, name);
      return;
    }
  }

  // 2차 폴백: FileReader (경로 불명 → 파일 내용만 읽기, 사이드바 이동 없음)
  var files = e.dataTransfer.files;
  if (files && files.length > 0) {
    dropReadFile(files[0]);
  }
});

function dropReadFile(file) {
  var ext = file.name.split('.').pop().toLowerCase();
  var textExts = ['md','txt','js','ts','jsx','tsx','json','yaml','yml','py','sh','bash',
    'css','html','htm','go','rs','java','c','cpp','h','sql','toml','ini','cfg','env','xml','svg'];
  if (textExts.indexOf(ext) === -1) {
    alert('지원되지 않는 파일 형식입니다: .' + ext);
    return;
  }
  var reader = new FileReader();
  reader.onload = function(ev) {
    var virtualPath = '__dropped__/' + file.name;
    openFile(virtualPath, file.name, ev.target.result);
  };
  reader.readAsText(file, 'utf-8');
}

function parseFileUri(uri) {
  if (uri.indexOf('file:///') !== 0) return null;
  var decoded = decodeURIComponent(uri.slice(8));
  if (decoded.charAt(1) !== ':') decoded = '/' + decoded; // Unix: prepend /
  return decoded.replace(/\\/g, '/');
}

function dropOpenFile(filePath, dir, name) {
  if (dir === state.rootDir || filePath.indexOf(state.rootDir + '/') === 0) {
    navigateTo(dir, function() { openFile(filePath, name); });
  } else {
    apiChroot(dir, function(data) {
      if (data.error) return;
      state.rootDir = data.root;
      navigateTo('', function() { openFile(filePath, name); });
    });
  }
}

