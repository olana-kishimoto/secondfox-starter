import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// 関所は2段。
// ① 入口：32桁の合言葉（このファイル）。玄関を隠し、第三者を画面に近づけない。本人確認ではない。
// ② 内側：Supabase のログイン（lib/supabase/middleware.ts）。管理者が作ったアカウントだけが入れる。
// データの分離は RLS が DB で強制する（supabase/migrations/0002_auth_rls.sql）。
//
// 環境変数（すべてサーバー専用。NEXT_PUBLIC_ を付けない）
//   ACCESS_KEYS          32桁の合言葉。カンマ区切りで複数可（「ラベル:合言葉」の形も可）。32桁でないものは無視。1本消せばその合言葉だけ即失効。
//   ACCESS_COOKIE_SECRET Cookie 署名用の長いランダム値（例：openssl rand -hex 32）。未設定なら誰も通れない。
//   ACCESS_ENABLED       "false" のときだけ①を外す（ローカル開発用。本番では設定しない）。

const KEY_LEN = 32;
const COOKIE = "sf_ea";
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 60; // 無操作60日で失効（通過のたびに貼り直す＝スライディング。端末ごと）
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: COOKIE_MAX_AGE_SEC,
};

// 機械向けの口は両方の関所を通さない。完全一致で判定する。
//   /api/health … { ok } だけ返す監視口。業務データは返さないので公開して安全。
//   /manifest.webmanifest・/sw.js・/icons/* … ホーム画面に追加するための静的ファイル。ブラウザはマニフェストを Cookie なしで取りに来るため、
//     ここを通さないと入口の合言葉で弾かれてインストールできない。業務データは含まない。
const OPEN_PATHS = new Set(["/api/health", "/manifest.webmanifest", "/sw.js"]);
const OPEN_PREFIXES = ["/icons/"];
// 自前の鍵で検証する前提の機械向けの口（Webhook・Cron）。入口の合言葉は求めない。
// ここに置いた口は、必ず口の中で署名や CRON_SECRET を確かめること（確かめないと誰でも叩ける）。
const SELF_VERIFIED_PREFIXES = ["/api/webhooks/", "/api/cron/"];
// ログイン前に開く画面。入口の合言葉は通すが、ログイン確認（updateSession）は通さない
// （通すと未ログイン→/login へ 307 で結局弾かれる）。完全一致で判定する。
const LOGIN_PATHS = new Set(["/login"]);

function validKeys(): string[] {
  return (process.env.ACCESS_KEYS ?? "")
    .split(",")
    .map((e) => { const i = e.indexOf(":"); return (i >= 0 ? e.slice(i + 1) : e).trim(); })
    .filter((k) => k.length === KEY_LEN && /^[A-Za-z0-9]+$/.test(k));
}

async function hmac(value: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
  let bin = "";
  for (let i = 0; i < sig.length; i++) bin += String.fromCharCode(sig[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// 署名済みの値が、いま有効な合言葉のどれかのものか（定数時間・早期 return しない）。
async function matches(signed: string, secret: string): Promise<boolean> {
  let ok = false;
  for (const k of validKeys()) if (sameString(signed, await hmac(k, secret))) ok = true;
  return ok;
}

// 内部パスだけ許可。「//evil.com」「/\evil.com」を弾く。
function safeNext(raw: string | null): string {
  const v = raw ?? "/";
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return "/";
  return v;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function accessPage(next: string, failed: boolean, status = 200): Response {
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><link rel="icon" href="data:,"><title>合言葉の入力</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Meiryo",system-ui,sans-serif;background:#edece7;color:#454545;display:flex;min-height:100svh;align-items:center;justify-content:center;padding:16px}
form{background:#fff;border:1px solid #e2e1db;border-radius:6px;padding:32px;width:100%;max-width:340px}
h1{font-size:12px;font-weight:600;letter-spacing:.14em;color:#8a8a86;margin-bottom:20px}
label{display:block;font-size:10px;letter-spacing:.14em;color:#8a8a86;margin-bottom:4px}
input[type=password]{display:block;width:100%;border:1px solid #e2e1db;border-radius:4px;padding:7px 12px;font-size:14px;color:#454545;outline:none;background:#fff;font-variant-numeric:tabular-nums}
input[type=password]:focus{border-color:#9a1a3c;box-shadow:0 0 0 3px rgba(154,26,60,.12)}
.e{font-size:12px;color:#9a1a3c;margin-top:8px}
button{margin-top:14px;width:100%;background:#9a1a3c;color:#fff;border:none;border-radius:4px;padding:9px 12px;font-size:13px;letter-spacing:.06em;cursor:pointer}
button:hover{background:#7a142f}
</style></head><body>
<form method="POST" action="/__access">
<input type="hidden" name="next" value="${esc(next)}">
<h1>合言葉の入力</h1>
<label for="k">合言葉（32桁）</label>
<input type="password" id="k" name="key" maxlength="64" autocomplete="off" autofocus required>
${failed ? '<p class="e">合言葉が正しくありません。</p>' : ""}
<button type="submit">次へ</button>
</form></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (OPEN_PATHS.has(pathname) || OPEN_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (SELF_VERIFIED_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const enabled = process.env.ACCESS_ENABLED !== "false";
  const secret = process.env.ACCESS_COOKIE_SECRET ?? "";

  // 合言葉の入力画面と受け口
  if (pathname === "/__access") {
    if (!enabled) return NextResponse.redirect(new URL("/", request.url));
    if (request.method === "GET") return accessPage(safeNext(request.nextUrl.searchParams.get("next")), false);
    if (request.method !== "POST") return new Response(null, { status: 405 });
    const form = new URLSearchParams(await request.text());
    const next = safeNext(form.get("next"));
    const input = (form.get("key") ?? "").trim();
    const value = secret && input.length === KEY_LEN ? await hmac(input, secret) : "";
    if (!value || !(await matches(value, secret))) {
      await new Promise((r) => setTimeout(r, 1000)); // 総当たりを遅くする
      return accessPage(next, true, 403);
    }
    const res = NextResponse.redirect(new URL(next, request.url), 303);
    res.cookies.set(COOKIE, value, cookieOptions);
    return res;
  }

  // ① 入口：署名つき Cookie があるか
  const cookieVal = request.cookies.get(COOKIE)?.value ?? "";
  const passed = !enabled || (!!secret && !!cookieVal && (await matches(cookieVal, secret)));
  if (!passed) {
    const accept = request.headers.get("accept") ?? "";
    if (request.method === "GET" && accept.includes("text/html")) {
      const url = new URL("/__access", request.url);
      url.search = "";
      url.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(url);
    }
    return new Response(null, { status: 403 });
  }

  // ② 内側：ログイン。ログイン画面は確認を通さずそのまま開く。
  const res = LOGIN_PATHS.has(pathname) ? NextResponse.next() : await updateSession(request);
  if (enabled) res.cookies.set(COOKIE, cookieVal, cookieOptions); // スライディング延長（通過のたびに貼り直す）
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf)$).*)",
  ],
};
