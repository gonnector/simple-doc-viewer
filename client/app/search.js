// --- Search ---
function parseQueryClient(q) {
  var orGroups = q.split(/[,|]/).map(function(g) { return g.trim(); }).filter(Boolean);
  return orGroups.map(function(group) {
    return group.split(/[\s&]+/).map(function(t) { return t.trim().toLowerCase(); }).filter(Boolean);
  });
}

function highlightTerms(text, parsedQ) {
  var terms = [];
  for (var i = 0; i < parsedQ.length; i++) {
    for (var j = 0; j < parsedQ[i].length; j++) {
      if (terms.indexOf(parsedQ[i][j]) === -1) terms.push(parsedQ[i][j]);
    }
  }
  if (terms.length === 0) return escHtml(text);
  terms.sort(function(a, b) { return b.length - a.length; });

  // Build a list of [start, end] ranges
  var lower = text.toLowerCase();
  var ranges = [];
  for (var k = 0; k < terms.length; k++) {
    var term = terms[k];
    var pos = 0;
    while (pos <= lower.length - term.length) {
      var idx = lower.indexOf(term, pos);
      if (idx === -1) break;
      ranges.push([idx, idx + term.length]);
      pos = idx + 1;
    }
  }
  if (ranges.length === 0) return escHtml(text);

  // Merge overlapping ranges
  ranges.sort(function(a, b) { return a[0] - b[0]; });
  var merged = [ranges[0]];
  for (var r = 1; r < ranges.length; r++) {
    var last = merged[merged.length - 1];
    if (ranges[r][0] <= last[1]) {
      if (ranges[r][1] > last[1]) last[1] = ranges[r][1];
    } else {
      merged.push(ranges[r]);
    }
  }

  // Build HTML from merged ranges
  var out = '';
  var cursor = 0;
  for (var g = 0; g < merged.length; g++) {
    // Before match
    if (merged[g][0] > cursor) {
      out += escHtml(text.substring(cursor, merged[g][0]));
    }
    // Match
    out += '<mark>' + escHtml(text.substring(merged[g][0], merged[g][1])) + '</mark>';
    cursor = merged[g][1];
  }
  // After last match
  if (cursor < text.length) {
    out += escHtml(text.substring(cursor));
  }
  return out;
}

var _searchTimer = null;
var _searchResults = null;
var _searchParsedQ = null;

function doSearch(query) {
  if (!query) { _searchResults = null; renderTree(); return; }
  var xhr = new XMLHttpRequest();
  xhr.open('GET', '/api/search?path=' + encodeURIComponent(state.currentPath) + '&q=' + encodeURIComponent(query));
  xhr.onload = function() {
    var resp = JSON.parse(xhr.responseText);
    _searchResults = resp.results || [];
    _searchParsedQ = parseQueryClient(query);
    renderTree();
  };
  xhr.send();
}

