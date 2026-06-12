// 파일 관리 API — rename / delete (상태 변경: POST 전용, Origin 게이트 + JSON 강제 전제)
const fs = require('fs');
const path = require('path');
const { sendJSON, sendError } = require('../respond');
const { isPathSafe } = require('../util');

function handleRename(req, res, body) {
  if (!body.oldPath || !body.newPath) return sendError(res, 'oldPath and newPath required');
  var oldP = path.resolve(body.oldPath).replace(/\\/g, '/');
  var newP = path.resolve(body.newPath).replace(/\\/g, '/');
  if (!isPathSafe(oldP) || !isPathSafe(newP)) return sendError(res, 'Access denied', 403);
  if (!fs.existsSync(oldP)) return sendError(res, 'File not found', 404);
  if (fs.existsSync(newP)) return sendError(res, 'Target already exists', 409);
  try { fs.renameSync(oldP, newP); sendJSON(res, { ok: true, oldPath: oldP, newPath: newP }); }
  catch(e) { sendError(res, 'Rename failed: ' + e.message); }
}

function handleDelete(req, res, body) {
  if (!body.path) return sendError(res, 'path required');
  var dp = path.resolve(body.path).replace(/\\/g, '/');
  if (!isPathSafe(dp)) return sendError(res, 'Access denied', 403);
  if (!fs.existsSync(dp)) return sendError(res, 'File not found', 404);
  try {
    var st = fs.statSync(dp);
    if (st.isDirectory()) { fs.rmSync(dp, { recursive: true }); }
    else { fs.unlinkSync(dp); }
    sendJSON(res, { ok: true, path: dp });
  } catch(e) { sendError(res, 'Delete failed: ' + e.message); }
}

module.exports = { handleRename, handleDelete };
