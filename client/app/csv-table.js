// --- CSV/TSV 표 뷰 (정렬 + 표/원문 토글) ---
(function () {
  var _csv = {}; // key=activeTab → { sortCol, sortDir(1 asc/-1 desc/0 none), mode('table'|'raw') }
  var MAXROWS = 5000;

  function buildTable(rows, key) {
    if (!rows.length) return '<div class="csv-empty">빈 파일</div>';
    var header = rows[0], body = rows.slice(1);
    var st = _csv[key];
    var view = body.slice();
    if (st.sortCol >= 0 && st.sortDir !== 0) {
      var numeric = sdvCsvColumnIsNumeric(body, st.sortCol);
      view.sort(function (a, b) {
        var av = a[st.sortCol] === undefined ? '' : a[st.sortCol];
        var bv = b[st.sortCol] === undefined ? '' : b[st.sortCol];
        var cmp;
        if (av === '' && bv === '') cmp = 0;
        else if (av === '') cmp = 1;       // 빈 값은 끝으로
        else if (bv === '') cmp = -1;
        else if (numeric) cmp = sdvCsvNum(av) - sdvCsvNum(bv);
        else cmp = av.localeCompare(bv);
        return st.sortDir === 1 ? cmp : -cmp;
      });
    }
    var truncated = view.length > MAXROWS;
    var shown = truncated ? view.slice(0, MAXROWS) : view;
    var h = '';
    if (truncated) h += '<div class="csv-notice">' + view.length.toLocaleString() + '행 중 처음 ' + MAXROWS.toLocaleString() + '행만 표시</div>';
    h += '<div class="csv-wrap"><table class="csv-table"><thead><tr>';
    for (var c = 0; c < header.length; c++) {
      var arrow = (st.sortCol === c) ? (st.sortDir === 1 ? '▲' : (st.sortDir === -1 ? '▼' : '')) : '';
      h += '<th data-col="' + c + '">' + escHtml(header[c]) + '<span class="csv-arrow">' + arrow + '</span></th>';
    }
    h += '</tr></thead><tbody>';
    if (!shown.length) {
      h += '<tr><td class="csv-norows" colspan="' + header.length + '">데이터 없음</td></tr>';
    } else {
      for (var r = 0; r < shown.length; r++) {
        h += '<tr>';
        for (var cc = 0; cc < header.length; cc++) {
          var cell = shown[r][cc] === undefined ? '' : shown[r][cc];
          h += '<td title="' + escHtml(cell) + '">' + escHtml(cell) + '</td>';
        }
        h += '</tr>';
      }
    }
    h += '</tbody></table></div>';
    return h;
  }

  window.renderCsv = function (data) {
    var key = state.activeTab || '';
    if (!_csv[key]) _csv[key] = { sortCol: -1, sortDir: 0, mode: 'table' };
    var st = _csv[key];
    var delim = data.ext === 'tsv' ? '\t' : ',';
    var toolbar = '<div class="csv-toolbar"><button id="csv-toggle">' + (st.mode === 'table' ? '원문 보기' : '표 보기') + '</button></div>';
    var bodyHtml;
    if (st.mode === 'raw') {
      bodyHtml = '<div class="raw-view' + (state.wordWrap ? ' word-wrap' : '') + '">' + renderRaw(data.content, data.ext) + '</div>';
      docLines = data.content.split('\n').length;
    } else {
      var rows = null;
      try { rows = sdvParseDelimited(data.content, delim); } catch (e) { rows = null; }
      if (!rows) {
        bodyHtml = '<div class="raw-view">' + renderRaw(data.content, data.ext) + '</div>';
        docLines = data.content.split('\n').length;
      } else {
        bodyHtml = buildTable(rows, key);
        docLines = rows.length > 1 ? rows.length - 1 : 0; // 데이터 행수
      }
    }
    $content.innerHTML = toolbar + bodyHtml;
    var wrap = $content.querySelector('.csv-wrap');
    if (wrap) {
      $content.classList.add('csv-mode'); // 단일 스크롤러 + sticky 안정 (독립 리뷰 #1/#2)
      wrap.addEventListener('scroll', updateStatusBar); // B1: 표 내부 스크롤도 상태바 반영
    } else {
      $content.classList.remove('csv-mode'); // 원문 보기 모드는 일반 스크롤
    }
    updateStatusBar();
  };

  function reRender() {
    var tab = state.tabCache[state.activeTab];
    if (tab && tab.data && (tab.data.ext === 'csv' || tab.data.ext === 'tsv')) window.renderCsv(tab.data);
  }

  // N1: CSV 컨텍스트에서만 동작
  $content.addEventListener('click', function (e) {
    var isToggle = !!(e.target && e.target.id === 'csv-toggle');
    var inTable = !!(e.target && e.target.closest && e.target.closest('.csv-table'));
    if (!isToggle && !inTable) return;
    var key = state.activeTab || '';
    if (isToggle) {
      var st = _csv[key]; if (!st) return;
      st.mode = st.mode === 'table' ? 'raw' : 'table';
      reRender(); return;
    }
    var th = e.target.closest('th[data-col]');
    if (th) {
      var st2 = _csv[key]; if (!st2) return;
      var col = parseInt(th.getAttribute('data-col'), 10);
      if (st2.sortCol !== col) { st2.sortCol = col; st2.sortDir = 1; }
      else if (st2.sortDir === 1) st2.sortDir = -1;
      else if (st2.sortDir === -1) { st2.sortDir = 0; st2.sortCol = -1; }
      else st2.sortDir = 1;
      reRender();
    }
  });
})();
