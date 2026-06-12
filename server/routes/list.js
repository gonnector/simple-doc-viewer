const fs = require('fs');
const path = require('path');
const state = require('../state');
const { sendJSON, sendError } = require('../respond');
const { isPathSafe, isHiddenFile } = require('../util');

function handleList(req, res, query) {
  const dirPath = (query.path || state.rootDir).replace(/\\/g, '/');
  const resolved = path.resolve(dirPath).replace(/\\/g, '/');

  if (!isPathSafe(resolved)) {
    return sendError(res, 'Access denied', 403);
  }

  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return sendError(res, 'Not a directory');
    }

    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const items = [];

    for (const entry of entries) {
      const fullPath = path.join(resolved, entry.name);
      try {
        const entryStat = fs.statSync(fullPath);
        const item = {
          name: entry.name,
          type: entry.isDirectory() ? 'dir' : 'file',
          modified: entryStat.mtime.toISOString(),
          created: entryStat.birthtime.toISOString(),
          hidden: isHiddenFile(entry.name)
        };
        if (!entry.isDirectory()) {
          item.size = entryStat.size;
        }
        items.push(item);
      } catch (e) {
        // 접근 불가 파일 무시
      }
    }

    items.sort(function (a, b) {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const parentDir = path.dirname(resolved).replace(/\\/g, '/');
    const parentSafe = (parentDir !== resolved) ? parentDir : null;
    sendJSON(res, {
      path: resolved,
      parent: parentSafe,
      items: items
    });
  } catch (e) {
    sendError(res, 'Cannot read directory: ' + e.message);
  }
}

module.exports = { handleList };
