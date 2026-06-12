function sendJSON(res, data, status) {
  status = status || 200;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache'
  });
  res.end(JSON.stringify(data));
}

function sendError(res, message, status) {
  sendJSON(res, { error: message }, status || 400);
}

function handlePostBody(req, res, callback) {
  // CSRF 방어 1차: application/json 강제 — text/plain 단순 요청의 preflight 우회 차단
  var ct = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (ct !== 'application/json') {
    return sendError(res, 'Content-Type must be application/json', 415);
  }
  var body = '';
  req.on('data', function(chunk) {
    body += chunk;
    if (body.length > 1024 * 1024) req.destroy();
  });
  req.on('end', function() {
    var parsed;
    try { parsed = JSON.parse(body); }
    catch(e) { return sendError(res, 'Invalid JSON body'); }
    callback(parsed);
  });
}

module.exports = { sendJSON, sendError, handlePostBody };
