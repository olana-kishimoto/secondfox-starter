// IP 許可リストの判定・信頼 IP 取得・ミドルウェアの守り。
//   node --experimental-strip-types --no-warnings scripts/test-ip-gate.mjs
import fs from "node:fs";
const { ipAllowed, parseAccessIPs, getTrustedIP } = await import("../src/lib/ipGate.ts");
let pass = 0, failN = 0;
const ok = (c, m) => { if (c) pass++; else { failN++; console.log("  ✗ " + m); } };
const rd = (p) => fs.readFileSync(p, "utf8");

// ---- ipAllowed：単一 IP ----
ok(ipAllowed("203.0.113.1", ["203.0.113.1"]), "単一 IP：一致");
ok(!ipAllowed("203.0.113.2", ["203.0.113.1"]), "単一 IP：不一致");
ok(ipAllowed("203.0.113.1", ["198.51.100.5", "203.0.113.1"]), "複数エントリ：いずれかが一致すれば true");
ok(!ipAllowed("1.2.3.4", ["203.0.113.1", "198.51.100.5"]), "複数エントリ：どれも一致しなければ false");

// ---- ipAllowed：CIDR ----
ok(ipAllowed("203.0.113.5", ["203.0.113.0/24"]), "CIDR /24：ネットワーク内のアドレスは一致");
ok(ipAllowed("203.0.113.0", ["203.0.113.0/24"]), "CIDR /24：ネットワークアドレス自体も一致");
ok(ipAllowed("203.0.113.255", ["203.0.113.0/24"]), "CIDR /24：ブロードキャストも一致");
ok(!ipAllowed("203.0.114.0", ["203.0.113.0/24"]), "CIDR /24：ネットワーク外は不一致");
ok(ipAllowed("10.0.0.1", ["10.0.0.0/8"]), "CIDR /8：一致");
ok(!ipAllowed("11.0.0.1", ["10.0.0.0/8"]), "CIDR /8：不一致");
ok(ipAllowed("192.168.1.14", ["192.168.1.0/28"]), "CIDR /28：ネットワーク内（0-15）");
ok(!ipAllowed("192.168.1.16", ["192.168.1.0/28"]), "CIDR /28：ネットワーク外（16以降）");
ok(ipAllowed("0.0.0.0", ["0.0.0.0/0"]), "CIDR /0：全て一致");
ok(ipAllowed("255.255.255.255", ["0.0.0.0/0"]), "CIDR /0：全て一致（ブロードキャスト）");
ok(ipAllowed("1.2.3.4", ["1.2.3.4/32"]), "CIDR /32：完全一致のみ");
ok(!ipAllowed("1.2.3.5", ["1.2.3.4/32"]), "CIDR /32：1ビット違えば不一致");

// ---- ipAllowed：不正な表記 ----
ok(!ipAllowed("1.2.3.4", ["not-an-ip"]), "不正な表記は無視（false）");
ok(!ipAllowed("1.2.3.4", ["256.0.0.1"]), "オクテットが255超は不正（false）");
ok(!ipAllowed("1.2.3.4", ["1.2.3.4/33"]), "プレフィックス長 33 は不正（false）");
ok(!ipAllowed("1.2.3.4", ["1.2.3.4/-1"]), "プレフィックス長 -1 は不正（false）");
ok(!ipAllowed("1.2.3.4", ["1.2.3"]), "オクテット不足は不正（false）");
ok(!ipAllowed("1.2.3.4", [""]), "空文字エントリは無視（false）");

// ---- ipAllowed：空リスト ----
ok(!ipAllowed("1.2.3.4", []), "空リストは常に false（IP 制御なしは呼び出し側が判断）");
ok(!ipAllowed(null, ["1.2.3.4"]), "IP が null なら false");
ok(!ipAllowed(undefined, ["1.2.3.4"]), "IP が undefined なら false");
ok(!ipAllowed("", ["1.2.3.4"]), "IP が空文字なら false");

