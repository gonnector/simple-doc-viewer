// SDV Service Worker — 최소 네트워크 fallback 캐시
// 목적: 설치 가능한 PWA 요건 충족 (fetch 핸들러 필수) + 정적 자원 오프라인 지원

const CACHE = "sdv-v1";
const ASSETS = [
  "/",
  "/public/manifest.json",
  "/public/icon-192.png",
  "/public/icon-512.png",
  "/public/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// 전략: 네트워크 우선, 실패 시 캐시 fallback (로컬 서버라 대부분 네트워크가 최신)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // 정적 자원만 캐시 갱신 (/api/* 제외)
        if (res.ok && !req.url.includes("/api/")) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || new Response("Offline", { status: 503 }))),
  );
});
