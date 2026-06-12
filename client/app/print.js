// --- PDF Export ---
document.getElementById('btn-pdf').addEventListener('click', function() {
  if (!state.activeTab) return;
  var tab = state.tabCache[state.activeTab];
  if (!tab) return;

  // Media files: only images can be exported, video/audio cannot
  if (isMediaExt(tab.ext)) {
    if (MEDIA_VID[tab.ext]) { alert('Video files cannot be exported to PDF.'); return; }
    if (MEDIA_AUD[tab.ext]) { alert('Audio files cannot be exported to PDF.'); return; }
    // Image: export without zoom bar
    var imgEl = document.getElementById('media-target');
    if (!imgEl) return;
    var imgSrc = imgEl.src;
    var title = tab.name || 'Image';
    var fontLink = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';
    var pw = window.open('', '_blank');
    if (!pw) { alert('Pop-up blocked.'); return; }
    pw.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + escHtml(title) + '</title>'
      + '<link rel="stylesheet" href="' + fontLink + '">'
      + '<style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff;} img{max-width:100%;max-height:100vh;object-fit:contain;} @page{margin:10mm;}</style>'
      + '</head><body><img src="' + imgSrc + '"><scr' + 'ipt>document.fonts.ready.then(function(){setTimeout(function(){window.print();},300);});</' + 'scr' + 'ipt></body></html>');
    pw.document.close();
    return;
  }

  if (!tab.data) return;

  var rendered = document.querySelector('.md-rendered');
  var rawView = document.querySelector('.raw-view');
  var contentHTML = '';
  var isMarkdown = tab.data.ext === 'md';

  if (rendered) {
    contentHTML = rendered.innerHTML;
  } else if (rawView) {
    contentHTML = '<pre style="font-family:monospace;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-all;">' + rawView.innerHTML + '</pre>';
  } else {
    contentHTML = $content.innerHTML;
  }

  var title = tab.data.name || 'Document';
  var fontLink = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';

  var printCSS = [
    '*, *::before, *::after { box-sizing: border-box; }',
    'body { font-family: "Pretendard Variable", Pretendard, -apple-system, sans-serif; color: #1f2328; background: #fff; margin: 0; padding: 40px 50px; font-size: 14px; line-height: 1.75; }',
    'h1 { font-size: 1.8em; font-weight: 700; margin: 1.5em 0 0.5em; padding-bottom: 0.3em; border-bottom: 2px solid #0969da; }',
    'h2 { font-size: 1.4em; font-weight: 600; margin: 1.5em 0 0.5em; padding-bottom: 0.25em; border-bottom: 1px solid #d0d7de; color: #0969da; }',
    'h3 { font-size: 1.15em; font-weight: 600; margin: 1.2em 0 0.4em; }',
    'h4 { font-size: 1em; font-weight: 600; margin: 1em 0 0.3em; color: #8250df; }',
    'h5 { font-size: 0.9em; font-weight: 600; margin: 0.8em 0 0.3em; }',
    'h6 { font-size: 0.85em; font-weight: 600; margin: 0.8em 0 0.3em; color: #656d76; }',
    'p { margin: 0.6em 0; }',
    'strong { font-weight: 700; }',
    'em { font-style: italic; }',
    'del { text-decoration: line-through; color: #656d76; }',
    'a { color: #0969da; text-decoration: none; }',
    'code:not(pre code) { background: #eff1f3; color: #cf222e; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.88em; font-family: "Cascadia Code","Fira Code",Consolas,monospace; }',
    'pre { background: #f6f8fa; border: 1px solid #d0d7de; padding: 14px 18px; border-radius: 8px; overflow-x: auto; margin: 0.8em 0; font-size: 13px; line-height: 1.55; position: relative; }',
    'pre code { font-family: "Cascadia Code","Fira Code",Consolas,monospace; background: none; color: #1f2328; padding: 0; }',
    'pre[data-lang]::after { content: attr(data-lang); position: absolute; top: 6px; right: 10px; font-size: 10px; color: #656d76; text-transform: uppercase; }',
    'blockquote { border-left: 3px solid #0969da; padding: 8px 16px; margin: 0.8em 0; color: #656d76; background: rgba(9,105,218,0.04); border-radius: 0 6px 6px 0; }',
    'hr { border: none; border-top: 1px solid #d0d7de; height: 0; margin: 1.5em 0; }',
    'ul, ol { padding-left: 1.6em; margin: 0.5em 0; }',
    'li { margin: 0.25em 0; }',
    'table { width: 100%; border-collapse: collapse; margin: 0.8em 0; font-size: 13px; }',
    'thead { background: rgba(9,105,218,0.06); }',
    'th { padding: 8px 12px; font-weight: 600; text-align: left; border-bottom: 2px solid #d0d7de; }',
    'td { padding: 6px 12px; border-bottom: 1px solid #d0d7de; }',
    'img { max-width: 100%; border-radius: 4px; }',
    'kbd { background: #f6f8fa; border: 1px solid #d0d7de; padding: 1px 6px; border-radius: 4px; font-size: 0.85em; border-bottom-width: 2px; }',
    'mark { background: #fff8c5; padding: 0.1em 0.3em; border-radius: 3px; }',
    'details { border: 1px solid #d0d7de; border-radius: 8px; padding: 10px 14px; margin: 0.8em 0; background: #f6f8fa; }',
    'summary { cursor: pointer; font-weight: 600; color: #0969da; }',
    '.footnotes { font-size: 0.85em; color: #656d76; margin-top: 2em; border-top: 1px solid #d0d7de; padding-top: 1em; }',
    '.footnote-ref { font-size: 0.75em; vertical-align: super; }',
    '.frontmatter-card { border: 1.5px solid #d0d7de; border-left: 4px solid #1a7f37; border-radius: 4px 10px 10px 4px; padding: 14px 18px; margin: 0 0 1.5em; font-size: 13px; display: grid; grid-template-columns: auto 1fr; gap: 4px 14px; align-items: baseline; }',
    '.frontmatter-card .fm-key { color: #1a7f37; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }',
    '.frontmatter-card .fm-val { color: #1f2328; word-break: break-word; }',
    '.frontmatter-card .fm-tag { display: inline-block; border: 1.5px solid #0969da; color: #0969da; padding: 1px 7px; border-radius: 4px; font-size: 12px; margin: 1px 2px; font-weight: 600; }',
    '.task-list-item { list-style: none; margin-left: -1.3em; }',
    '.task-list-item input[type="checkbox"] { margin-right: 6px; }',
    '.hljs-keyword { color: #cf222e; }',
    '.hljs-string, .hljs-attr { color: #0a3069; }',
    '.hljs-comment { color: #6e7781; font-style: italic; }',
    '.hljs-function, .hljs-title { color: #8250df; }',
    '.hljs-number { color: #0550ae; }',
    '.hljs-built_in { color: #953800; }',
    '.tok-kw { color: #cf222e; }',
    '.tok-str { color: #0a3069; }',
    '.tok-num { color: #0550ae; }',
    '.tok-cm { color: #6e7781; font-style: italic; }',
    '.tok-fn { color: #8250df; }',
    '.tok-op { color: #cf222e; }',
    '.tok-key { color: #116329; }',
    '.line-num { display: inline-block; width: 44px; min-width: 44px; text-align: right; padding-right: 16px; color: #656d76; opacity: 0.5; user-select: none; font-size: 12px; }',
    '.raw-line { display: flex; min-height: 1.6em; }',
    '.line-content { flex: 1; white-space: pre-wrap; word-break: break-all; }',
    '@page { margin: 15mm 15mm; }',
    '@media print { body { padding: 0; } }'
  ].join('\n');

  var printWin = window.open('', '_blank');
  if (!printWin) { alert('Pop-up blocked. Please allow pop-ups.'); return; }

  var docHTML = '<!DOCTYPE html><html><head>'
    + '<meta charset="UTF-8">'
    + '<title>' + escHtml(title) + '</title>'
    + '<link rel="stylesheet" href="' + fontLink + '">'
    + '<link rel="stylesheet" href="/lib/katex/katex.min.css">'
    + '<style>' + printCSS + '</style>'
    + '</head><body>'
    + contentHTML
    + '<scr' + 'ipt>document.fonts.ready.then(function(){setTimeout(function(){window.print();},300);});</' + 'scr' + 'ipt>'
    + '</body></html>';

  printWin.document.write(docHTML);
  printWin.document.close();
});

