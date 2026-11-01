// 最小のサービスワーカー。「ホーム画面に追加」できるようにするためのもので、オフライン動作は作らない。
//
// 方針（生データの業務システムなので、古いものを見せない）
//   ・キャッシュするのは静的ファイルだけ：/_next/static/（中身が変わると名前が変わる）、/icons/、フォント。＝ cache-first
//   ・HTML・API・データ・認証関連は一切キャッシュしない。ここでは respondWith を呼ばず、常にブラウザが直接ネットから取る（network only）。
//   ・next-pwa 等の自動キャッシュは使わない（既定で過剰にキャッシュして、データが古くなるため）。
const CACHE = "sf-static-v1";
const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icons/") ||
  /\.(?:woff2?|ttf|otf)$/.test(url.pathname);

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !isStatic(url)) return; // 静的ファイル以外は触らない＝ネットから取る
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === "basic") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        }),
    ),
  );
});
