// --- Raw Text Renderer ---
function renderRaw(content, ext) {
  var lines = content.split('\n');
  var html = '';
  var langMap = { js: 'javascript', ts: 'javascript', jsx: 'javascript', tsx: 'javascript', mjs: 'javascript', cjs: 'javascript', sh: 'bash', zsh: 'bash' };
  var lang = langMap[ext] || ext;

  for (var idx = 0; idx < lines.length; idx++) {
    var escaped = escHtml(lines[idx]);

    // Syntax highlighting per language
    if (lang === 'javascript') {
      escaped = escaped.replace(/(\/\/.*$)/g, '<span class="tok-cm">$1</span>');
      escaped = escaped.replace(/(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)/g, '<span class="tok-str">$1</span>');
      escaped = escaped.replace(/\b(import|export|from|const|let|var|function|return|if|else|for|while|class|new|default|true|false|null|undefined|async|await|try|catch|throw|of|in|switch|case|break|continue|this|typeof|instanceof|void|delete|yield)\b/g, '<span class="tok-kw">$1</span>');
      escaped = escaped.replace(/\b(\d+\.?\d*)\b/g, '<span class="tok-num">$1</span>');
    } else if (lang === 'json') {
      escaped = escaped.replace(/(&quot;[^&]*?&quot;)\s*:/g, '<span class="tok-key">$1</span>:');
      escaped = escaped.replace(/:\s*(&quot;[^&]*?&quot;)/g, ': <span class="tok-str">$1</span>');
      escaped = escaped.replace(/\b(\d+\.?\d*)\b/g, '<span class="tok-num">$1</span>');
      escaped = escaped.replace(/\b(true|false|null)\b/g, '<span class="tok-kw">$1</span>');
    } else if (lang === 'yaml' || lang === 'yml') {
      escaped = escaped.replace(/(#.*$)/g, '<span class="tok-cm">$1</span>');
      escaped = escaped.replace(/^(\s*[\w][\w-]*):/gm, '<span class="tok-key">$1</span>:');
    } else if (lang === 'dockerfile') {
      escaped = escaped.replace(/(#.*$)/g, '<span class="tok-cm">$1</span>');
      escaped = escaped.replace(/^(FROM|RUN|COPY|WORKDIR|EXPOSE|CMD|ENV|ARG|ENTRYPOINT|ADD|VOLUME|USER|LABEL|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL)\b/g, '<span class="tok-kw">$1</span>');
    } else if (lang === 'python' || lang === 'py') {
      escaped = escaped.replace(/(#.*$)/g, '<span class="tok-cm">$1</span>');
      escaped = escaped.replace(/(&quot;(?:&quot;&quot;)?[^&]*?(?:&quot;&quot;)?&quot;|&#39;(?:&#39;&#39;)?[^&]*?(?:&#39;&#39;)?&#39;)/g, '<span class="tok-str">$1</span>');
      escaped = escaped.replace(/\b(def|class|return|if|elif|else|for|while|import|from|as|with|try|except|raise|in|not|and|or|is|None|True|False|self|lambda|yield|pass|break|continue|finally|global|async|await)\b/g, '<span class="tok-kw">$1</span>');
    } else if (lang === 'bash') {
      escaped = escaped.replace(/(#.*$)/g, '<span class="tok-cm">$1</span>');
      escaped = escaped.replace(/\b(echo|for|do|done|if|then|fi|else|elif|in|function|local|export|source|cd|ls|mkdir|rm|cp|mv|cat|grep|awk|sed|chmod|chown|while|case|esac)\b/g, '<span class="tok-kw">$1</span>');
    } else if (lang === 'css' || lang === 'scss' || lang === 'less') {
      escaped = escaped.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-cm">$1</span>');
      escaped = escaped.replace(/([.#][\w-]+)/g, '<span class="tok-fn">$1</span>');
      escaped = escaped.replace(/\b(\d+\.?\d*(px|em|rem|%|vh|vw|s|ms)?)\b/g, '<span class="tok-num">$1</span>');
    } else if (lang === 'html' || lang === 'htm' || lang === 'xml' || lang === 'svg') {
      escaped = escaped.replace(/(&lt;\/?[\w-]+)/g, '<span class="tok-kw">$1</span>');
      escaped = escaped.replace(/(\s[\w-]+=)(&quot;[^&]*?&quot;)/g, '$1<span class="tok-str">$2</span>');
    } else if (lang === 'sql') {
      escaped = escaped.replace(/(--.*$)/g, '<span class="tok-cm">$1</span>');
      escaped = escaped.replace(/\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|INTO|VALUES|SET|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|NULL|AS|ORDER|BY|GROUP|HAVING|LIMIT|DISTINCT|UNION|INDEX|VIEW|BEGIN|COMMIT|ROLLBACK|IN|EXISTS|BETWEEN|LIKE|IS|COUNT|SUM|AVG|MAX|MIN|CASE|WHEN|THEN|ELSE|END)\b/gi, '<span class="tok-kw">$1</span>');
    }

    html += '<div class="raw-line"><span class="line-num">' + (idx + 1) + '</span><span class="line-content">' + (escaped || ' ') + '</span></div>';
  }
  return html;
}

