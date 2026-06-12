// --- Mermaid ---
var mermaidLoaded = false;

function initMermaid() {
  var script = document.createElement('script');
  script.src = '/lib/mermaid.min.js';
  script.onload = function() {
    mermaidLoaded = true;
    if (window.mermaid) {
      window.mermaid.initialize({ startOnLoad: false, theme: state.lightMode ? 'default' : 'dark' });
    }
    renderMermaidBlocks();
  };
  script.onerror = function() {
    // Mermaid not available - graceful degradation
  };
  document.head.appendChild(script);
}

function renderMermaidBlocks() {
  if (!mermaidLoaded || !window.mermaid) return;
  var blocks = $content.querySelectorAll('pre[data-lang="mermaid"]');
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

