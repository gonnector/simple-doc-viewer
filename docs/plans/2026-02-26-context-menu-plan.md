# SDV 윈도우 파일탐색기 단축메뉴 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Windows 파일탐색기 우클릭 컨텍스트 메뉴에 "SDV로 읽기"를 추가하여 파일을 SDV로 바로 열 수 있게 한다.

**Architecture:** launcher.js가 서버 상태 체크 → kill → 재시작 → 로깅을 담당. sdv-open.vbs가 콘솔 창 없이 launcher.js를 호출. install-context-menu.js가 레지스트리 등록/해제를 수행.

**Tech Stack:** Node.js (내장 모듈만), VBScript, Windows Registry (HKCU)

---

## Task 1: launcher.js 작성

**Files:**
- Create: `launcher.js`

**Step 1: launcher.js 작성**

```javascript
// launcher.js — SDV 컨텍스트 메뉴 런처
// 서버 상태 확인 → kill → 재시작 → 접근 로그 기록

const http = require('http');
const path = require('path');
const fs = require('fs');
const { exec, execSync, spawn } = require('child_process');

const PORT = 3000;
const SERVER_JS = path.join(__dirname, 'server.js');
const LOG_DIR = path.join(process.env.USERPROFILE || process.env.HOME, '.sdv');
const LOG_FILE = path.join(LOG_DIR, 'access.jsonl');

const TEXT_EXTENSIONS = new Set([
  'md', 'txt', 'js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs',
  'json', 'yaml', 'yml', 'toml', 'cfg', 'ini', 'conf',
  'env', 'gitignore', 'dockerignore', 'editorconfig',
  'prettierrc', 'eslintrc', 'babelrc',
  'html', 'htm', 'css', 'scss', 'less', 'xml', 'svg',
  'sh', 'bash', 'zsh', 'fish', 'bat', 'cmd', 'ps1',
  'py', 'rb', 'java', 'c', 'cpp', 'h', 'hpp', 'cs',
  'go', 'rs', 'php', 'sql', 'r', 'swift', 'kt',
  'makefile', 'dockerfile', 'log', 'csv', 'tsv',
  'properties', 'gradle', 'lock', 'map',
  'vue', 'svelte', 'astro'
]);

const KNOWN_TEXT_FILES = new Set([
  'makefile', 'dockerfile', 'license', 'readme', 'changelog',
  'gemfile', 'rakefile', 'procfile', 'vagrantfile',
  '.gitignore', '.dockerignore', '.editorconfig', '.env',
  '.npmrc', '.yarnrc', '.nvmrc', '.prettierrc', '.eslintrc',
  '.babelrc', '.browserslistrc'
]);

// --- 로깅 ---

function writeLog(action, filePath, reason) {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  var ext = path.extname(filePath).toLowerCase();
  var entry = { ts: new Date().toISOString(), action: action, ext: ext || '(none)', path: filePath };
  if (reason) entry.reason = reason;
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}

// --- 확장자 판별 ---

function isSupported(filePath) {
  var basename = path.basename(filePath).toLowerCase();
  if (KNOWN_TEXT_FILES.has(basename)) return true;
  var ext = path.extname(filePath).slice(1).toLowerCase();
  return ext && TEXT_EXTENSIONS.has(ext);
}

// --- 포트 kill ---

function killPort(port, callback) {
  exec('netstat -ano', function(err, stdout) {
    if (err) return callback();
    var pids = new Set();
    stdout.split('\n').forEach(function(line) {
      var parts = line.trim().split(/\s+/);
      if (parts.length >= 5 && parts[3] === 'LISTENING') {
        var addrParts = parts[1].split(':');
        if (addrParts[addrParts.length - 1] === String(port)) {
          var pid = parts[4];
          if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
        }
      }
    });
    pids.forEach(function(pid) {
      try { execSync('taskkill /F /PID ' + pid, { stdio: 'ignore' }); } catch(e) {}
    });
    callback();
  });
}

// --- 서버 시작 ---

function startServer(filePath) {
  var child = spawn(process.execPath, [SERVER_JS, filePath], {
    detached: true,
    stdio: 'ignore',
    cwd: __dirname
  });
  child.unref();
}

// --- 서버 생존 체크 ---

function checkServer(callback) {
  var req = http.get('http://127.0.0.1:' + PORT + '/', function(res) {
    res.resume();
    callback(true);
  });
  req.on('error', function() { callback(false); });
  req.setTimeout(2000, function() { req.destroy(); callback(false); });
}

// --- 메인 ---

var filePath = process.argv[2];
if (!filePath) process.exit(1);

filePath = path.resolve(filePath);

if (!isSupported(filePath)) {
  writeLog('REJECT', filePath, 'unsupported');
  process.exit(0);
}

writeLog('OPEN', filePath);

checkServer(function(alive) {
  if (alive) {
    killPort(PORT, function() {
      setTimeout(function() { startServer(filePath); }, 1000);
    });
  } else {
    startServer(filePath);
  }
});
```

