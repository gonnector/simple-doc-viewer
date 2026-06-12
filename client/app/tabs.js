// --- Tabs ---
var MEDIA_IMG = { png:1, jpg:1, jpeg:1, gif:1, svg:1, webp:1, bmp:1, ico:1, tiff:1, tif:1, avif:1 };
var MEDIA_VID = { mp4:1, webm:1, ogg:1, mov:1, avi:1, mkv:1 };
var MEDIA_AUD = { mp3:1, wav:1, flac:1, aac:1, opus:1, wma:1, m4a:1 };
var MEDIA_DOC = { pdf:1 };

function isMediaExt(ext) { return !!(MEDIA_IMG[ext] || MEDIA_VID[ext] || MEDIA_AUD[ext] || MEDIA_DOC[ext]); }

function openFile(filePath, fileName, directContent) {
  // Already open?
  if (state.openTabs.indexOf(filePath) !== -1) {
    // Drag-drop with new content: update cache so same-named files show new content
    if (directContent !== undefined) {
      var ext2 = getExt(fileName);
      state.tabCache[filePath] = { name: fileName, ext: ext2, data: { path: filePath, name: fileName, ext: ext2, content: directContent, size: directContent.length }, loading: false };
    }
    activateTab(filePath);
    return;
  }

  // Add tab
  state.openTabs.push(filePath);
  var ext = getExt(fileName);

  // Direct content (drag-drop FileReader) — no server fetch needed
  if (directContent !== undefined) {
    state.tabCache[filePath] = { name: fileName, ext: ext, data: { path: filePath, name: fileName, ext: ext, content: directContent, size: directContent.length }, loading: false };
    activateTab(filePath);
    return;
  }

  // Media files — no text fetch needed
  if (isMediaExt(ext)) {
    state.tabCache[filePath] = { name: fileName, ext: ext, data: { path: filePath, name: fileName, ext: ext }, loading: false };
    activateTab(filePath);
    return;
  }

  // Fetch file from server
  state.tabCache[filePath] = { name: fileName, ext: ext, data: null, loading: true };
  activateTab(filePath);
  apiRead(filePath, function(data) {
    state.tabCache[filePath].data = data;
    state.tabCache[filePath].loading = false;
    if (state.activeTab === filePath) renderContent();
  });
}

function activateTab(filePath) {
  state.activeTab = filePath;
  renderTabs();
  renderContent();

  // 좌측 트리: 활성 파일의 parent 디렉토리로 자동 전환
  // 가상 파일(__dropped__/ 등) 또는 이미 올바른 폴더면 스킵
  if (filePath && filePath.indexOf('__dropped__/') !== 0) {
    var parentDir = filePath.replace(/\/[^/]+$/, '');
    if (!parentDir) parentDir = '/';
    if (parentDir !== state.currentPath) {
      var inRoot = state.rootDir && (parentDir === state.rootDir || parentDir.indexOf(state.rootDir + '/') === 0);
      if (inRoot) {
        navigateTo(parentDir, function() { renderTree(); });
        return;
      } else {
        // rootDir 밖 — chroot 후 이동
        apiChroot(parentDir, function(data) {
          if (data && !data.error && data.root) {
            state.rootDir = data.root;
            navigateTo(parentDir, function() { renderTree(); });
          } else {
            renderTree();
          }
        });
        return;
      }
    }
  }
  renderTree(); // 같은 폴더면 하이라이트만
}

function closeTab(filePath, evt) {
  if (evt) { evt.stopPropagation(); evt.preventDefault(); }
  var idx = state.openTabs.indexOf(filePath);
  if (idx === -1) return;
  state.openTabs.splice(idx, 1);
  delete state.tabCache[filePath];

  if (state.activeTab === filePath) {
    if (state.openTabs.length > 0) {
      // Activate adjacent tab
      var newIdx = Math.min(idx, state.openTabs.length - 1);
      state.activeTab = state.openTabs[newIdx];
    } else {
      state.activeTab = null;
    }
  }
  renderTabs();
  renderContent();
  renderTree();
}

