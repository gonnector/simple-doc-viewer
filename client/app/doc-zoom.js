// --- Document zoom (텍스트 뷰 전용, 미디어/사이드바 제외) ---
(function () {
  var KEY = 'sdv-doc-zoom';
  var MIN = 50, MAX = 300, STEP = 10;
  var level = 100;
  try { var saved = parseInt(localStorage.getItem(KEY), 10); if (saved >= MIN && saved <= MAX) level = saved; } catch (e) {}

  var $toast = null, _t = null;
  function toast() {
    if (!$toast) { $toast = document.createElement('div'); $toast.id = 'doc-zoom-toast'; document.body.appendChild($toast); }
    $toast.textContent = level + '%';
    $toast.classList.add('visible');
    clearTimeout(_t);
    _t = setTimeout(function () { $toast.classList.remove('visible'); }, 900);
  }
  function apply() {
    if ($content) $content.style.setProperty('--doc-zoom', (level / 100).toString());
    try { localStorage.setItem(KEY, String(level)); } catch (e) {}
  }
  function setLevel(v, withToast) {
    var clamped = Math.max(MIN, Math.min(MAX, v));
    if (clamped === level && !withToast) return;
    level = clamped; apply(); if (withToast) toast();
  }
  window.sdvZoomIn = function () { setLevel(level + STEP, true); };
  window.sdvZoomOut = function () { setLevel(level - STEP, true); };
  window.sdvZoomReset = function () { setLevel(100, true); };

  // Ctrl/Cmd + 휠 줌 (줌 대상 위에서만 — 미디어/PDF 위에서는 통과)
  if ($content) {
    $content.addEventListener('wheel', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      var z = e.target && e.target.closest ? e.target.closest('.md-rendered, .raw-view, .csv-table') : null;
      if (!z) return;
      e.preventDefault();
      if (e.deltaY < 0) window.sdvZoomIn(); else window.sdvZoomOut();
    }, { passive: false });
  }
  apply(); // 로드 시 저장된 배율 복원 (토스트 없음)
})();
