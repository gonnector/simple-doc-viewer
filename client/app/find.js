// --- In-document Find ---
var $findBar = document.getElementById('find-bar');
var $findInput = document.getElementById('find-input');
var $findInfo = document.getElementById('find-info');
var _findMatches = [];
var _findCurrent = -1;
var _findWholeWord = false;

function clearFindHighlights() {
  var marks = $content.querySelectorAll('.find-match, .find-match-current');
  for (var i = 0; i < marks.length; i++) {
    var parent = marks[i].parentNode;
    parent.replaceChild(document.createTextNode(marks[i].textContent), marks[i]);
    parent.normalize();
  }
  _findMatches = [];
  _findCurrent = -1;
  $findInfo.textContent = '';
}

function doFind() {
  clearFindHighlights();
  var query = $findInput.value;
  if (!query) return;

  var lowerQ = query.toLowerCase();
  // Determine search scope based on view mode
  var searchRoot = $content.querySelector('.md-rendered') || $content.querySelector('.md-render-panel') || $content.querySelector('.raw-view') || $content;
  var walker = document.createTreeWalker(searchRoot, NodeFilter.SHOW_TEXT, {
    acceptNode: function(n) {
      // Skip SVG, mermaid diagrams, find-bar, style/script elements
      var p = n.parentElement;
      while (p && p !== searchRoot) {
        var tag = p.tagName;
        if (tag === 'SVG' || tag === 'svg' || tag === 'STYLE' || tag === 'SCRIPT') return NodeFilter.FILTER_REJECT;
        if (p.classList && (p.classList.contains('mermaid') || p.classList.contains('find-bar'))) return NodeFilter.FILTER_REJECT;
        p = p.parentElement;
      }
      return n.nodeValue.trim().length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  var textNodes = [];
  var node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }

  for (var ti = 0; ti < textNodes.length; ti++) {
    var tNode = textNodes[ti];
    var text = tNode.nodeValue;
    var lower = text.toLowerCase();
    var fragments = [];
    var lastIdx = 0;

    var searchPos = 0;
    while (searchPos <= lower.length - lowerQ.length) {
      var idx = lower.indexOf(lowerQ, searchPos);
      if (idx === -1) break;

      // Whole word check
      if (_findWholeWord) {
        var before = idx > 0 ? lower.charAt(idx - 1) : ' ';
        var after = idx + lowerQ.length < lower.length ? lower.charAt(idx + lowerQ.length) : ' ';
        var wordBound = /[\s.,;:!?()\[\]{}\-\/'"<>]/.test(before) || /^[\u3000-\u9fff\uac00-\ud7af]/.test(text.charAt(idx));
        var wordBoundEnd = /[\s.,;:!?()\[\]{}\-\/'"<>]/.test(after) || (idx + lowerQ.length < text.length && /^[\u3000-\u9fff\uac00-\ud7af]/.test(text.charAt(idx + lowerQ.length)));
        if (!wordBound || !wordBoundEnd) {
          searchPos = idx + 1;
          continue;
        }
      }

      if (idx > lastIdx) {
        fragments.push(document.createTextNode(text.substring(lastIdx, idx)));
      }
      var span = document.createElement('span');
      span.className = 'find-match';
      span.textContent = text.substring(idx, idx + lowerQ.length);
      fragments.push(span);
      _findMatches.push(span);
      lastIdx = idx + lowerQ.length;
      searchPos = lastIdx;
    }

    if (fragments.length > 0) {
      if (lastIdx < text.length) {
        fragments.push(document.createTextNode(text.substring(lastIdx)));
      }
      var parent = tNode.parentNode;
      for (var fi = 0; fi < fragments.length; fi++) {
        parent.insertBefore(fragments[fi], tNode);
      }
      parent.removeChild(tNode);
    }
  }

  if (_findMatches.length > 0) {
    _findCurrent = 0;
    goToFindMatch();
  }
  updateFindInfo();
}

function goToFindMatch() {
  // Clear previous current
  var prev = $content.querySelector('.find-match-current');
  if (prev) prev.className = 'find-match';
  if (_findCurrent >= 0 && _findCurrent < _findMatches.length) {
    _findMatches[_findCurrent].className = 'find-match-current';
    // Scroll within content-body (not window)
    var el = _findMatches[_findCurrent];
    var container = $content;
    var elRect = el.getBoundingClientRect();
    var contRect = container.getBoundingClientRect();
    var scrollTarget = container.scrollTop + (elRect.top - contRect.top) - (contRect.height / 2);
    container.scrollTo({ top: scrollTarget, behavior: 'smooth' });
  }
  updateFindInfo();
}

function updateFindInfo() {
  if (_findMatches.length === 0) {
    $findInfo.textContent = $findInput.value ? 'No matches' : '';
  } else {
    $findInfo.textContent = (_findCurrent + 1) + '/' + _findMatches.length;
  }
}

function findNext() {
  if (_findMatches.length === 0) return;
  _findCurrent = (_findCurrent + 1) % _findMatches.length;
  goToFindMatch();
}

function findPrev() {
  if (_findMatches.length === 0) return;
  _findCurrent = (_findCurrent - 1 + _findMatches.length) % _findMatches.length;
  goToFindMatch();
}

function openFind() {
  $findBar.classList.add('visible');
  $findInput.focus();
  $findInput.select();
}

function closeFind() {
  $findBar.classList.remove('visible');
  clearFindHighlights();
}

// 키스트로크마다 전체 DOM 하이라이트 재작성 방지 — 200ms debounce (사이드바 검색과 동일 패턴)
var _findDebounce = null;
$findInput.addEventListener('input', function() {
  clearTimeout(_findDebounce);
  _findDebounce = setTimeout(doFind, 200);
});

document.getElementById('btn-find').addEventListener('click', openFind);

// Reload active document only (F5는 앱 전체 초기화이지만 이 버튼은 현재 탭만 재로드)
function reloadActiveDoc() {
  if (!state.activeTab) return;
  var filePath = state.activeTab;
  // 가상 파일(드래그-드롭 등)은 재로드 불가
  if (filePath.indexOf('__dropped__/') === 0) return;

  var tab = state.tabCache[filePath];
  if (!tab) return;

  var btn = document.getElementById('btn-reload');
  if (btn) { btn.style.opacity = '0.5'; btn.disabled = true; }

  tab.loading = true;
  renderContent();

  apiRead(filePath, function(data) {
    tab.data = data;
    tab.loading = false;
    if (state.activeTab === filePath) renderContent();
    if (btn) { btn.style.opacity = ''; btn.disabled = false; }
  });
}

document.getElementById('btn-reload').addEventListener('click', reloadActiveDoc);
document.getElementById('find-next').addEventListener('click', findNext);
document.getElementById('find-prev').addEventListener('click', findPrev);
document.getElementById('find-close').addEventListener('click', closeFind);
document.getElementById('find-whole').addEventListener('click', function() {
  _findWholeWord = !_findWholeWord;
  this.classList.toggle('active', _findWholeWord);
  doFind();
});

$findInput.addEventListener('keydown', function(ev) {
  if (ev.key === 'Enter') {
    ev.preventDefault();
    if (ev.shiftKey) findPrev(); else findNext();
  }
  if (ev.key === 'Escape') {
    ev.preventDefault();
    closeFind();
  }
  ev.stopPropagation();
});

function openHelp() { $helpOverlay.classList.add('visible'); }
function closeHelp() { $helpOverlay.classList.remove('visible'); }
$btnHelp.addEventListener('click', openHelp);
document.getElementById('help-close').addEventListener('click', closeHelp);
$helpOverlay.addEventListener('click', function(e) {
  if (e.target === $helpOverlay) closeHelp();
});

$btnWrap.addEventListener('click', function() {
  state.wordWrap = !state.wordWrap;
  $btnWrap.classList.toggle('active', state.wordWrap);
  var rv = $content.querySelector('.raw-view');
  if (rv) {
    if (state.wordWrap) rv.classList.add('word-wrap');
    else rv.classList.remove('word-wrap');
  }
});