function renderTabs() {
  if (state.openTabs.length === 0) {
    $tabs.innerHTML = '';
    updateCloseAllBtn();
    return;
  }
  var html = '';
  for (var i = 0; i < state.openTabs.length; i++) {
    var p = state.openTabs[i];
    var tab = state.tabCache[p];
    var name = tab ? tab.name : p.split('/').pop();
    var isActive = p === state.activeTab;
    var isSel = !!state.selectedTabs[p];
    html += '<div class="tab' + (isActive ? ' active' : '') + (isSel ? ' multi-selected' : '') + '" data-path="' + escHtml(p) + '">'
      + '<span>' + escHtml(name) + '</span>'
      + '<span class="tab-close" data-close="' + escHtml(p) + '">&#10005;</span>'
      + '</div>';
  }
  $tabs.innerHTML = html;
  updateCloseAllBtn();
}

function updateCloseAllBtn() {
  var btn = document.getElementById('btn-close-all');
  if (!btn) return;
  if (state.openTabs.length <= 1) { btn.style.display = 'none'; btn.classList.remove('has-selection'); return; }
  var selCount = Object.keys(state.selectedTabs).length;
  btn.style.display = '';
  if (selCount > 0) {
    btn.textContent = 'Close ' + selCount + ' selected';
    btn.title = 'Close selected tabs';
    btn.classList.add('has-selection');
  } else {
    btn.textContent = 'Close all';
    btn.title = 'Close all tabs';
    btn.classList.remove('has-selection');
  }
}

function doCloseAllOrSelected() {
  if (state.openTabs.length === 0) return;
  var selKeys = Object.keys(state.selectedTabs);
  var toClose = selKeys.length > 0 ? selKeys : state.openTabs.slice();
  for (var ci = 0; ci < toClose.length; ci++) {
    var idx = state.openTabs.indexOf(toClose[ci]);
    if (idx !== -1) { state.openTabs.splice(idx, 1); delete state.tabCache[toClose[ci]]; }
  }
  state.selectedTabs = {};
  state.activeTab = state.openTabs.length > 0 ? state.openTabs[state.openTabs.length - 1] : null;
  renderTabs(); renderContent(); renderTree();
}

// Close-all button (header-right)
document.getElementById('btn-close-all').addEventListener('click', doCloseAllOrSelected);

// Tab click handler (event delegation)
$tabs.addEventListener('click', function(e) {
  var closeEl = e.target.closest('[data-close]');
  if (closeEl) {
    var cp = closeEl.dataset.close;
    // If closing a selected tab, close all selected
    if (state.selectedTabs[cp] && Object.keys(state.selectedTabs).length > 1) {
      var selKeys2 = Object.keys(state.selectedTabs);
      for (var ci2 = 0; ci2 < selKeys2.length; ci2++) {
        var idx2 = state.openTabs.indexOf(selKeys2[ci2]);
        if (idx2 !== -1) { state.openTabs.splice(idx2, 1); delete state.tabCache[selKeys2[ci2]]; }
      }
      state.selectedTabs = {};
      state.activeTab = state.openTabs.length > 0 ? state.openTabs[state.openTabs.length - 1] : null;
      renderTabs(); renderContent(); renderTree();
    } else {
      closeTab(cp, e);
    }
    return;
  }
  var tabEl = e.target.closest('.tab');
  if (tabEl) {
    var tp = tabEl.dataset.path;
    // Ctrl/Cmd + click → multi-select toggle
    if (e.ctrlKey || e.metaKey) {
      if (state.selectedTabs[tp]) { delete state.selectedTabs[tp]; }
      else { state.selectedTabs[tp] = true; }
      renderTabs();
      return;
    }
    state.selectedTabs = {};
    activateTab(tp);
  }
});

