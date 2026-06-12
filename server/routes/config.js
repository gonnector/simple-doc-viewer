// 클라이언트 부트스트랩 설정 — 구버전의 template literal 주입 2곳(rootDir, INITIAL_FILE)을 대체
const state = require('../state');
const { sendJSON } = require('../respond');

function handleConfig(req, res) {
  sendJSON(res, {
    rootDir: state.rootDir,
    initialFile: state.initialFile
  });
}

module.exports = { handleConfig };
