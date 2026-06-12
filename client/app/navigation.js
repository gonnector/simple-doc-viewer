// --- Navigation ---
function navigateTo(dirPath, onDone) {
  $search.value = '';
  state.searchQuery = '';
  apiList(dirPath, function(data) {
    if (data.error) {
      // Access denied — try chroot to expand ROOT_DIR
      apiChroot(dirPath, function(cr) {
        if (cr && cr.root) {
          apiList(dirPath, function(data2) {
            if (data2.error) return;
            state.currentPath = data2.path;
            state.parentPath = data2.parent;
            state.items = data2.items;
            $pathBadge.textContent = data2.path;
            $pathBadge.title = data2.path;
            renderTree();
            if (onDone) onDone();
          });
        }
      });
      return;
    }
    state.currentPath = data.path;
    state.parentPath = data.parent;
    state.items = data.items;
    $pathBadge.textContent = data.path;
    $pathBadge.title = data.path;
    renderTree();
    if (onDone) onDone();
  });
}