**Step 2: 단독 실행 테스트**

SDV 서버가 꺼져 있는 상태에서:
```bash
node launcher.js "E:/project/simple-doc-viewer/README.md"
```
Expected: SDV 서버 시작 + 브라우저 열림 + `~/.sdv/access.jsonl` 에 OPEN 로그 1줄 생성

미지원 파일로:
```bash
node launcher.js "E:/some/file.pdf"
```
Expected: 서버 시작 안 됨 + access.jsonl에 REJECT 로그 추가

**Step 3: 커밋**

```bash
git add launcher.js
git commit -m "feat: add launcher.js for context menu integration"
```

---

## Task 2: sdv-open.vbs 작성

**Files:**
- Create: `sdv-open.vbs`

**Step 1: sdv-open.vbs 작성**

```vbs
' sdv-open.vbs — 콘솔 창 없이 launcher.js 호출
Dim shell, fso, scriptDir, nodePath, launcherPath, filePath
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
launcherPath = scriptDir & "\launcher.js"
filePath = WScript.Arguments(0)
shell.Run """" & scriptDir & "\node_path.txt" & """", 0, False
' node.exe를 PATH에서 찾아 실행
shell.Run "node """ & launcherPath & """ """ & filePath & """", 0, False
```

주의: 위 VBS는 `node`가 시스템 PATH에 있다고 가정. install-context-menu.js에서 node.exe 절대경로를 사용하는 방식으로 개선 (아래 Task 3 참조).

최종 sdv-open.vbs:

```vbs
' sdv-open.vbs — 콘솔 창 없이 launcher.js 호출
Dim fso, scriptDir
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run Chr(34) & fso.BuildPath(scriptDir, "node_runner.bat") & Chr(34) & " " & Chr(34) & WScript.Arguments(0) & Chr(34), 0, False
```

실제로는 VBS → bat → node 체인보다 VBS에서 직접 node를 호출하는 게 깔끔하다. install-context-menu.js가 설치 시점에 node.exe 절대경로를 sdv-open.vbs에 기록하는 방식 채택:

**최종 결정: install-context-menu.js가 sdv-open.vbs를 생성한다** (Task 3에서 통합)

**Step 2: 커밋**

sdv-open.vbs는 Task 3에서 자동 생성되므로 .gitignore에 추가:
```bash
echo "sdv-open.vbs" >> .gitignore
git add .gitignore
git commit -m "chore: ignore generated sdv-open.vbs"
```

---

## Task 3: install-context-menu.js 작성

**Files:**
- Create: `install-context-menu.js`

**Step 1: install-context-menu.js 작성**

