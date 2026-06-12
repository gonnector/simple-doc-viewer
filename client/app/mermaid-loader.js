// --- Mermaid ---
// Lazy load: 2.9MB 라이브러리를 부팅 시가 아니라 mermaid 블록을 처음 만났을 때 로드
var mermaidLoaded = false;
var mermaidLoading = false;

function initMermaid() {
  if (mermaidLoaded || mermaidLoading) return;
  mermaidLoading = true;
  var script = document.createElement('script');
  script.src = '/lib/mermaid.min.js';
  script.onload = function() {
    mermaidLoaded = true;
    mermaidLoading = false;
    if (window.mermaid) {
      window.mermaid.initialize({ startOnLoad: false, theme: state.lightMode ? 'default' : 'dark' });
    }
    renderMermaidBlocks();
  };
  script.onerror = function() {
    // Mermaid not available - graceful degradation
    mermaidLoading = false;
  };
  document.head.appendChild(script);
}

function renderMermaidBlocks() {
  var pending = $content.querySelectorAll('pre[data-lang="mermaid"]');
  if (!mermaidLoaded) {
    // 문서에 mermaid 블록이 있을 때만 라이브러리 로드 시작 (로드 완료 시 재호출됨)
    if (pending.length > 0) initMermaid();
    return;
  }
  if (!window.mermaid) return;
  var blocks = pending;
  if (blocks.length === 0) return;
  for (var b = 0; b < blocks.length; b++) {
    var pre = blocks[b];
    var codeEl = pre.querySelector('code');
    if (!codeEl) continue;
    var div = document.createElement('div');
    div.className = 'mermaid';
    div.textContent = codeEl.textContent;
    pre.parentNode.replaceChild(div, pre);
  }
  try { window.mermaid.run(); } catch(e) { /* ignore */ }
}

