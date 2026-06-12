// 런타임 가변 상태 — 모듈 간 공유 (chroot/pick-folder가 rootDir을 변경)
module.exports = {
  rootDir: process.cwd().replace(/\\/g, '/'),
  initialFile: null,
  port: 3000,
  noOpen: false
};
