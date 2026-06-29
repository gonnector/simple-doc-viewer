// --- CSV/TSV 파싱 (순수, DOM 미접근) ---
// RFC4180: 따옴표 필드, "" 이스케이프, 따옴표 내 구분자/줄바꿈 허용
function sdvParseDelimited(text, delim) {
  var rows = [], row = [], field = '';
  var i = 0, n = text.length, inQ = false;
  if (text.charCodeAt(0) === 0xFEFF) i = 1; // BOM 제거
  while (i < n) {
    var c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === delim) { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function sdvCsvIsNumeric(v) {
  if (v === null || v === undefined) return false;
  var s = String(v).trim();
  if (s === '') return false;
  return /^[+-]?(\d{1,3}(,\d{3})*|\d+)(\.\d+)?$/.test(s);
}

function sdvCsvColumnIsNumeric(rows, colIdx) {
  var seen = false;
  for (var r = 0; r < rows.length; r++) {
    var cell = rows[r][colIdx];
    if (cell === undefined || String(cell).trim() === '') continue;
    seen = true;
    if (!sdvCsvIsNumeric(cell)) return false;
  }
  return seen;
}

function sdvCsvNum(v) { return parseFloat(String(v).replace(/,/g, '')); }
