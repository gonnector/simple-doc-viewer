// OS 네이티브 폴더 피커 — Windows: IFileDialog(PS1), macOS: osascript, Linux: zenity/kdialog
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const state = require('../state');
const { sendJSON, sendError } = require('../respond');

// PS1 소스는 server/pick-folder.ps1 실제 파일 (구버전은 JS 문자열 배열 임베딩 + temp 복사였음)
const WIN_PICK_FOLDER_PS1_PATH = path.join(__dirname, '..', 'pick-folder.ps1');

function handlePickFolder(req, res) {
  // 명령 주입 방어: 셸 문자열 조립 금지 — execFile 인자 배열만 사용
  // timeout은 orphan PS 프로세스 방지용 안전망 — 10분 (2분이었을 때 다이얼로그가 저절로 닫히는 문제)
  var opts = { timeout: 600000, encoding: 'utf8' };

  function onPicked(err, stdout) {
    var selected = (stdout || '').trim().replace(/\\/g, '/').replace(/\/+$/, '');
    if (!selected) return sendJSON(res, { cancelled: true });
    try {
      if (!fs.statSync(selected).isDirectory()) return sendError(res, 'Not a directory');
      state.rootDir = selected;
      sendJSON(res, { root: state.rootDir });
    } catch(e) { sendError(res, 'Directory not found: ' + e.message, 404); }
  }

  if (process.platform === 'win32') {
    var initPath = state.rootDir.replace(/\//g, '\\');
    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-STA', '-File', WIN_PICK_FOLDER_PS1_PATH, '-InitialPath', initPath], opts, onPicked);
  } else if (process.platform === 'darwin') {
    // AppleScript 리터럴 내부 삽입이므로 " 와 \ 를 AppleScript 규칙으로 이스케이프
    var asPath = state.rootDir.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    execFile('osascript', [
      '-e', 'set f to choose folder with prompt "Select folder" default location POSIX file "' + asPath + '"',
      '-e', 'POSIX path of f'
    ], opts, onPicked);
  } else {
    execFile('zenity', ['--file-selection', '--directory', '--filename=' + state.rootDir + '/'], opts, function(err, stdout) {
      if (err && !(stdout || '').trim()) {
        // zenity 부재/취소 → kdialog 폴백
        execFile('kdialog', ['--getexistingdirectory', state.rootDir], opts, onPicked);
        return;
      }
      onPicked(err, stdout);
    });
  }
}

module.exports = { handlePickFolder };
