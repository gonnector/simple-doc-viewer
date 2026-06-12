// 루트 변경 (drag-drop·path badge·루트 밖 탐색용)
// 상태 변경 엔드포인트 — POST 전용 (라우터에서 강제), CSRF는 Origin/Host 검증으로 차단
const fs = require('fs');
const path = require('path');
const state = require('../state');
const { sendJSON, sendError } = require('../respond');

function handleChroot(req, res, body) {
  if (!body.path) return sendError(res, 'Path required');
  const newRoot = path.resolve(body.path).replace(/\\/g, '/');
  try {
    if (!fs.statSync(newRoot).isDirectory()) return sendError(res, 'Not a directory');
    state.rootDir = newRoot;
    sendJSON(res, { root: state.rootDir });
  } catch(e) {
    sendError(res, 'Directory not found: ' + e.message, 404);
  }
}

module.exports = { handleChroot };
