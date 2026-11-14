// IP 許可リストの判定（入口のセキュリティコードと二段で効かせる）。
// 環境変数
//   ACCESS_IPS   : カンマ区切りの許可 IP / CIDR（空または未設定 → IP 制御なし）
//   ACCESS_MODE  : "soft"（既定）または "strict"
//     soft   = 許可 IP なら素通り、非許可ならコードゲートへ
//     strict = 許可 IP 以外は拒否（コードでも入れない）
//
// クライアント IP の取得は x-vercel-forwarded-for を使う。
// x-forwarded-for の先頭は偽装可能なため使わない。

// IPv4 アドレスを 32 ビット符号なし整数に変換する。不正な形は null。
function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = parseInt(p, 10);
    if (isNaN(v) || v < 0 || v > 255 || String(v) !== p.trim()) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

// 単一 IP か CIDR 表記のエントリを受け取り、IP が一致するか返す。
// IPv4 CIDR：ビットマスクで判定。
// IPv6 単一アドレス：文字列の完全一致（大文字小文字を無視）。
// IPv6 CIDR：未対応 → false（安全側＝素通りさせない）。
// 不正な表記：false。
function matchEntry(ip: string, entry: string): boolean {
  const e = entry.trim();
  if (!e) return false;

  if (e.includes("/")) {
    // CIDR
    const slash = e.indexOf("/");
    const base = e.slice(0, slash);
    const bits = parseInt(e.slice(slash + 1), 10);
    const baseInt = ipv4ToInt(base);
    const ipInt = ipv4ToInt(ip);
    if (baseInt === null || ipInt === null || isNaN(bits) || bits < 0 || bits > 32) return false;
    const mask = bits === 0 ? 0 : ((~0 << (32 - bits)) >>> 0);
    return (ipInt & mask) === (baseInt & mask);
  }

  // 単一 IP
  const ipInt = ipv4ToInt(ip);
  const entInt = ipv4ToInt(e);
  if (ipInt !== null && entInt !== null) return ipInt === entInt;

  // IPv6 は文字列の完全一致（大文字小文字を無視）
  return ip.toLowerCase() === e.toLowerCase();
}

// IP が許可リストに含まれるか返す。
// list が空の場合、呼び出し側は「IP 制御なし」として扱う。
export function ipAllowed(ip: string | null | undefined, list: string[]): boolean {
  if (!ip || list.length === 0) return false;
  for (const entry of list) {
    if (matchEntry(ip, entry)) return true;
  }
  return false;
}

// ACCESS_IPS 環境変数をパースし、有効なエントリの配列にする。
// 空文字・空白のみのエントリは除外する（前後の空白はトリム）。
export function parseAccessIPs(env: string | undefined): string[] {
  if (!env) return [];
  return env.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

// リクエストから信頼できるクライアント IP を返す。
// Vercel が付与する x-vercel-forwarded-for ヘッダを使う（エンドユーザーが偽装できない）。
// ローカル・非 Vercel 環境では null になる。
export function getTrustedIP(request: { headers: { get(name: string): string | null } }): string | null {
  const v = request.headers.get("x-vercel-forwarded-for");
  if (!v) return null;
  // 複数値のとき最初の要素（Vercel は1つだが念のため）
  const ip = v.split(",")[0].trim();
  return ip || null;
}