```javascript
// install-context-menu.js — SDV 컨텍스트 메뉴 레지스트리 등록/해제
// 사용법:
//   node install-context-menu.js            # 설치
//   node install-context-menu.js --uninstall  # 제거

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

var UNINSTALL = process.argv.includes('--uninstall');
var REG_KEY = 'HKCU\\Software\\Classes\\*\\shell\\SDV';
var NODE_EXE = process.execPath.replace(/\//g, '\\');
var SCRIPT_DIR = __dirname.replace(/\//g, '\\');
var LAUNCHER_JS = path.join(SCRIPT_DIR, 'launcher.js').replace(/\//g, '\\');
var VBS_PATH = path.join(SCRIPT_DIR, 'sdv-open.vbs').replace(/\//g, '\\');

function install() {
  // 1. sdv-open.vbs 생성 (node.exe 절대경로 포함)
  var vbs = [
    "' sdv-open.vbs — generated by install-context-menu.js",
    "' node.exe: " + NODE_EXE,
    'Dim filePath',
    'If WScript.Arguments.Count = 0 Then WScript.Quit',
    'filePath = WScript.Arguments(0)',
    'CreateObject("WScript.Shell").Run Chr(34) & "' + NODE_EXE + '" & Chr(34) & " " & Chr(34) & "' + LAUNCHER_JS + '" & Chr(34) & " " & Chr(34) & filePath & Chr(34), 0, False'
  ].join('\r\n');
  fs.writeFileSync(VBS_PATH, vbs);
  console.log('  Created: ' + VBS_PATH);

  // 2. 레지스트리 등록
  var cmdValue = 'wscript.exe "' + VBS_PATH + '" "%1"';
  try {
    execSync('reg add "' + REG_KEY + '" /ve /d "SDV로 읽기" /f', { stdio: 'pipe' });
    execSync('reg add "' + REG_KEY + '\\command" /ve /d "' + cmdValue + '" /f', { stdio: 'pipe' });
    console.log('  Registry: ' + REG_KEY + ' registered');
    console.log('');
    console.log('  Context menu "SDV로 읽기" installed successfully.');
    console.log('  Right-click any file in Explorer to use it.');
  } catch(e) {
    console.error('  Registry error: ' + e.message);
    process.exit(1);
  }
}

function uninstall() {
  // 1. 레지스트리 삭제
  try {
    execSync('reg delete "' + REG_KEY + '" /f', { stdio: 'pipe' });
    console.log('  Registry: ' + REG_KEY + ' removed');
  } catch(e) {
    console.log('  Registry key not found (already removed?)');
  }

  // 2. sdv-open.vbs 삭제
  if (fs.existsSync(VBS_PATH)) {
    fs.unlinkSync(VBS_PATH);
    console.log('  Deleted: ' + VBS_PATH);
  }

  console.log('');
  console.log('  Context menu "SDV로 읽기" uninstalled.');
}

console.log('');
if (UNINSTALL) {
  uninstall();
} else {
  install();
}
```

**Step 2: 설치 테스트**

```bash
node install-context-menu.js
```
Expected:
- `sdv-open.vbs` 파일 생성됨
- 레지스트리 `HKCU\Software\Classes\*\shell\SDV` 등록됨
- "Context menu installed successfully" 출력

확인:
```bash
reg query "HKCU\Software\Classes\*\shell\SDV" /s
```

**Step 3: 탐색기 우클릭 테스트**

1. 파일탐색기에서 아무 .md 파일 우클릭
2. "SDV로 읽기" 메뉴 확인
3. 클릭 → SDV 서버 시작 + 브라우저 열림 확인
4. `~/.sdv/access.jsonl` 에 로그 기록 확인

**Step 4: 제거 테스트**

```bash
node install-context-menu.js --uninstall
```
Expected: 레지스트리 키 삭제 + sdv-open.vbs 삭제

**Step 5: 커밋**

```bash
git add install-context-menu.js
git commit -m "feat: add install-context-menu.js for Explorer integration"
```

---

## Task 4: 문서 업데이트 + 최종 커밋

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `README_ko.md`
- Modify: `CLAUDE.md`

**Step 1: CHANGELOG.md 업데이트**

기존 최신 버전 아래에 추가:

```markdown
## [0.53] - 2026-02-26
### Added
- Windows Explorer context menu "SDV로 읽기" (right-click any file to open with SDV)
- Context menu installer/uninstaller (`install-context-menu.js`)
- Access logging to `~/.sdv/access.jsonl` for extension usage tracking
```

**Step 2: README.md / README_ko.md 에 컨텍스트 메뉴 섹션 추가**

설치 섹션 아래에 Windows Explorer 통합 안내 추가.

**Step 3: CLAUDE.md 버전 업데이트**

`현재 버전: v0.52` → `현재 버전: v0.53`

**Step 4: 커밋**

```bash
git add CHANGELOG.md README.md README_ko.md CLAUDE.md
git commit -m "docs: add context menu feature documentation (v0.53)"
```
