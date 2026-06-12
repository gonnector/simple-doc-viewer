const fs = require('fs');
const path = require('path');
const state = require('../state');
const { TEXT_EXTENSIONS, KNOWN_TEXT_FILES, MAX_FILE_SIZE } = require('../config');
const { sendJSON, sendError } = require('../respond');
const { isPathSafe, isHiddenFile } = require('../util');

// --- 검색 유틸 (AND/OR 쿼리: 콤마·파이프 = OR, 공백·& = AND) ---
function parseSearchQuery(q) {
  var orGroups = q.split(/[,|]/).map(function(g) { return g.trim(); }).filter(Boolean);
  return orGroups.map(function(group) {
    return group.split(/[\s&]+/).map(function(t) { return t.trim().toLowerCase(); }).filter(Boolean);
  });
}

function countOccurrences(text, parsedQuery) {
  var lower = text.toLowerCase();
  var count = 0;
  for (var i = 0; i < parsedQuery.length; i++) {
    for (var j = 0; j < parsedQuery[i].length; j++) {
      var term = parsedQuery[i][j];
      var pos = 0;
      while (true) {
        var idx = lower.indexOf(term, pos);
        if (idx === -1) break;
        count++;
        pos = idx + 1;
      }
    }
  }
  return count;
}

function matchesQuery(text, parsedQuery) {
  var lower = text.toLowerCase();
  for (var i = 0; i < parsedQuery.length; i++) {
    var andGroup = parsedQuery[i];
    var allMatch = true;
    for (var j = 0; j < andGroup.length; j++) {
      if (lower.indexOf(andGroup[j]) === -1) { allMatch = false; break; }
    }
    if (allMatch) return true;
  }
  return false;
}

function extractSnippet(content, parsedQuery, maxLen) {
  maxLen = maxLen || 80;
  var lower = content.toLowerCase();
  var bestPos = -1;
  for (var i = 0; i < parsedQuery.length; i++) {
    for (var j = 0; j < parsedQuery[i].length; j++) {
      var pos = lower.indexOf(parsedQuery[i][j]);
      if (pos !== -1 && (bestPos === -1 || pos < bestPos)) bestPos = pos;
    }
  }
  if (bestPos === -1) return '';
  var lineStart = content.lastIndexOf('\n', bestPos) + 1;
  var lineEnd = content.indexOf('\n', bestPos);
  if (lineEnd === -1) lineEnd = content.length;
  var line = content.substring(lineStart, lineEnd).trim();
  if (line.length > maxLen) {
    var start = Math.max(0, bestPos - lineStart - 30);
    line = (start > 0 ? '...' : '') + line.substring(start, start + maxLen) + '...';
  }
  return line;
}

// 검색 콘텐츠 캐시 — mtime+size 불변이면 재읽기 생략 (debounce 타이핑 중 반복 쿼리가
// 매번 디렉토리 전 파일을 full re-read하던 비용을 stat 1회로 축소)
var contentCache = new Map();
var CONTENT_CACHE_MAX = 2000;

function getCachedContent(fullPath, stat) {
  var hit = contentCache.get(fullPath);
  if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) return hit.content;
  var content = fs.readFileSync(fullPath, 'utf-8');
  if (contentCache.size >= CONTENT_CACHE_MAX) contentCache.clear();
  contentCache.set(fullPath, { mtimeMs: stat.mtimeMs, size: stat.size, content: content });
  return content;
}

function handleSearch(req, res, query) {
  var dirPath = (query.path || state.rootDir).replace(/\\/g, '/');
  var q = (query.q || '').trim();
  if (!q) return sendJSON(res, { results: [] });
  var resolved = path.resolve(dirPath).replace(/\\/g, '/');
  if (!isPathSafe(resolved)) return sendError(res, 'Access denied', 403);
  var parsedQ = parseSearchQuery(q);
  var results = [];
  try {
    var entries = fs.readdirSync(resolved, { withFileTypes: true });
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (entry.isDirectory()) continue;
      var fullPath = path.join(resolved, entry.name).replace(/\\/g, '/');
      var nameMatch = matchesQuery(entry.name, parsedQ);
      var contentMatch = false;
      var snippet = '';
      var ext = path.extname(entry.name).slice(1).toLowerCase();
      var content;
      var entryStat;
      try { entryStat = fs.statSync(fullPath); } catch(e) { continue; }
      if (TEXT_EXTENSIONS.has(ext) || KNOWN_TEXT_FILES.has(entry.name.toLowerCase())) {
        try {
          if (entryStat.size <= MAX_FILE_SIZE) {
            content = getCachedContent(fullPath, entryStat);
            contentMatch = matchesQuery(content, parsedQ);
            if (contentMatch) snippet = extractSnippet(content, parsedQ);
          }
        } catch(e) { /* skip */ }
      }
      if (nameMatch || contentMatch) {
        var nameMatchCount = countOccurrences(entry.name, parsedQ);
        var contentMatchCount = contentMatch ? countOccurrences(content || '', parsedQ) : 0;
        results.push({
          name: entry.name, type: 'file', size: entryStat.size,
          modified: entryStat.mtime.toISOString(),
          created: entryStat.birthtime.toISOString(),
          hidden: isHiddenFile(entry.name),
          matchType: nameMatch && contentMatch ? 'both' : (nameMatch ? 'name' : 'content'),
          snippet: snippet,
          nameMatchCount: nameMatchCount,
          contentMatchCount: contentMatchCount,
          matchCount: nameMatchCount + contentMatchCount
        });
      }
    }
    sendJSON(res, { path: resolved, results: results });
  } catch(e) { sendError(res, 'Search failed: ' + e.message); }
}

module.exports = { handleSearch };
