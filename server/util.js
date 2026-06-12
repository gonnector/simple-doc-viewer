const fs = require('fs');
const path = require('path');
const { TEXT_EXTENSIONS, KNOWN_TEXT_FILES, HIDDEN_NAMES } = require('./config');
const state = require('./state');

function isTextFile(filePath) {
  const base = path.basename(filePath).toLowerCase();
  if (KNOWN_TEXT_FILES.has(base)) return true;
  const ext = path.extname(filePath).slice(1).toLowerCase();
  if (!ext) return false;
  return TEXT_EXTENSIONS.has(ext);
}

function normalizePathForCompare(p) {
  var n = p.replace(/\\/g, '/');
  if (process.platform === 'win32') n = n.toLowerCase();
  return n;
}

// 요청 경로가 현재 rootDir 안에 있는지 검증 (symlink 우회 방지를 위해 realpath 기준).
// 아직 존재하지 않는 경로(rename 대상 등)는 부모 디렉토리의 realpath + leaf 이름으로 검증.
// rootDir 확장은 /api/chroot(POST, Origin 검증)만이 유일한 통로.
function isPathSafe(p) {
  try {
    var target = path.resolve(p);
    var real;
    try {
      real = fs.realpathSync(target);
    } catch (e) {
      real = path.join(fs.realpathSync(path.dirname(target)), path.basename(target));
    }
    var root = fs.realpathSync(state.rootDir);
    var a = normalizePathForCompare(real);
    var b = normalizePathForCompare(root);
    if (a === b) return true;
    return a.startsWith(b.endsWith('/') ? b : b + '/');
  } catch (e) {
    return false;
  }
}

function isHiddenFile(name) {
  return name.startsWith('.') || HIDDEN_NAMES.has(name);
}

module.exports = { isTextFile, isPathSafe, isHiddenFile, normalizePathForCompare };
