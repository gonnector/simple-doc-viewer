// --- Media zoom bar ---
(function() {
  function applyZoom(pct) {
    var target = document.getElementById('media-target');
    if (!target) return;
    var scale = pct / 100;
    target.style.transform = 'scale(' + scale + ')';
    target.style.maxWidth = pct > 100 ? 'none' : '100%';
    target.style.maxHeight = pct > 100 ? 'none' : '';
    var pctEl = document.getElementById('zoom-pct');
    var slider = document.getElementById('zoom-slider');
    if (pctEl) pctEl.textContent = pct + '%';
    if (slider) slider.value = pct;
  }
  $content.addEventListener('click', function(e) {
    var id = e.target.id;
    if (id === 'zoom-in') {
      var s = parseInt(document.getElementById('zoom-slider').value);
      applyZoom(Math.min(400, s + 25));
    } else if (id === 'zoom-out') {
      var s2 = parseInt(document.getElementById('zoom-slider').value);
      applyZoom(Math.max(10, s2 - 25));
    } else if (id === 'zoom-reset') {
      applyZoom(100);
    } else if (id === 'zoom-fit') {
      var target = document.getElementById('media-target');
      if (!target) return;
      var container = target.parentElement;
      // Reset first to get natural dimensions
      target.style.transform = 'scale(1)';
      target.style.maxWidth = 'none';
      target.style.maxHeight = 'none';
      var nw = target.naturalWidth || target.videoWidth || target.offsetWidth;
      var nh = target.naturalHeight || target.videoHeight || target.offsetHeight;
      var cw = container.clientWidth - 32;
      var ch = container.clientHeight - 32;
      if (nw > 0 && nh > 0) {
        var fitPct = Math.round(Math.min(cw / nw, ch / nh) * 100);
        applyZoom(fitPct);
      } else {
        applyZoom(100);
      }
    }
  });
  $content.addEventListener('input', function(e) {
    if (e.target.id === 'zoom-slider') {
      applyZoom(parseInt(e.target.value));
    }
  });
})();

