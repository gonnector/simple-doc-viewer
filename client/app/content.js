// --- Content rendering ---
function renderContent(preserveScroll) {
  if (!state.activeTab) {
    showWelcome();
    return;
  }
  var tab = state.tabCache[state.activeTab];
  if (!tab) { showWelcome(); return; }
  if (tab.loading) {
    $content.innerHTML = '<div class="loading">Loading...</div>';
    return;
  }
  var data = tab.data;
  if (!data) { showWelcome(); return; }

  // Media files — render directly without text content
  if (isMediaExt(tab.ext)) {
    var mediaSrc = '/api/media?path=' + encodeURIComponent(state.activeTab);
    var showZoom = !!(MEDIA_IMG[tab.ext] || MEDIA_VID[tab.ext]) && !MEDIA_DOC[tab.ext];
    var mediaHtml = '<div class="media-viewer' + (MEDIA_DOC[tab.ext] ? ' pdf-mode' : '') + '">';
    mediaHtml += '<div class="media-content">';
    if (MEDIA_IMG[tab.ext]) {
      mediaHtml += '<img id="media-target" src="' + mediaSrc + '" alt="' + escHtml(tab.name) + '">';
    } else if (MEDIA_VID[tab.ext]) {
      mediaHtml += '<video id="media-target" src="' + mediaSrc + '" controls preload="metadata"></video>';
    } else if (MEDIA_AUD[tab.ext]) {
      mediaHtml += '<audio src="' + mediaSrc + '" controls preload="metadata"></audio>';
    } else if (MEDIA_DOC[tab.ext]) {
      mediaHtml += '<iframe class="pdf-frame" src="' + mediaSrc + '"></iframe>';
    }
    mediaHtml += '</div>';
    if (showZoom) {
      mediaHtml += '<div class="media-zoom-bar">'
        + '<button id="zoom-out" title="Zoom out">&#8722;</button>'
        + '<input type="range" id="zoom-slider" min="10" max="400" value="100" step="10">'
        + '<button id="zoom-in" title="Zoom in">&#43;</button>'
        + '<span class="zoom-pct" id="zoom-pct">100%</span>'
        + '<button id="zoom-fit" title="Fit to window">Fit</button>'
        + '<button id="zoom-reset" title="Original size (100%)">1:1</button>'
        + '</div>';
    }
    // filename already visible in sidebar + tab
    mediaHtml += '</div>';
    $content.innerHTML = mediaHtml;
    $statusBar.classList.add('empty');
    return;
  }

  if (data.error) {
    $content.innerHTML = '<div class="error-display">'
      + '<div class="icon-large">&#128683;</div>'
      + '<h2>' + escHtml(data.name || 'Error') + '</h2>'
      + '<p>' + escHtml(data.error) + '</p>'
      + '</div>';
    return;
  }

  docLines = data.content.split('\n').length;

  var savedRatio = 0;
  if (preserveScroll) {
    var prevRenPanel = $content.querySelector('.md-render-panel');
    if (prevRenPanel && prevRenPanel.scrollHeight > 0) {
      savedRatio = prevRenPanel.scrollTop / prevRenPanel.scrollHeight;
    } else if ($content.scrollHeight > 0) {
      savedRatio = $content.scrollTop / $content.scrollHeight;
    }
  }

  if (data.ext === 'md') {
    var _filePath = state.activeTab || '';
    var _lastSlash = _filePath.lastIndexOf('/');
    md.setBase(_lastSlash >= 0 ? _filePath.substring(0, _lastSlash) : '');
    if (state.viewMode === 'split') {
      $content.innerHTML = '<div class="md-split">'
        + '<div class="md-source-panel">'
        + '<div class="raw-view' + (state.wordWrap ? ' word-wrap' : '') + '">'
        + renderRaw(data.content, 'md')
        + '</div></div>'
        + '<div class="md-render-panel">'
        + '<div class="md-rendered">' + md.parse(data.content) + '</div>'
        + '</div></div>';
      if (!preserveScroll) $content.scrollTop = 0;
      setupSplitSync();
    } else if (state.viewMode === 'source') {
      $content.innerHTML = '<div class="raw-view' + (state.wordWrap ? ' word-wrap' : '') + '">' + renderRaw(data.content, 'md') + '</div>';
      if (!preserveScroll) $content.scrollTop = 0;
    } else {
      $content.innerHTML = '<div class="md-rendered">' + md.parse(data.content) + '</div>';
      if (!preserveScroll) $content.scrollTop = 0;
    }
    renderMermaidBlocks();
  } else if (data.ext === 'html' || data.ext === 'htm') {
    if (state.viewMode === 'split') {
      $content.innerHTML = '<div class="md-split">'
        + '<div class="md-source-panel">'
        + '<div class="raw-view' + (state.wordWrap ? ' word-wrap' : '') + '">'
        + renderRaw(data.content, data.ext)
        + '</div></div>'
        + '<div class="md-render-panel" style="padding:0">'
        + '<iframe id="html-preview" sandbox="allow-scripts" style="width:100%;height:100%;border:none;background:#fff"></iframe>'
        + '</div></div>';
      setupSplitSync();
    } else if (state.viewMode === 'source') {
      $content.innerHTML = '<div class="raw-view' + (state.wordWrap ? ' word-wrap' : '') + '">' + renderRaw(data.content, data.ext) + '</div>';
    } else {
      $content.innerHTML = '<iframe id="html-preview" sandbox="allow-scripts" style="width:100%;height:100%;border:none;background:#fff"></iframe>';
    }
    var hf = document.getElementById('html-preview');
    if (hf) {
      // sandbox iframe은 same-origin이 아니므로 contentDocument 접근 불가 — srcdoc으로 주입.
      // allow-scripts만 부여 (allow-same-origin 없음) = opaque origin에서 스크립트 실행:
      // JS 렌더링 HTML(번들 보고서 등)은 정상 동작하되, SDV API 호출은 Origin: null이라 서버 게이트가 403
      hf.setAttribute('srcdoc', data.content);
    }
    if (!preserveScroll) $content.scrollTop = 0;
  } else {
    $content.innerHTML = '<div class="raw-view' + (state.wordWrap ? ' word-wrap' : '') + '">' + renderRaw(data.content, data.ext) + '</div>';
    if (!preserveScroll) $content.scrollTop = 0;
  }

  if (preserveScroll) {
    var newRenPanel = $content.querySelector('.md-render-panel');
    var newSrcPanel = $content.querySelector('.md-source-panel');
    if (newRenPanel) {
      newRenPanel.scrollTop = savedRatio * newRenPanel.scrollHeight;
      if (newSrcPanel) newSrcPanel.scrollTop = savedRatio * newSrcPanel.scrollHeight;
    } else {
      $content.scrollTop = savedRatio * $content.scrollHeight;
    }
  }

  updateStatusBar();
}

function showWelcome() {
  docLines = 0;
  $statusBar.classList.add('empty');
  $content.innerHTML = '<div class="welcome">'
    + '<div class="icon-large">&#128196;</div>'
    + '<h2>SDV - Simple Doc Viewer</h2>'
    + '<p>Documents, code, images, video, audio, PDF</p>'
    + '<div class="keys">'
    + '<kbd>.md</kbd><kbd>.js</kbd><kbd>.py</kbd><kbd>.html</kbd><kbd>.json</kbd><kbd>.yaml</kbd><kbd>.sql</kbd><kbd>.css</kbd>'
    + '<kbd>.png</kbd><kbd>.jpg</kbd><kbd>.gif</kbd><kbd>.svg</kbd><kbd>.mp4</kbd><kbd>.mp3</kbd><kbd>.pdf</kbd><kbd>+72</kbd>'
    + '</div></div>';
}

