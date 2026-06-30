// 마크다운 파서 단위 테스트 — Node VM에서 client/app/markdown.js 직접 로드
// 사용: node scripts/dev/test-markdown.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.join(__dirname, '..', '..', 'client', 'app');
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, 'helpers.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(APP, 'markdown.js'), 'utf8'), ctx);

const md = ctx.md;
let pass = 0, fail = 0;
function t(name, input, mustContain, mustNotContain) {
  const out = md.parse(input);
  let ok = true;
  for (const m of (mustContain || [])) if (out.indexOf(m) === -1) { ok = false; console.log('FAIL [' + name + '] missing: ' + JSON.stringify(m) + '\n  got: ' + out.slice(0, 200)); }
  for (const m of (mustNotContain || [])) if (out.indexOf(m) !== -1) { ok = false; console.log('FAIL [' + name + '] contains forbidden: ' + JSON.stringify(m) + '\n  got: ' + out.slice(0, 200)); }
  ok ? pass++ : fail++;
}

// === XSS 방어 ===
// 따옴표 탈출(attribute breakout)이 실제 공격 벡터 — escAttr로 &quot; 처리돼야 함
t('xss-img-onerror', '![x](x" onerror="alert(1))', ['src="x&quot; onerror=&quot;alert(1"'], ['" onerror="alert']);
t('xss-link-js-scheme', '[c](javascript:alert(1))', ['href="#"'], ['javascript:alert']);
t('xss-link-quote-breakout', '[x](" onmouseover=alert(1) ")', [], ['onmouseover=alert(1) "']);
t('xss-raw-script', 'hello <script>alert(1)</script> world', ['&lt;script&gt;'], ['<script>']);
t('xss-raw-img', 'x <img src=x onerror=alert(1)> y', ['&lt;img'], ['<img src=x']);
t('xss-whitelist-onattr', 'x <a href="http://a.com" onmouseover=alert(1)>l</a> y', ['<a href="http://a.com"'], ['onmouseover']);
t('xss-whitelist-jshref', 'x <a href="javascript:alert(1)">l</a> y', ['<a'], ['javascript:']);
t('xss-summary', '<details><summary><img src=x onerror=alert(1)></summary>\nbody\n</details>', ['&lt;img'], ['<img src=x']);

// === 정상 동작 보존 ===
t('legit-bold', '**bold** normal', ['<strong>bold</strong>']);
t('legit-link', '[text](https://example.com)', ['<a href="https://example.com"', '>text</a>']);
t('legit-image', '![alt](https://example.com/a.png)', ['<img src="https://example.com/a.png" alt="alt"']);
t('legit-kbd', 'press <kbd>Ctrl</kbd> now', ['<kbd>Ctrl</kbd>']);
t('legit-br', 'line<br>break', ['<br>']);
t('legit-code-html', 'use `<div>` tag', ['<code>&lt;div&gt;</code>']);
t('legit-code-amp', 'code `a && b` here', ['<code>a &amp;&amp; b</code>']);
t('legit-lt-text', 'if a < b then', ['a &lt; b']);
t('legit-heading', '# Title', ['<h1', '>Title</h1>']);
t('legit-autolink', 'see https://example.com/x now', ['<a href="https://example.com/x"']);
t('legit-details', '<details><summary>**More**</summary>\ninner *text*\n</details>', ['<details><summary><strong>More</strong></summary>', '<em>text</em>']);
t('legit-dollar-code', 'price `$&` here', ['<code>$&amp;</code>']);

// === BUG-3: 테이블 빈 셀 ===
t('table-empty-cell', '| A | B | C |\n|---|---|---|\n| 1 |  | 3 |',
  ['<td style="text-align:left">1</td><td style="text-align:left"></td><td style="text-align:left">3</td>']);
t('table-normal', '| A | B |\n|---|---|\n| 1 | 2 |', ['<th style="text-align:left">A</th>', '<td style="text-align:left">2</td>']);
t('table-align', '| A | B |\n|:-:|--:|\n| 1 | 2 |', ['text-align:center', 'text-align:right']);

// === BUG-8: 들여쓰기 닫는 펜스 ===
t('fence-indented-close', '```\ncode\n  ```\nafter text', ['<p>after text</p>']);
t('fence-normal', '```js\nvar x = 1;\n```\nafter', ['data-lang="js"', '<p>after</p>']);

// === 회귀: 각주·체크리스트·인용 ===
t('footnote', 'text[^1]\n\n[^1]: note', ['footnote-ref', 'fn1']);
t('checklist', '- [x] done\n- [ ] todo', ['checked disabled', 'task-list-item']);
t('blockquote', '> quoted', ['<blockquote>']);

// === frontmatter (인라인 배지 + related 멀티라인 불릿 + XSS) ===
t('fm-scalar', '---\ntitle: Hello World\n---\n\nbody', ['fm-key', 'Hello World']);
t('fm-tags-inline-badge', '---\ntags: [kt, poc]\n---\n\nbody', ['fm-tag', 'kt', 'poc']);
t('fm-related-block-bullet', '---\nrelated:\n  - doc-a.md\n  - doc-b.md\n---\n\nbody', ['fm-list', '<li>doc-a.md</li>', '<li>doc-b.md</li>']);
t('fm-related-block-xss', '---\nrelated:\n  - <img src=x onerror=alert(1)>\n---\n\nbody', ['&lt;img'], ['<img src=x']);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
