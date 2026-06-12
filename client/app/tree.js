// --- File Tree ---
function sortItems(items) {
  var sorted = items.slice();
  var key = state.sortBy;
  var asc = state.sortAsc;
  sorted.sort(function(a, b) {
    // Dirs always first
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    var va, vb;
    if (key === 'name') {
      va = a.name.toLowerCase();
      vb = b.name.toLowerCase();
      var cmp = va.localeCompare(vb);
      return asc ? cmp : -cmp;
    } else if (key === 'size') {
      va = a.size || 0;
      vb = b.size || 0;
      return asc ? va - vb : vb - va;
    } else if (key === 'modified') {
      va = a.modified || '';
      vb = b.modified || '';
      var cmp2 = va.localeCompare(vb);
      return asc ? cmp2 : -cmp2;
    } else if (key === 'created') {
      va = a.created || '';
      vb = b.created || '';
      var cmp3 = va.localeCompare(vb);
      return asc ? cmp3 : -cmp3;
    } else if (key === 'matchCount') {
      va = a.matchCount || 0;
      vb = b.matchCount || 0;
      return asc ? va - vb : vb - va;
    }
    return 0;
  });
  return sorted;
}

