// --- Settings ---
// --- Split view scroll sync ---
function setupSplitSync() {
  var srcPanel = $content.querySelector('.md-source-panel');
  var renPanel = $content.querySelector('.md-render-panel');
  if (!srcPanel || !renPanel) return;
  var syncing = false;
  srcPanel.addEventListener('scroll', function() {
    if (syncing) return;
    syncing = true;
    var srcMax = srcPanel.scrollHeight - srcPanel.clientHeight;
    var ratio = srcMax > 0 ? srcPanel.scrollTop / srcMax : 0;
    renPanel.scrollTop = ratio * (renPanel.scrollHeight - renPanel.clientHeight);
    syncing = false;
  });
  renPanel.addEventListener('scroll', function() {
    if (syncing) return;
    syncing = true;
    var renMax = renPanel.scrollHeight - renPanel.clientHeight;
    var ratio = renMax > 0 ? renPanel.scrollTop / renMax : 0;
    srcPanel.scrollTop = ratio * (srcPanel.scrollHeight - srcPanel.clientHeight);
    syncing = false;
  });
}

var viewModes = ['preview', 'split', 'source'];
var viewModeLabels = { preview: 'Preview', split: 'Split', source: 'Source' };

function cycleViewMode() {
  var idx = viewModes.indexOf(state.viewMode);
  state.viewMode = viewModes[(idx + 1) % 3];
  $btnSource.textContent = viewModeLabels[state.viewMode];
  $btnSource.classList.toggle('active', state.viewMode !== 'preview');
  if (state.activeTab) {
    var tab = state.tabCache[state.activeTab];
    if (tab && tab.data && (tab.data.ext === 'md' || tab.data.ext === 'html' || tab.data.ext === 'htm')) {
      renderContent(true);
    }
  }
}

$btnSource.addEventListener('click', cycleViewMode);

var _savedSidebarWidth = null;
function toggleSidebar() {
  var willCollapse = !$sidebar.classList.contains('collapsed');
  if (willCollapse) {
    _savedSidebarWidth = $sidebar.style.width || null;
    $sidebar.style.width = '';
    $sidebar.style.minWidth = '';
  }
  var collapsed = $sidebar.classList.toggle('collapsed');
  $btnSidebar.classList.toggle('collapsed', collapsed);
  if (!collapsed && _savedSidebarWidth) {
    $sidebar.style.width = _savedSidebarWidth;
    $sidebar.style.minWidth = _savedSidebarWidth;
  }
}

$btnSidebar.addEventListener('click', toggleSidebar);

// --- Path badge click → editable input ---
$pathBadge.addEventListener('click', function() {
  var current = $pathBadge.textContent;
  var input = document.createElement('input');
  input.className = 'path-input';
  input.value = current;
  $pathBadge.style.display = 'none';
  $pathBadge.parentNode.insertBefore(input, $pathBadge.nextSibling);
  input.focus();
  input.select();

  function finish() {
    if (input.parentNode) input.parentNode.removeChild(input);
    $pathBadge.style.display = '';
  }

  function go() {
    var val = input.value.trim().replace(/\\/g, '/');
    // MSYS2 path → Windows path: /e/project → E:/project
    var msysMatch = val.match(/^\/([a-zA-Z])\//);
    if (msysMatch) {
      val = msysMatch[1].toUpperCase() + ':/' + val.substring(3);
    }
    if (!val) { finish(); return; }
    finish();
    // Chroot first, then try as directory
    apiChroot(val, function(resp) {
      if (resp && resp.root) {
        // It is a directory — chroot succeeded, navigate
        navigateTo(val);
      } else {
        // Not a directory — try as file (chroot to parent)
        var parts = val.split('/');
        var fileName = parts.pop();
        var dirPath = parts.join('/');
        apiChroot(dirPath, function(resp2) {
          if (resp2 && resp2.root) {
            navigateTo(dirPath, function() {
              openFile(val, fileName);
            });
          } else {
            alert('Path not found: ' + val);
          }
        });
      }
    });
  }

  input.addEventListener('keydown', function(ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); go(); }
    if (ev.key === 'Escape') { ev.preventDefault(); finish(); }
    ev.stopPropagation();
  });
  input.addEventListener('blur', function() {
    setTimeout(finish, 150);
  });
});

// --- Folder Picker ---
document.getElementById('btn-pick-folder').addEventListener('click', function() {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/pick-folder');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.timeout = 600000;
  xhr.onload = function() {
    var resp = JSON.parse(xhr.responseText);
    if (resp.root) navigateTo(resp.root);
  };
  xhr.send('{}');
});

$btnTheme.addEventListener('click', function() {
  state.lightMode = !state.lightMode;
  document.body.classList.toggle('light-mode', state.lightMode);
  if (mermaidLoaded && window.mermaid) {
    window.mermaid.initialize({ startOnLoad: false, theme: state.lightMode ? 'default' : 'dark' });
  }
  renderContent(true);
});

$btnHidden.addEventListener('click', function() {
  state.showHidden = !state.showHidden;
  $btnHidden.classList.toggle('active', state.showHidden);
  renderTree();
});