function renderTree() {
  var items = sortItems(state.items);
  var q = state.searchQuery.toLowerCase();
  var html = '';

  // Parent directory link
  if (state.parentPath && !_searchResults) {
    html += '<div class="tree-item parent-dir" data-action="navigate" data-path="' + escHtml(state.parentPath) + '">'
      + '<span class="icon">\ud83d\udcc1</span>'
      + '<span class="name">..</span>'
      + '</div>';
  }

  // Check if any date filter is active
  var hasDateFilter = state.filterModFrom || state.filterModTo || state.filterCreFrom || state.filterCreTo;
  var hasMatchFilter = state.filterMatchMin !== '' || state.filterMatchMax !== '';

  // Search results mode
  if (_searchResults !== null) {
    var filteredResults = _searchResults.filter(function(sr) {
      if (!state.showHidden && sr.hidden) return false;
      if (hasDateFilter && !passesDateFilter(sr)) return false;
      if (hasMatchFilter && !passesMatchFilter(sr)) return false;
      return true;
    });
    if (filteredResults.length === 0) {
      html += '<div class="search-mode-indicator">No results</div>';
    } else {
      html += '<div class="search-mode-indicator">' + filteredResults.length + ' result' + (filteredResults.length > 1 ? 's' : '') + '</div>';
    }
    var sitems = sortItems(filteredResults);
    for (var si = 0; si < sitems.length; si++) {
      var sitem = sitems[si];
      var sext = getExt(sitem.name);
      var sicon = getIcon(sitem.name, false);
      var sfullPath = state.currentPath + '/' + sitem.name;
      var sisActive = state.activeTab === sfullPath;
      var sbadgeColor = getBadgeColor(sext);
      var matchCls = sitem.matchType === 'both' ? ' match-both' : (sitem.matchType === 'content' ? ' match-content' : ' match-name');

      html += '<div class="tree-item' + (sisActive ? ' selected' : '') + matchCls + '"'
        + ' data-action="open" data-path="' + escHtml(sfullPath) + '" data-name="' + escHtml(sitem.name) + '"'
        + ' title="' + escHtml(sitem.name) + '">'
        + '<span class="icon">' + sicon + '</span>'
        + '<span class="name">' + (sitem.matchType !== 'content' && _searchParsedQ ? highlightTerms(sitem.name, _searchParsedQ) : escHtml(sitem.name)) + '</span>';

      if (sext) {
        html += '<span class="file-meta">';
        if (sitem.matchCount !== undefined) {
          html += '<span class="match-count" title="' + sitem.matchCount + ' matches (' + (sitem.nameMatchCount || 0) + ' name + ' + (sitem.contentMatchCount || 0) + ' content)">' + sitem.matchCount + '</span>';
        }
        html += '<span class="badge" style="color:' + sbadgeColor + ';border:1px solid ' + sbadgeColor + '">' + sext + '</span>'
          + (sitem.size !== undefined ? '<span class="size">' + formatSize(sitem.size) + '</span>' : '');
        var sEdited = sitem.modified && sitem.created && sitem.modified.substring(0,19) > sitem.created.substring(0,19);
        if (sitem.modified) {
          html += '<span class="file-date modified' + (sEdited ? ' edited' : '') + '" title="Modified">'
            + '<span class="date-label">M</span>' + formatDateTime(sitem.modified) + '</span>';
        }
        if (sitem.created) {
          html += '<span class="file-date created" title="Created">'
            + '<span class="date-label">C</span>' + formatDateTime(sitem.created) + '</span>';
        }
        html += '</span>';
      }
      html += '<span class="file-actions">'
        + '<button class="btn-copy" data-action="copy-path" title="Copy full path">&#128203;</button>'
        + '<button class="btn-ren" data-action="rename" title="Rename">&#9998;</button>'
        + '<button class="btn-del" data-action="delete" title="Delete">&#128465;</button>'
        + '</span></div>';

      if (sitem.snippet && (sitem.matchType === 'content' || sitem.matchType === 'both')) {
        html += '<div class="search-snippet" data-action="open" data-path="' + escHtml(sfullPath) + '" data-name="' + escHtml(sitem.name) + '">'
          + (_searchParsedQ ? highlightTerms(sitem.snippet, _searchParsedQ) : escHtml(sitem.snippet))
          + '</div>';
      }
    }
    $tree.innerHTML = html;
    return;
  }

  for (var i = 0; i < items.length; i++) {
    var item = items[i];

    // Hidden file filter
    if (!state.showHidden && item.hidden) continue;
    // Search filter (fallback for non-search mode)
    if (q && !_searchResults && item.name.toLowerCase().indexOf(q) === -1) continue;
    // Date filter
    if (hasDateFilter && !passesDateFilter(item)) continue;

    var isDir = item.type === 'dir';
    var ext = isDir ? '' : getExt(item.name);
    var icon = getIcon(item.name, isDir);
    var fullPath = state.currentPath + '/' + item.name;
    var isActive = state.activeTab === fullPath;
    var badgeColor = getBadgeColor(ext);

    html += '<div class="tree-item' + (isDir ? ' dir-item' : '') + (isActive ? ' selected' : '') + '"'
      + ' data-action="' + (isDir ? 'navigate' : 'open') + '"'
      + ' data-path="' + escHtml(fullPath) + '"'
      + ' data-name="' + escHtml(item.name) + '"'
      + ' title="' + escHtml(item.name) + '">'
      + '<span class="icon">' + icon + '</span>'
      + '<span class="name">' + escHtml(item.name) + '</span>';

    if (ext && !isDir) {
      html += '<span class="file-meta">'
        + '<span class="badge" style="color:' + badgeColor + ';border:1px solid ' + badgeColor + '">' + ext + '</span>'
        + (item.size !== undefined ? '<span class="size">' + formatSize(item.size) + '</span>' : '');
      var isEdited = item.modified && item.created && item.modified.substring(0,19) > item.created.substring(0,19);
      if (item.modified) {
        html += '<span class="file-date modified' + (isEdited ? ' edited' : '') + '" title="Modified">'
          + '<span class="date-label">M</span>' + formatDateTime(item.modified) + '</span>';
      }
      if (item.created) {
        html += '<span class="file-date created" title="Created">'
          + '<span class="date-label">C</span>' + formatDateTime(item.created) + '</span>';
      }
      html += '</span>';
    }
    html += '<span class="file-actions">'
      + '<button class="btn-copy" data-action="copy-path" title="Copy full path">&#128203;</button>'
      + '<button class="btn-ren" data-action="rename" title="Rename (F2)">&#9998;</button>'
      + '<button class="btn-del" data-action="delete" title="Delete">&#128465;</button>'
      + '</span>';
    html += '</div>';
  }

  $tree.innerHTML = html;
}

