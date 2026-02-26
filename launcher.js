// ============================================================
// SDV Launcher — launcher.js
// CLI 파일 인자를 받아 확장자 검증 후 SDV 서버를 (재)시작하는 런처
// Node.js 내장 모듈만 사용, npm 의존성 없음
// ============================================================

const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, exec, execSync } = require('child_process');

// === 설정 ===
const PORT = 3000;
const SERVER_JS = path.join(__dirname, 'server.js');
const LOG_DIR = path.join(os.homedir(), '.sdv');
const LOG_FILE = path.join(LOG_DIR, 'access.jsonl');

// === 지원 확장자 (server.js 와 동일) ===
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

// === 유틸리티 함수 ===

function isTextFile(filePath) {
  var base = path.basename(filePath).toLowerCase();
  if (KNOWN_TEXT_FILES.has(base)) return true;
  var ext = path.extname(filePath).slice(1).toLowerCase();
  if (!ext) return false;
  return TEXT_EXTENSIONS.has(ext);
}

function getExt(filePath) {
  var ext = path.extname(filePath).toLowerCase();
  return ext || '';
}

function appendLog(entry) {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (e) {
    // 로그 기록 실패는 무시 — 런처 동작에 영향 없음
  }
}

function logOpen(filePath, ext) {
  appendLog({
    ts: new Date().toISOString(),
    action: 'OPEN',
    ext: ext,
    path: filePath
  });
}

function logReject(filePath, ext, reason) {
  appendLog({
    ts: new Date().toISOString(),
    action: 'REJECT',
    ext: ext,
    path: filePath,
    reason: reason
  });
}

// === 포트 점유 프로세스 종료 (server.js findAndKillPort 패턴) ===

function findAndKillPort(port, callback) {
  if (process.platform === 'win32') {
    exec('netstat -ano', function (err, stdout) {
      if (err) return callback(false);
      var pids = new Set();
      stdout.split('\n').forEach(function (line) {
        var parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[3] === 'LISTENING') {
          var addrParts = parts[1].split(':');
          if (addrParts[addrParts.length - 1] === String(port)) {
            var pid = parts[4];
            if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
          }
        }
      });
      if (pids.size === 0) return callback(false);
      pids.forEach(function (pid) {
        try { execSync('taskkill /F /PID ' + pid, { stdio: 'ignore' }); } catch (e) {}
      });
      callback(true);
    });
  } else {
    exec('lsof -ti :' + port, function (err, stdout) {
      if (err || !stdout.trim()) return callback(false);
      stdout.trim().split('\n').forEach(function (pid) {
        try { execSync('kill -9 ' + pid); } catch (e) {}
      });
      callback(true);
    });
  }
}

// === 서버 시작 ===

function startServer(filePath) {
  var child = spawn(process.execPath, [SERVER_JS, filePath], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
}

// === 서버 alive 체크 ===

function checkServerAlive(callback) {
  var req = http.get('http://127.0.0.1:' + PORT + '/', function (res) {
    // 응답이 오면 서버가 살아있음
    res.resume(); // 데이터 소비하여 연결 정리
    callback(true);
  });
  req.on('error', function () {
    callback(false);
  });
  req.setTimeout(2000, function () {
    req.destroy();
    callback(false);
  });
}

// === 메인 ===

function main() {
  var rawPath = process.argv[2];

  if (!rawPath) {
    console.error('Usage: node launcher.js <file-path>');
    process.exit(1);
  }

  var filePath = path.resolve(rawPath);
  var ext = getExt(filePath);

  // 파일 존재 여부 확인
  if (!fs.existsSync(filePath)) {
    console.error('File not found: ' + filePath);
    logReject(filePath, ext, 'not_found');
    process.exit(1);
  }

  // 확장자 검증
  if (!isTextFile(filePath)) {
    console.error('Unsupported file type: ' + ext + ' (' + filePath + ')');
    logReject(filePath, ext, 'unsupported');
    process.exit(1);
  }

  // 지원되는 파일 — OPEN 로그
  logOpen(filePath, ext);

  // 서버 alive 체크 후 시작
  checkServerAlive(function (alive) {
    if (alive) {
      // 기존 서버가 살아있으면 종료 후 재시작
      findAndKillPort(PORT, function (killed) {
        setTimeout(function () {
          startServer(filePath);
        }, 1000);
      });
    } else {
      // 서버가 없으면 바로 시작
      startServer(filePath);
    }
  });
}

main();