// ---- parseAccessIPs ----
ok(JSON.stringify(parseAccessIPs("203.0.113.1,10.0.0.0/8")) === '["203.0.113.1","10.0.0.0/8"]', "カンマ区切りでパース");
ok(JSON.stringify(parseAccessIPs("  203.0.113.1 , 10.0.0.0/8  ")) === '["203.0.113.1","10.0.0.0/8"]', "前後の空白はトリム");
ok(JSON.stringify(parseAccessIPs("203.0.113.1,,10.0.0.0/8")) === '["203.0.113.1","10.0.0.0/8"]', "空のエントリは除外");
ok(parseAccessIPs("").length === 0, "空文字は空配列");
ok(parseAccessIPs(undefined).length === 0, "未設定（undefined）は空配列");

// ---- getTrustedIP ----
const mkReq = (headers) => ({ headers: { get: (k) => headers[k] ?? null } });
ok(getTrustedIP(mkReq({ "x-vercel-forwarded-for": "203.0.113.5" })) === "203.0.113.5", "x-vercel-forwarded-for を返す");
ok(getTrustedIP(mkReq({ "x-vercel-forwarded-for": "203.0.113.5, 10.0.0.1" })) === "203.0.113.5", "複数値のとき最初の要素");
ok(getTrustedIP(mkReq({})) === null, "ヘッダが無ければ null");
ok(getTrustedIP(mkReq({ "x-vercel-forwarded-for": "" })) === null, "ヘッダが空文字なら null");
ok(getTrustedIP(mkReq({ "x-forwarded-for": "1.2.3.4" })) === null, "x-forwarded-for は使わない（偽装可能）");

// ---- middleware の守り ----
const mw = rd("src/middleware.ts");
ok(mw.includes("getTrustedIP") && mw.includes("ipAllowed") && mw.includes("parseAccessIPs"), "ipGate の3関数を使う");
ok(!mw.includes('x-forwarded-for"') && !mw.includes("x-forwarded-for'"), "middleware が x-forwarded-for を直接読まない（偽装可能）");
ok(mw.includes("x-vercel-forwarded-for") || mw.includes("getTrustedIP"), "信頼できる IP 取得を使う（getTrustedIP 経由）");
ok(mw.includes("ACCESS_MODE") && mw.includes('"strict"'), "ACCESS_MODE=strict の分岐がある");
ok(mw.includes("ipPassthrough"), "IP 通過フラグで コードゲートを省く");
ok(mw.includes("!ipOk && mode === \"strict\"") || (mw.includes("!ipOk") && mw.includes("strict")), "strict かつ IP 不一致は拒否");
ok(mw.includes("ipPassthrough = true"), "許可 IP なら ipPassthrough を立てる");
ok(mw.includes("ipPassthrough || (!!secret"), "コードゲート：IP 素通りなら Cookie チェックを省く");
ok(mw.includes("!ipPassthrough") && mw.includes("res.cookies.set"), "IP 素通りのとき Cookie を貼らない");

// OPEN_PATHS / SELF_VERIFIED_PREFIXES は ipGate より前で return する
const before = mw.slice(0, mw.indexOf("parseAccessIPs("));
ok(before.includes("OPEN_PATHS.has(pathname)") && before.includes("SELF_VERIFIED_PREFIXES"), "機械向けパスの除外は IP ゲートより前");

// ---- lib/ipGate.ts の守り ----
const lib = rd("src/lib/ipGate.ts");
ok(lib.includes("x-vercel-forwarded-for") && !lib.includes("x-forwarded-for\""), "信頼 IP は x-vercel-forwarded-for から（x-forwarded-for は使わない）");
ok(lib.includes("ipAllowed") && lib.includes("parseAccessIPs") && lib.includes("getTrustedIP"), "3関数をエクスポート");
ok(/list\.length === 0.*false|list\.length > 0/.test(lib.replace(/\s/g, "")) || lib.includes("list.length === 0"), "空リストは false（IP 制御なし）を返す");
ok(lib.includes("~0 <<") || lib.includes("0xFFFFFFFF"), "CIDR はビットマスクで判定");
ok(!/console\./.test(lib), "ログ出力なし");

console.log(failN ? `不合格 ${failN} 件` : `合格（${pass}項目）`);
process.exit(failN ? 1 : 0);
