// --- Search ---
var $sortMatches = document.getElementById('sort-matches');
var $matchFilterRow = document.getElementById('match-filter-row');

function updateSearchModeUI(isSearchMode) {
  $sortMatches.style.display = isSearchMode ? '' : 'none';
  $matchFilterRow.style.display = isSearchMode ? 'flex' : 'none';
  if (!isSearchMode && state.sortBy === 'matchCount') {
    state.sortBy = 'name';
    state.sortAsc = true;
    updateSortUI();
  }
}

$search.addEventListener('input', function() {
  state.searchQuery = $search.value;
  if (_searchTimer) clearTimeout(_searchTimer);
  if (!state.searchQuery) {
    _searchResults = null;
    updateSearchModeUI(false);
    renderTree();
    return;
  }
  _searchTimer = setTimeout(function() {
    doSearch(state.searchQuery);
    updateSearchModeUI(true);
  }, 300);
});

document.getElementById('search-clear').addEventListener('click', function() {
  $search.value = '';
  state.searchQuery = '';
  _searchResults = null;
  updateSearchModeUI(false);
  renderTree();
  $search.focus();
});

// --- Filter Panel ---
var $btnFilter = document.getElementById('btn-filter');
var $dateFilterPanel = document.getElementById('date-filter-panel');
var $filterModFrom = document.getElementById('filter-mod-from');
var $filterModTo = document.getElementById('filter-mod-to');
var $filterCreFrom = document.getElementById('filter-cre-from');
var $filterCreTo = document.getElementById('filter-cre-to');
var $filterMatchMin = document.getElementById('filter-match-min');
var $filterMatchMax = document.getElementById('filter-match-max');
var $dateFilterApply = document.getElementById('date-filter-apply');
var $dateFilterClear = document.getElementById('date-filter-clear');

$btnFilter.addEventListener('click', function() {
  $dateFilterPanel.classList.toggle('visible');
});

function applyFilters() {
  state.filterModFrom = $filterModFrom.value;
  state.filterModTo = $filterModTo.value;
  state.filterCreFrom = $filterCreFrom.value;
  state.filterCreTo = $filterCreTo.value;
  state.filterMatchMin = $filterMatchMin.value;
  state.filterMatchMax = $filterMatchMax.value;
  // Update filter indicator on button
  var hasFilter = state.filterModFrom || state.filterModTo || state.filterCreFrom || state.filterCreTo || state.filterMatchMin !== '' || state.filterMatchMax !== '';
  $btnFilter.classList.toggle('active', hasFilter);
  renderTree();
}

function clearFilters() {
  $filterModFrom.value = '';
  $filterModTo.value = '';
  $filterCreFrom.value = '';
  $filterCreTo.value = '';
  $filterMatchMin.value = '';
  $filterMatchMax.value = '';
  state.filterModFrom = '';
  state.filterModTo = '';
  state.filterCreFrom = '';
  state.filterCreTo = '';
  state.filterMatchMin = '';
  state.filterMatchMax = '';
  $btnFilter.classList.remove('active');
  renderTree();
}

$dateFilterApply.addEventListener('click', applyFilters);
$dateFilterClear.addEventListener('click', clearFilters);

// Auto-apply on date input change
$filterModFrom.addEventListener('change', applyFilters);
$filterModTo.addEventListener('change', applyFilters);
$filterCreFrom.addEventListener('change', applyFilters);
$filterCreTo.addEventListener('change', applyFilters);

// --- ResizeObserver for narrow mode ---
if (window.ResizeObserver) {
  new ResizeObserver(function(entries) {
    var w = entries[0].contentRect.width;
    $sidebar.classList.toggle('narrow', w < 428);
  }).observe($sidebar);
}

