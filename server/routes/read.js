const fs = require('fs');
const path = require('path');
const { MAX_FILE_SIZE } = require('../config');
const { sendJSON, sendError } = require('../respond');
const { isPathSafe, isTextFile } = require('../util');

function handleRead(req, res, query) {
  if (!query.path) return sendError(res, 'Path required');
  const filePath = path.resolve(query.path).replace(/\\/g, '/');

  if (!isPathSafe(filePath)) {
    return sendError(res, 'Access denied', 403);
  }

  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) return sendError(res, 'Is a directory');

    const name = path.basename(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();

    if (stat.size > MAX_FILE_SIZE) {
      return sendJSON(res, {
        path: filePath, name: name, ext: ext,
        size: stat.size, content: null,
        error: 'File too large (max 1MB). Size: ' + (stat.size / 1024 / 1024).toFixed(1) + 'MB'
      });
    }

    if (!isTextFile(filePath)) {
      return sendJSON(res, {
        path: filePath, name: name, ext: ext,
        size: stat.size, content: null,
        error: 'Binary file — preview not available'
      });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    sendJSON(res, {
      path: filePath, name: name, ext: ext,
      size: stat.size, content: content
    });
  } catch (e) {
    sendError(res, 'Cannot read file: ' + e.message);
  }
}

module.exports = { handleRead };
