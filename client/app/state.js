
// ================================================================
// Client-side JavaScript (no template literals — all single quotes)
// ================================================================

// --- State ---
var state = {
  currentPath: '',
  parentPath: null,
  items: [],
  openTabs: [],
  activeTab: null,
  tabCache: {},
  showHidden: false,
  wordWrap: false,
  lightMode: false,
  viewMode: 'preview',  // 'preview' | 'split' | 'source'
  searchQuery: '',
  sortBy: 'name',
  sortAsc: true,
  selectedTabs: {},
  rootDir: null,
  filterModFrom: '',
  filterModTo: '',
  filterCreFrom: '',
  filterCreTo: '',
  filterMatchMin: '',
  filterMatchMax: ''
};

// --- DOM refs ---
var $tree = document.getElementById('file-tree');
var $tabs = document.getElementById('tab-bar');
var $content = document.getElementById('content-body');
var $search = document.getElementById('search-input');
var $pathBadge = document.getElementById('path-badge');
var $btnTheme = document.getElementById('btn-theme');
var $btnSource = document.getElementById('btn-source');
var $btnHidden = document.getElementById('btn-hidden');
var $btnWrap = document.getElementById('btn-wrap');
var $btnSidebar = document.getElementById('btn-sidebar');
var $sidebar = document.querySelector('.sidebar');
var $resizeHandle = document.getElementById('resize-handle');
var $btnHelp = document.getElementById('btn-help');
var $helpOverlay = document.getElementById('help-overlay');
var $statusBar = document.getElementById('status-bar');
var $statusLines = document.getElementById('status-lines');
var $statusPct = document.getElementById('status-pct');
var docLines = 0;

function updateStatusBar() {
  if (!docLines) {
    $statusBar.classList.add('empty');
    return;
  }
  // CSV 표는 내부 .csv-wrap이 스크롤 컨테이너 — 있으면 그 기준으로 % 계산
  var sc = $content.querySelector('.csv-wrap') || $content;
  var pct = sc.scrollHeight > sc.clientHeight
    ? Math.min(100, Math.round((sc.scrollTop + sc.clientHeight) / sc.scrollHeight * 100))
    : 100;
  $statusLines.textContent = docLines.toLocaleString() + (sc === $content ? ' lines' : ' rows');
  $statusPct.textContent = pct + '%';
  $statusBar.classList.remove('empty');
}

$content.addEventListener('scroll', updateStatusBar);

// Intercept anchor link clicks inside rendered content
$content.addEventListener('click', function(e) {
  var el = e.target;
  while (el && el.tagName !== 'A') el = el.parentElement;
  if (!el) return;
  var href = el.getAttribute('href');
  if (href && href.charAt(0) === '#') {
    e.preventDefault();
    var id = href.slice(1);
    var target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

