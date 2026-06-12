const fs = require('fs');
const path = require('path');
const https = require('https');

// 첫 실행 시 mermaid.min.js를 CDN에서 lib/로 다운로드
function downloadMermaid() {
  const libDir = path.join(__dirname, '..', 'lib');
  const mermaidPath = path.join(libDir, 'mermaid.min.js');

  if (fs.existsSync(mermaidPath)) return;

  console.log('Downloading mermaid.min.js from CDN...');
  if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });

  const cdnUrl = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';

  function download(targetUrl, redirectCount) {
    if (redirectCount > 5) {
      console.warn('Warning: Too many redirects, mermaid download failed.');
      return;
    }
    https.get(targetUrl, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, redirectCount + 1);
      }
      if (res.statusCode !== 200) {
        console.warn('Warning: Mermaid download failed (HTTP ' + res.statusCode + '). Diagrams will not render.');
        res.resume();
        return;
      }
      const ws = fs.createWriteStream(mermaidPath);
      res.pipe(ws);
      ws.on('finish', function () {
        ws.close();
        console.log('mermaid.min.js downloaded successfully.');
      });
      ws.on('error', function () {
        console.warn('Warning: Mermaid download failed. Diagrams will not render.');
        try { fs.unlinkSync(mermaidPath); } catch (e) { /* ignore */ }
      });
    }).on('error', function () {
      console.warn('Warning: Mermaid download failed (network error). Diagrams will not render.');
    });
  }

  download(cdnUrl, 0);
}

module.exports = { downloadMermaid };
