// --- Markdown Parser ---
var md = (function() {
  var _base = '';

  function highlightCode(code, lang) {
    var escaped = escHtml(code);
    var kwSets = {
      javascript: /\b(function|const|let|var|return|if|else|for|while|class|new|this|import|export|from|of|in|typeof|instanceof|async|await|try|catch|throw|switch|case|break|continue|default|yield|delete|void|null|undefined|true|false)\b/g,
      python: /\b(def|class|return|if|elif|else|for|while|import|from|as|with|try|except|raise|in|not|and|or|is|None|True|False|self|lambda|yield|pass|break|continue|finally|global|nonlocal|assert|del)\b/g,
      bash: /\b(echo|for|do|done|if|then|fi|else|elif|in|function|local|export|source|cd|ls|mkdir|rm|cp|mv|cat|grep|awk|sed|chmod|chown|while|case|esac|read|shift|set|unset)\b/g,
      go: /\b(func|var|const|type|struct|interface|return|if|else|for|range|switch|case|break|continue|default|package|import|defer|go|chan|select|map|make|new|nil|true|false)\b/g,
      rust: /\b(fn|let|mut|const|if|else|for|while|loop|match|return|struct|enum|impl|trait|pub|use|mod|self|super|crate|where|async|await|move|unsafe|extern|type|true|false|None|Some|Ok|Err)\b/g,
      yaml: /\b(true|false|null|yes|no|on|off)\b/g,
      css: /\b(import|media|keyframes|from|to|inherit|initial|unset|none|auto|flex|grid|block|inline|relative|absolute|fixed|sticky|hidden|visible|solid|dashed|dotted|transparent|!important)\b/g,
      html: /\b(doctype|html|head|body|div|span|class|id|style|src|href|alt|title|meta|link|script|type|charset|name|content|rel|lang|async|defer)\b/gi,
      sql: /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|INTO|VALUES|SET|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|IN|IS|NULL|AS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|UNION|ALL|DISTINCT|COUNT|SUM|AVG|MAX|MIN|CASE|WHEN|THEN|ELSE|END|EXISTS|BETWEEN|LIKE|INDEX|PRIMARY|KEY|FOREIGN|REFERENCES|DEFAULT|CONSTRAINT|CASCADE|VIEW|TRIGGER|FUNCTION|PROCEDURE|BEGIN|COMMIT|ROLLBACK)\b/gi
    };
    // Normalize language aliases
    var langMap = { js: 'javascript', ts: 'javascript', jsx: 'javascript', tsx: 'javascript', mjs: 'javascript', cjs: 'javascript', sh: 'bash', zsh: 'bash', yml: 'yaml' };
    var normLang = langMap[lang] || lang;

    var tokens = [];
    var tokenIdx = 0;
    function tok(match, cls) {
      var ph = '\x00T' + (tokenIdx++) + '\x00';
      tokens.push({ ph: ph, html: '<span class="hljs-' + cls + '">' + match + '</span>' });
      return ph;
    }

    // Comments
    var cmRe = { javascript: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, python: /(#.*$|"""[\s\S]*?"""|'''[\s\S]*?''')/gm, bash: /(#.*$)/gm, go: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, rust: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, yaml: /(#.*$)/gm, css: /(\/\*[\s\S]*?\*\/)/gm, html: /(&lt;!--[\s\S]*?--&gt;)/gm, sql: /(--.*$|\/\*[\s\S]*?\*\/)/gm };
    if (cmRe[normLang]) { escaped = escaped.replace(cmRe[normLang], function(m) { return tok(m, 'comment'); }); }

    // Strings
    if (normLang !== 'json') {
      escaped = escaped.replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;|&#39;(?:[^&]|&(?!#39;))*?&#39;)/g, function(m) { return tok(m, 'string'); });
    }

    // JSON special handling
    if (lang === 'json') {
      escaped = escaped.replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)\s*:/g, function(m) { return tok(m, 'attr'); });
      escaped = escaped.replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)/g, function(m) { return tok(m, 'string'); });
      escaped = escaped.replace(/\b(true|false|null)\b/g, function(m) { return tok(m, 'keyword'); });
    }

    // YAML key: value highlighting
    if (normLang === 'yaml') {
      escaped = escaped.replace(/^([\w][\w.\-]*):/gm, function(m, key) { return tok(key, 'attr') + ':'; });
    }

    // CSS selector/property highlighting
    if (normLang === 'css') {
      escaped = escaped.replace(/([\w-]+)\s*:/g, function(m, prop) { return tok(prop, 'attr') + ':'; });
    }

    // HTML tag highlighting
    if (normLang === 'html') {
      escaped = escaped.replace(/(&lt;\/?)([\w-]+)/g, function(m, bracket, tag) { return bracket + tok(tag, 'keyword'); });
      escaped = escaped.replace(/([\w-]+)=(&quot;)/g, function(m, attr, q) { return tok(attr, 'attr') + '=' + q; });
    }

    // Keywords
    if (kwSets[normLang]) { escaped = escaped.replace(kwSets[normLang], function(m) { return tok(m, 'keyword'); }); }

    // Numbers
    escaped = escaped.replace(/\b(\d+\.?\d*)\b/g, function(m) { return tok(m, 'number'); });

    // Restore tokens
    for (var t = 0; t < tokens.length; t++) {
      escaped = escaped.replace(tokens[t].ph, tokens[t].html);
    }
    return escaped;
  }

  // href/src 스킴 화이트리스트 — javascript:/vbscript:/data: 차단 (XSS)
  function sanitizeUrl(u) {
    var t = u.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
    if (t.indexOf('javascript:') === 0 || t.indexOf('vbscript:') === 0 || t.indexOf('data:') === 0) return '#';
    return u;
  }

  // 속성 값용 — 전역 <> 이스케이프 이후 호출되므로 따옴표만 추가 처리
  function escAttr(s) {
    return s.replace(/"/g, '&quot;');
  }

  function inlineFormat(text) {
    // Escape sequences: \* \# \[ etc → placeholder, restore at end
    var escapes = [];
    text = text.replace(/\\([\\*_~`#\[\]()!|>-])/g, function(m, ch) {
      var ph = '\x00E' + escapes.length + '\x00';
      escapes.push(escHtml(ch));
      return ph;
    });
    // Inline code / math → placeholder 우선 (아래 전역 <> 이스케이프와 이중 적용 방지)
    var spans = [];
    text = text.replace(/`([^`]+)`/g, function(m, c) {
      var ph = '\x00C' + spans.length + '\x00';
      spans.push('<code>' + escHtml(c) + '</code>');
      return ph;
    });
    text = text.replace(/\$([^$]+)\$/g, function(m, tex) {
      var ph = '\x00C' + spans.length + '\x00';
      var rendered = null;
      if (window.katex) {
        try { rendered = window.katex.renderToString(tex, { throwOnError: false }); }
        catch(e) { /* fall through */ }
      }
      spans.push(rendered || '<code class="math-inline">' + escHtml(tex) + '</code>');
      return ph;
    });
    // Preserve whitelisted HTML tags (kbd, br, sub, sup, etc.)
    // — on* 이벤트 핸들러·javascript: 계열 스킴은 제거 후 보존 (XSS)
    var htmlTags = [];
    text = text.replace(/<(\/?(kbd|br|sub|sup|abbr|mark|ins|del|span|small|em|strong|b|i|u|s|a)(\s[^>]*)?\/?)>/gi, function(m) {
      var safe = m.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
      safe = safe.replace(/\s(href|src)\s*=\s*(["']?)\s*(javascript|vbscript|data):[^"'>]*\2/gi, '');
      var ph = '\x00H' + htmlTags.length + '\x00';
      htmlTags.push(safe);
      return ph;
    });
    // 비화이트리스트 HTML 전면 이스케이프 — raw passthrough 차단 (XSS)
    text = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Images
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(m, alt, src) {
      if (_base && src.indexOf('http') !== 0 && src.charAt(0) !== '/') {
        src = imageSrc(_base + '/' + src); // 어댑터: 브라우저=/api/image, Tauri=asset protocol
      }
      return '<img src="' + escAttr(sanitizeUrl(src)) + '" alt="' + escAttr(alt) + '" loading="lazy">';
    });
    // Links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(m, t, h) {
      var safeH = escAttr(sanitizeUrl(h));
      if (h.charAt(0) === '#') return '<a href="' + safeH + '">' + t + '</a>';
      return '<a href="' + safeH + '" target="_blank" rel="noopener">' + t + '</a>';
    });
    // Auto links (\x00 placeholder 침범 방지)
    text = text.replace(/(^|[^"=])((https?:\/\/)[^\s<\x00]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    // Bold italic (*** or ___)
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
    // Bold (** or __)
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
    // Italic (* or _)
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    text = text.replace(/(?<![\w])_(.+?)_(?![\w])/g, '<em>$1</em>');
    // Strikethrough
    text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
    // Highlight
    text = text.replace(/==(.+?)==/g, '<mark>$1</mark>');
    // Footnote refs
    text = text.replace(/\[\^(\d+)\]/g, '<sup class="footnote-ref"><a href="#fn$1" id="fnref$1">[$1]</a></sup>');
    // Restore (function 형태 — 복원 문자열의 $& 등 특수 패턴 오해석 방지)
    for (var hi = 0; hi < htmlTags.length; hi++) {
      text = text.replace('\x00H' + hi + '\x00', function() { return htmlTags[hi]; });
    }
    for (var si = 0; si < spans.length; si++) {
      text = text.replace('\x00C' + si + '\x00', function() { return spans[si]; });
    }
    for (var ei = 0; ei < escapes.length; ei++) {
      text = text.replace('\x00E' + ei + '\x00', function() { return escapes[ei]; });
    }
    return text;
  }

  function buildList(listLines) {
    var html = '';
    var stack = [];

    for (var j = 0; j < listLines.length; j++) {
      var line = listLines[j];
      var cm = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.+)/);
      var um = !cm ? line.match(/^(\s*)[-*+]\s+(.+)/) : null;
      var om = (!cm && !um) ? line.match(/^(\s*)\d+\.\s+(.+)/) : null;
      if (!cm && !um && !om) continue;

      var indent = (cm || um || om)[1].length;
      var type = om ? 'ol' : 'ul';
      var content = cm ? cm[3] : (um ? um[2] : om[2]);

      // Close deeper levels
      while (stack.length > 0 && indent < stack[stack.length - 1].indent) {
        html += '</li></' + stack.pop().type + '>';
      }

      if (stack.length === 0) {
        html += '<' + type + '>';
        stack.push({ type: type, indent: indent });
      } else if (indent > stack[stack.length - 1].indent) {
        html += '<' + type + '>';
        stack.push({ type: type, indent: indent });
      } else {
        html += '</li>';
      }

      if (cm) {
        var chk = cm[2] !== ' ' ? ' checked disabled' : ' disabled';
        html += '<li class="task-list-item"><input type="checkbox"' + chk + '>' + inlineFormat(content);
      } else {
        html += '<li>' + inlineFormat(content);
      }
    }

    // Close remaining
    if (stack.length > 0) html += '</li>';
    while (stack.length > 0) {
      html += '</' + stack.pop().type + '>';
    }
    return html;
  }

  function parseFrontmatter(lines) {
    if (lines.length < 3 || lines[0].trim() !== '---') return null;
    var end = -1;
    for (var fi = 1; fi < lines.length; fi++) {
      if (lines[fi].trim() === '---') { end = fi; break; }
    }
    if (end === -1) return null;
    var pairs = [];
    for (var fj = 1; fj < end; fj++) {
      var fmMatch = lines[fj].match(/^([\w-]+):\s*(.*)/);
      if (fmMatch) pairs.push({ key: fmMatch[1], val: fmMatch[2] });
    }
    if (pairs.length === 0) return null;
    var cardHtml = '<div class="frontmatter-card">';
    for (var fk = 0; fk < pairs.length; fk++) {
      var rawVal = pairs[fk].val.trim();
      var valHtml = '';
      // Array values: ["a", "b"] or [a, b]
      var arrMatch = rawVal.match(/^\[(.*)\]$/);
      if (arrMatch) {
        var items = arrMatch[1].split(',');
        for (var ai = 0; ai < items.length; ai++) {
          var tag = items[ai].trim().replace(/^["']|["']$/g, '');
          if (tag) valHtml += '<span class="fm-tag">' + escHtml(tag) + '</span>';
        }
      } else {
        // Strip surrounding quotes
        var clean = rawVal.replace(/^["']|["']$/g, '');
        valHtml = escHtml(clean);
      }
      cardHtml += '<span class="fm-key">' + escHtml(pairs[fk].key) + '</span>'
        + '<span class="fm-val">' + valHtml + '</span>';
    }
    cardHtml += '</div>';
    return { html: cardHtml, endLine: end + 1 };
  }

  function parse(src) {
    var lines = src.split('\n');
    var html = '';
    var i = 0;

    // Frontmatter
    var fm = parseFrontmatter(lines);
    if (fm) {
      html += fm.html;
      i = fm.endLine;
    }

    while (i < lines.length) {
      var line = lines[i];

      // Code block
      var codeMatch = line.match(/^```(\w*)/);
      if (codeMatch) {
        var lang = codeMatch[1] || '';
        var code = [];
        i++;
        // 닫는 펜스는 들여쓰기 허용 (CommonMark: 최대 3칸 — 여기선 trim으로 관대하게)
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          code.push(lines[i]); i++;
        }
        i++; // skip closing
        var codeStr = code.join('\n');
        var highlighted = (lang && ['javascript','js','ts','tsx','jsx','python','py','bash','sh','json','go','rust','rs','yaml','yml','css','html','sql'].indexOf(lang) !== -1)
          ? highlightCode(codeStr, lang) : escHtml(codeStr);
        html += '<pre' + (lang ? ' data-lang="' + lang + '"' : '') + '><code>' + highlighted + '</code></pre>';
        continue;
      }

      // Math block
      if (line.trim() === '$$') {
        var math = [];
        i++;
        while (i < lines.length && lines[i].trim() !== '$$') { math.push(lines[i]); i++; }
        i++;
        var mathSrc = math.join('\n');
        if (window.katex) {
          try { html += '<div class="math-block">' + window.katex.renderToString(mathSrc, { displayMode: true, throwOnError: false }) + '</div>'; continue; }
          catch(e) { /* fall through */ }
        }
        html += '<div class="math-block"><code>' + escHtml(mathSrc) + '</code></div>';
        continue;
      }

      // Heading
      var hMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (hMatch) {
        var lvl = hMatch[1].length;
        var hid = slugify(hMatch[2]);
        html += '<h' + lvl + ' id="' + hid + '">' + inlineFormat(hMatch[2]) + '</h' + lvl + '>';
        i++; continue;
      }

      // HR
      if (line.match(/^(\*{3,}|-{3,}|_{3,})\s*$/)) {
        html += '<hr>';
        i++; continue;
      }

      // Table — 바깥 파이프만 제거 후 split (빈 내부 셀 보존, 열 밀림 방지)
      if (line.indexOf('|') !== -1 && i + 1 < lines.length && lines[i+1].match(/^\|?\s*:?-+:?\s*\|/)) {
        var splitRow = function(l) {
          return l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function(c) { return c.trim(); });
        };
        var headers = splitRow(line);
        var alignLine = splitRow(lines[i+1]).filter(function(c) { return c; });
        var aligns = alignLine.map(function(a) {
          if (a.charAt(0) === ':' && a.charAt(a.length-1) === ':') return 'center';
          if (a.charAt(a.length-1) === ':') return 'right';
          return 'left';
        });
        html += '<table><thead><tr>';
        for (var hi = 0; hi < headers.length; hi++) {
          html += '<th style="text-align:' + (aligns[hi] || 'left') + '">' + inlineFormat(headers[hi]) + '</th>';
        }
        html += '</tr></thead><tbody>';
        i += 2;
        while (i < lines.length && lines[i].indexOf('|') !== -1 && !lines[i].match(/^(\*{3,}|-{3,})/)) {
          var cells = splitRow(lines[i]);
          html += '<tr>';
          for (var ci = 0; ci < cells.length; ci++) {
            html += '<td style="text-align:' + (aligns[ci] || 'left') + '">' + inlineFormat(cells[ci]) + '</td>';
          }
          html += '</tr>';
          i++;
        }
        html += '</tbody></table>';
        continue;
      }

      // Blockquote
      if (line.match(/^>\s?/)) {
        var qlines = [];
        while (i < lines.length && (lines[i].match(/^>\s?/) || (lines[i].trim() === '' && lines[i+1] && lines[i+1].match(/^>/)))) {
          qlines.push(lines[i].replace(/^>\s?/, '')); i++;
        }
        // 인접한 non-empty 줄 사이는 <br />로 연결 (paragraph 경계는 빈 줄 유지)
        var bqSrc = '';
        for (var qi = 0; qi < qlines.length; qi++) {
          bqSrc += qlines[qi];
          if (qi < qlines.length - 1) {
            var thisEmpty = qlines[qi].trim() === '';
            var nextEmpty = qlines[qi + 1].trim() === '';
            if (!thisEmpty && !nextEmpty) {
              bqSrc += '<br />\n';
            } else {
              bqSrc += '\n';
            }
          }
        }
        html += '<blockquote>' + parse(bqSrc) + '</blockquote>';
        continue;
      }

      // List (ul, ol, checklist)
      var listCheck = line.match(/^(\s*)[-*+]\s+/) || line.match(/^(\s*)\d+\.\s+/);
      if (listCheck) {
        var listLines = [];
        while (i < lines.length) {
          var isLl = lines[i].match(/^(\s*)[-*+]\s+/) || lines[i].match(/^(\s*)\d+\.\s+/);
          if (isLl) {
            listLines.push(lines[i]); i++;
          } else if (lines[i].trim() === '' && i + 1 < lines.length) {
            var nextLl = lines[i+1].match(/^(\s*)[-*+]\s+/) || lines[i+1].match(/^(\s*)\d+\.\s+/);
            if (nextLl) { i++; }
            else break;
          } else break;
        }
        html += buildList(listLines);
        continue;
      }

      // Footnote definition
      var fnMatch = line.match(/^\[\^(\d+)\]:\s+(.+)/);
      if (fnMatch) {
        html += '<div class="footnotes"><p id="fn' + fnMatch[1] + '"><sup>' + fnMatch[1] + '</sup> ' + inlineFormat(fnMatch[2]) + ' <a href="#fnref' + fnMatch[1] + '">\u21a9</a></p></div>';
        i++; continue;
      }

      // Details/Summary block — parse inner markdown
      if (line.match(/^<details/i)) {
        var detailLines = [line];
        i++;
        while (i < lines.length && !lines[i].match(/^<\/details>/i)) {
          detailLines.push(lines[i]); i++;
        }
        if (i < lines.length) { detailLines.push(lines[i]); i++; }
        // Extract summary and inner content
        var detailStr = detailLines.join('\n');
        var sumMatch = detailStr.match(/<summary>(.*?)<\/summary>/i);
        var sumText = sumMatch ? sumMatch[1] : 'Details';
        var innerStart = detailStr.indexOf('<\/summary>');
        var innerEnd = detailStr.lastIndexOf('<\/details>');
        var innerContent = '';
        if (innerStart !== -1 && innerEnd !== -1) {
          innerContent = detailStr.substring(innerStart + 10, innerEnd).trim();
        }
        html += '<details><summary>' + inlineFormat(sumText) + '</summary>' + parse(innerContent) + '</details>';
        continue;
      }
      if (line.match(/^<\/?(summary)/i)) { i++; continue; }

      // Definition list
      if (line.match(/^:\s+/) && html.match(/<p>[^<]+<\/p>$/)) {
        var def = line.replace(/^:\s+/, '');
        html = html.replace(/<p>([^<]+)<\/p>$/, '<dt>$1</dt><dd>' + inlineFormat(def) + '</dd>');
        i++; continue;
      }

      // Empty line
      if (line.trim() === '') { i++; continue; }

      // Paragraph
      var pLines = [line];
      i++;
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].match(/^[#>|\-*\d`$<]/) && !lines[i].match(/^\[\^/) && !lines[i].match(/^\|/)) {
        pLines.push(lines[i]); i++;
      }
      html += '<p>' + inlineFormat(pLines.join(' ')) + '</p>';
    }

    return html;
  }

  return { parse: parse, setBase: function(dir) { _base = dir; } };
})();