// Tree click handler (event delegation)
$tree.addEventListener('click', function(e) {
  // Check for action buttons first
  var actionBtn = e.target.closest('[data-action="rename"], [data-action="delete"], [data-action="copy-path"]');
  if (actionBtn) {
    e.stopPropagation();
    var treeItem = actionBtn.closest('.tree-item');
    if (!treeItem) return;
    var filePath = treeItem.dataset.path;
    var fileName = treeItem.dataset.name;
    if (actionBtn.dataset.action === 'rename') {
      startRename(treeItem, filePath, fileName);
    } else if (actionBtn.dataset.action === 'delete') {
      doDelete(filePath, fileName);
    } else if (actionBtn.dataset.action === 'copy-path') {
      doCopyPath(filePath, actionBtn);
    }
    return;
  }
  // Search snippet click
  var snippetEl = e.target.closest('.search-snippet');
  if (snippetEl && snippetEl.dataset.path) {
    openFile(snippetEl.dataset.path, snippetEl.dataset.name);
    return;
  }
  var el = e.target.closest('.tree-item');
  if (!el) return;
  var action = el.dataset.action;
  var p = el.dataset.path;
  if (action === 'navigate') {
    navigateTo(p);
  } else if (action === 'open') {
    openFile(p, el.dataset.name);
  }
});

function startRename(treeItem, filePath, oldName) {
  var nameSpan = treeItem.querySelector('.name');
  if (!nameSpan) return;
  var input = document.createElement('input');
  input.className = 'rename-input';
  input.value = oldName;
  nameSpan.textContent = '';
  nameSpan.appendChild(input);
  input.focus();
  // Select name without extension
  var dotIdx = oldName.lastIndexOf('.');
  if (dotIdx > 0) {
    input.setSelectionRange(0, dotIdx);
  } else {
    input.select();
  }

  function commit() {
    var newName = input.value.trim();
    if (!newName || newName === oldName) {
      nameSpan.textContent = oldName;
      return;
    }
    var dir = filePath.substring(0, filePath.lastIndexOf('/'));
    var newPath = dir + '/' + newName;
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/rename');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function() {
      var resp = JSON.parse(xhr.responseText);
      if (resp.ok) {
        // Update tab if open
        if (state.openTabs.indexOf(filePath) !== -1) {
          var idx = state.openTabs.indexOf(filePath);
          state.openTabs[idx] = resp.newPath;
          if (state.tabCache[filePath]) {
            state.tabCache[resp.newPath] = state.tabCache[filePath];
            state.tabCache[resp.newPath].name = newName;
            if (state.tabCache[resp.newPath].data) state.tabCache[resp.newPath].data.name = newName;
            delete state.tabCache[filePath];
          }
          if (state.activeTab === filePath) state.activeTab = resp.newPath;
          renderTabs();
          renderContent();
        }
        navigateTo(state.currentPath);
      } else {
        nameSpan.textContent = oldName;
        alert(resp.error || 'Rename failed');
      }
    };
    xhr.send(JSON.stringify({ oldPath: filePath, newPath: newPath }));
  }

  input.addEventListener('keydown', function(ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
    if (ev.key === 'Escape') { ev.preventDefault(); nameSpan.textContent = oldName; }
    ev.stopPropagation();
  });
  input.addEventListener('blur', commit);
}

function doDelete(filePath, fileName) {
  if (!confirm('Delete "' + fileName + '"?')) return;
  var xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/delete');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onload = function() {
    var resp = JSON.parse(xhr.responseText);
    if (resp.ok) {
      // Close tab if open
      if (state.openTabs.indexOf(filePath) !== -1) {
        closeTab(filePath);
      }
      navigateTo(state.currentPath);
    } else {
      alert(resp.error || 'Delete failed');
    }
  };
  xhr.send(JSON.stringify({ path: filePath }));
}

function doCopyPath(filePath, btn) {
  var flash = function(ok) {
    if (!btn) return;
    var origTitle = btn.getAttribute('title') || 'Copy full path';
    btn.classList.add('copied');
    btn.setAttribute('title', ok ? 'Copied!' : 'Copy failed');
    setTimeout(function() {
      btn.classList.remove('copied');
      btn.setAttribute('title', 'Copy full path');
    }, 1200);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(filePath).then(
      function() { flash(true); },
      function() { fallbackCopy(filePath, flash); }
    );
  } else {
    fallbackCopy(filePath, flash);
  }
}

function fallbackCopy(text, cb) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.top = '-1000px';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  var ok = false;
  try { ok = document.execCommand('copy'); } catch(e) { ok = false; }
  document.body.removeChild(ta);
  if (cb) cb(ok);
  if (!ok) alert('Copy failed. Path: ' + text);
}

