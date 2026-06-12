// --- Sort buttons ---
var sortDefaults = { name: true, size: false, modified: false, created: false, matchCount: false };
var sortBtns = document.querySelectorAll('.sort-btn');

function updateSortUI() {
  for (var i = 0; i < sortBtns.length; i++) {
    var btn = sortBtns[i];
    var isActive = btn.dataset.sort === state.sortBy;
    btn.classList.toggle('active', isActive);
    var arrow = btn.querySelector('.sort-arrow');
    if (isActive) {
      arrow.innerHTML = state.sortAsc ? '&#9650;' : '&#9660;';
    } else {
      arrow.innerHTML = '&#9662;';
    }
  }
}

for (var si = 0; si < sortBtns.length; si++) {
  sortBtns[si].addEventListener('click', function() {
    var key = this.dataset.sort;
    if (state.sortBy === key) {
      state.sortAsc = !state.sortAsc;
    } else {
      state.sortBy = key;
      state.sortAsc = sortDefaults[key];
    }
    updateSortUI();
    renderTree();
  });
}

// --- Resize handle ---
(function() {
  var startX, startW, dragging = false;
  $resizeHandle.addEventListener('mousedown', function(e) {
    e.preventDefault();
    if ($sidebar.classList.contains('collapsed')) return;
    dragging = true;
    startX = e.clientX;
    startW = $sidebar.offsetWidth;
    $sidebar.classList.add('resizing');
    $resizeHandle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    var newW = startW + (e.clientX - startX);
    if (newW < 200) newW = 200;
    if (newW > 800) newW = 800;
    $sidebar.style.width = newW + 'px';
    $sidebar.style.minWidth = newW + 'px';
  });
  document.addEventListener('mouseup', function() {
    if (!dragging) return;
    dragging = false;
    $sidebar.classList.remove('resizing');
    $resizeHandle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
})();

