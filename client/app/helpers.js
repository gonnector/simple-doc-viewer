// --- Helpers ---
function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function slugify(text) {
  text = text.replace(/\*\*?([^*]*)\*\*?/g, '$1').replace(/__?([^_]*)__?/g, '$1');
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.toLowerCase();
  // Keep: a-z, 0-9, space, hyphen, Korean syllables & high Unicode (>= 0xAC00)
  var _out = '';
  for (var _i = 0; _i < text.length; _i++) {
    var _c = text.charCodeAt(_i);
    if ((_c >= 97 && _c <= 122) || (_c >= 48 && _c <= 57) || _c === 32 || _c === 45 || _c >= 0xAC00) {
      _out += text[_i];
    }
  }
  return _out.replace(/\s/g, '-');
}

function getExt(name) {
  if (name === 'Dockerfile' || name === 'dockerfile') return 'dockerfile';
  if (name === 'Makefile' || name === 'makefile') return 'makefile';
  if (name === 'LICENSE' || name === 'CHANGELOG' || name === 'README') return 'txt';
  var m = name.match(/\.([^.]+)$/);
  return m ? m[1].toLowerCase() : '';
}

function getIcon(name, isDir) {
  if (isDir) return '\ud83d\udcc1';
  var ext = getExt(name);
  var map = {
    md: '\ud83d\udcd8', json: '\ud83d\udce6', ts: '\ud83d\udd37', tsx: '\ud83d\udd37',
    js: '\ud83d\udfe1', jsx: '\ud83d\udfe1', py: '\ud83d\udc0d', rb: '\ud83d\udc8e',
    html: '\ud83c\udf10', css: '\ud83c\udfa8', yaml: '\u2699\ufe0f', yml: '\u2699\ufe0f',
    dockerfile: '\ud83d\udc33', sh: '\ud83d\udcbb', bash: '\ud83d\udcbb',
    sql: '\ud83d\uddc4', lock: '\ud83d\udd12', svg: '\ud83d\uddbc',
    go: '\ud83d\udc39', rs: '\ud83e\udda0', java: '\u2615',
    env: '\ud83d\udd10', gitignore: '\ud83d\udeab',
    png: '\ud83d\uddbc', jpg: '\ud83d\uddbc', jpeg: '\ud83d\uddbc', gif: '\ud83d\uddbc',
    webp: '\ud83d\uddbc', bmp: '\ud83d\uddbc', ico: '\ud83d\uddbc', avif: '\ud83d\uddbc',
    mp4: '\ud83c\udfac', webm: '\ud83c\udfac', mov: '\ud83c\udfac', avi: '\ud83c\udfac', mkv: '\ud83c\udfac', ogg: '\ud83c\udfac',
    mp3: '\ud83c\udfb5', wav: '\ud83c\udfb5', flac: '\ud83c\udfb5', aac: '\ud83c\udfb5', opus: '\ud83c\udfb5', m4a: '\ud83c\udfb5', wma: '\ud83c\udfb5',
    pdf: '\ud83d\udcc4'
  };
  return map[ext] || '\ud83d\udcc4';
}

function getBadgeColor(ext) {
  var map = {
    md: 'var(--badge-md)', json: 'var(--badge-json)',
    ts: 'var(--badge-ts)', tsx: 'var(--badge-ts)',
    js: 'var(--badge-js)', jsx: 'var(--badge-js)',
    yaml: 'var(--badge-yaml)', yml: 'var(--badge-yaml)',
    dockerfile: 'var(--badge-docker)',
    py: 'var(--badge-py)', html: 'var(--badge-html)',
    css: 'var(--badge-css)',
    png: 'var(--badge-img)', jpg: 'var(--badge-img)', jpeg: 'var(--badge-img)',
    gif: 'var(--badge-img)', webp: 'var(--badge-img)', bmp: 'var(--badge-img)',
    svg: 'var(--badge-img)', ico: 'var(--badge-img)', avif: 'var(--badge-img)',
    mp4: 'var(--badge-video)', webm: 'var(--badge-video)', mov: 'var(--badge-video)',
    avi: 'var(--badge-video)', mkv: 'var(--badge-video)', ogg: 'var(--badge-video)',
    mp3: 'var(--badge-audio)', wav: 'var(--badge-audio)', flac: 'var(--badge-audio)',
    aac: 'var(--badge-audio)', opus: 'var(--badge-audio)', m4a: 'var(--badge-audio)', wma: 'var(--badge-audio)',
    pdf: '#f40f02'
  };
  return map[ext] || 'var(--badge-text)';
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  var d = new Date(isoStr);
  var Y = d.getFullYear();
  var M = String(d.getMonth() + 1).padStart(2, '0');
  var D = String(d.getDate()).padStart(2, '0');
  return Y + '-' + M + '-' + D;
}

function formatDateTime(isoStr) {
  if (!isoStr) return '';
  var d = new Date(isoStr);
  var Y = d.getFullYear();
  var M = String(d.getMonth() + 1).padStart(2, '0');
  var D = String(d.getDate()).padStart(2, '0');
  var h = String(d.getHours()).padStart(2, '0');
  var m = String(d.getMinutes()).padStart(2, '0');
  var s = String(d.getSeconds()).padStart(2, '0');
  return Y + '-' + M + '-' + D + ' ' + h + ':' + m + ':' + s;
}

function passesDateFilter(item) {
  if (state.filterModFrom) {
    var modDate = formatDate(item.modified);
    if (modDate < state.filterModFrom) return false;
  }
  if (state.filterModTo) {
    var modDate2 = formatDate(item.modified);
    if (modDate2 > state.filterModTo) return false;
  }
  if (state.filterCreFrom) {
    var creDate = formatDate(item.created);
    if (creDate < state.filterCreFrom) return false;
  }
  if (state.filterCreTo) {
    var creDate2 = formatDate(item.created);
    if (creDate2 > state.filterCreTo) return false;
  }
  return true;
}

function passesMatchFilter(item) {
  if (state.filterMatchMin !== '') {
    var min = parseInt(state.filterMatchMin, 10);
    if (!isNaN(min) && (item.matchCount || 0) < min) return false;
  }
  if (state.filterMatchMax !== '') {
    var max = parseInt(state.filterMatchMax, 10);
    if (!isNaN(max) && (item.matchCount || 0) > max) return false;
  }
  return true;
}

