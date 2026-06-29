// CSV 파서 단위 테스트 — node scripts/dev/test-csv.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const APP = path.join(__dirname, '..', '..', 'client', 'app');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(APP, 'csv-parser.js'), 'utf8'), ctx);

let pass = 0, fail = 0;
function eq(name, got, exp) {
  const g = JSON.stringify(got), e = JSON.stringify(exp);
  if (g === e) pass++; else { fail++; console.log('FAIL [' + name + ']\n  got: ' + g + '\n  exp: ' + e); }
}
const P = (t, d) => ctx.sdvParseDelimited(t, d || ',');

eq('simple', P('a,b,c\n1,2,3'), [['a','b','c'],['1','2','3']]);
eq('quoted-comma', P('a,"b,c",d'), [['a','b,c','d']]);
eq('escaped-quote', P('a,"b""c",d'), [['a','b"c','d']]);
eq('embedded-newline', P('a,"l1\nl2",c'), [['a','l1\nl2','c']]);
eq('crlf', P('a,b\r\n1,2'), [['a','b'],['1','2']]);
eq('trailing-newline', P('a,b\n1,2\n'), [['a','b'],['1','2']]);
eq('empty-fields', P('a,,c'), [['a','','c']]);
eq('tsv', ctx.sdvParseDelimited('a\tb\tc', '\t'), [['a','b','c']]);
eq('bom', P('﻿a,b'), [['a','b']]);
eq('empty-input', P(''), []);
eq('only-newline', P('\n'), [['']]);
eq('unbalanced-row', P('a,b,c\n1,2'), [['a','b','c'],['1','2']]);
eq('numeric-col', ctx.sdvCsvColumnIsNumeric([['1'],['2'],['3,000']], 0), true);
eq('numeric-col-empty-skip', ctx.sdvCsvColumnIsNumeric([['1'],[''],['2']], 0), true);
eq('non-numeric-col', ctx.sdvCsvColumnIsNumeric([['1'],['x']], 0), false);
eq('num-parse', ctx.sdvCsvNum('3,000'), 3000);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
