// --- Keyboard shortcuts ---
document.addEventListener('keydown', function(e) {
  // Ctrl+W or Cmd+W to close active tab
  if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
    e.preventDefault();
    if (state.activeTab) closeTab(state.activeTab);
  }
  // Ctrl+F or Cmd+F to open in-document find
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    openFind();
  }
  // Escape to clear search
  if (e.key === 'Escape') {
    if ($helpOverlay.classList.contains('visible')) { closeHelp(); return; }
    $search.value = '';
    state.searchQuery = '';
    _searchResults = null;
    $search.blur();
    renderTree();
  }
  var notTyping = !e.ctrlKey && !e.metaKey && document.activeElement !== $search;
  if (notTyping) {
    if (e.key === 'b') toggleSidebar();
    if (e.key === 't') $btnTheme.click();
    if (e.key === 's') cycleViewMode();
    if (e.key === 'w') $btnWrap.click();
    if (e.key === 'p') document.getElementById('btn-pdf').click();
    if (e.key === 'r') reloadActiveDoc();
    if (e.key === 'F2') {
      var sel = $tree.querySelector('.tree-item.selected');
      if (sel && !sel.classList.contains('parent-dir')) {
        startRename(sel, sel.dataset.path, sel.dataset.name);
      }
    }
    if (e.key === 'Delete') {
      var sel2 = $tree.querySelector('.tree-item.selected');
      if (sel2 && !sel2.classList.contains('parent-dir')) {
        doDelete(sel2.dataset.path, sel2.dataset.name);
      }
    }
    if (e.key === '?') {
      if ($helpOverlay.classList.contains('visible')) closeHelp();
      else openHelp();
    }
  }
});

