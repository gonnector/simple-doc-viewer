// 이미지·미디어 서빙 — /api/image (전체 버퍼), /api/media (스트리밍 + Range)
const fs = require('fs');
const path = require('path');
const { sendError } = require('../respond');
const { isPathSafe } = require('../util');

const IMAGE_MIMES = {
  gif: 'image/gif', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  svg: 'image/svg+xml', webp: 'image/webp', ico: 'image/x-icon', bmp: 'image/bmp',
  tiff: 'image/tiff', tif: 'image/tiff'
};

const MEDIA_MIMES = {
  png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', svg:'image/svg+xml',
  webp:'image/webp', bmp:'image/bmp', ico:'image/x-icon', tiff:'image/tiff', tif:'image/tiff', avif:'image/avif',
  mp4:'video/mp4', webm:'video/webm', ogg:'video/ogg', mov:'video/quicktime', avi:'video/x-msvideo', mkv:'video/x-matroska',
  mp3:'audio/mpeg', wav:'audio/wav', flac:'audio/flac', aac:'audio/aac', opus:'audio/opus', wma:'audio/x-ms-wma', m4a:'audio/mp4',
  pdf:'application/pdf'
};

// 파일 스트리밍 공통 헬퍼: 스트림 에러 시 프로세스 크래시 방지 + 클라이언트 중단 시 fd 정리
function streamFileToResponse(req, res, filePath, range) {
  var stream = range ? fs.createReadStream(filePath, range) : fs.createReadStream(filePath);
  stream.on('error', function() { res.destroy(); });
  req.on('close', function() { stream.destroy(); });
  stream.pipe(res);
}

function handleImage(req, res, query) {
  if (!query.path) return sendError(res, 'Path required');
  const filePath = path.resolve(query.path).replace(/\\/g, '/');
  if (!isPathSafe(filePath)) return sendError(res, 'Access denied', 403);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = IMAGE_MIMES[ext];
  if (!mime) return sendError(res, 'Not an image file');
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime, 'Content-Length': data.length, 'Cache-Control': 'public, max-age=3600' });
    res.end(data);
  } catch (e) {
    sendError(res, 'Cannot read image: ' + e.message, 404);
  }
}

function handleMedia(req, res, query) {
  if (!query.path) return sendError(res, 'Path required');
  const filePath = path.resolve(query.path).replace(/\\/g, '/');
  if (!isPathSafe(filePath)) return sendError(res, 'Access denied', 403);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = MEDIA_MIMES[ext];
  if (!mime) return sendError(res, 'Unsupported media type');
  try {
    const stat = fs.statSync(filePath);
    const range = req.headers.range;
    if (range) {
      // Range 엄격 파싱 — 비정상 값은 416 (NaN이 createReadStream에 닿으면 동기 throw → 크래시)
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      let start, end;
      if (m && m[1] !== '') {
        start = parseInt(m[1], 10);
        end = m[2] !== '' ? parseInt(m[2], 10) : stat.size - 1;
      } else if (m && m[2] !== '') {
        // suffix range: bytes=-N (마지막 N바이트)
        start = Math.max(0, stat.size - parseInt(m[2], 10));
        end = stat.size - 1;
      } else {
        start = NaN;
      }
      if (isNaN(start) || isNaN(end) || start > end || start >= stat.size) {
        res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size });
        return res.end();
      }
      if (end >= stat.size) end = stat.size - 1;
      res.writeHead(206, { 'Content-Type': mime, 'Content-Range': 'bytes ' + start + '-' + end + '/' + stat.size, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      streamFileToResponse(req, res, filePath, { start: start, end: end });
    } else {
      res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600' });
      streamFileToResponse(req, res, filePath);
    }
  } catch (e) { sendError(res, 'Cannot read file: ' + e.message, 404); }
}

module.exports = { handleImage, handleMedia, streamFileToResponse };
