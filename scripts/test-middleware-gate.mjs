// /__access POST の合言葉照合ロジックの単体テスト。
// next/server に依存するため middleware.ts を直接 import せず、照合に関わるロジックをインライン複製する。
// Run: node --no-warnings scripts/test-middleware-gate.mjs

const KEY_LEN = 32;
let pass = 0, failN = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ✓ ${m}`); } else { failN++; console.error(`  ✗ ${m}`); } };

// ---- middleware.ts から複製（変更対象のロジック）----

async function hmac(value, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
  let bin = "";
  for (let i = 0; i < sig.length; i++) bin += String.fromCharCode(sig[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function sameString(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function validKeys(accessKeys) {
  return (accessKeys ?? "")
    .split(",")
    .map((e) => { const i = e.indexOf(":"); return (i >= 0 ? e.slice(i + 1) : e).trim(); })
    .filter((k) => k.length === KEY_LEN && /^[A-Za-z0-9]+$/.test(k));
}

async function matches(signed, secret, accessKeys) {
  let matched = false;
  for (const k of validKeys(accessKeys)) if (sameString(signed, await hmac(k, secret))) matched = true;
  return matched;
}

// POST ハンドラの照合ロジック（修正後 — hmac も try の中）
async function postGate({ secret, input, accessKeys }) {
  let gateOk = false;
  let value = "";
  try {
    value = secret && input.length === KEY_LEN ? await hmac(input, secret) : "";
    if (value) gateOk = await matches(value, secret, accessKeys);
  } catch { gateOk = false; }
  return { gateOk, value };
}

// ---- テストケース ----

const SECRET = "a".repeat(64);
const VALID_KEY = "K".repeat(KEY_LEN);
const VALID_KEYS_ENV = `label:${VALID_KEY}`;

// 正常系：正しい合言葉で入室できる
let r = await postGate({ secret: SECRET, input: VALID_KEY, accessKeys: VALID_KEYS_ENV });
ok(r.gateOk === true, "正常系：正しい合言葉 → gateOk=true");

// 不一致：間違った合言葉
r = await postGate({ secret: SECRET, input: "W".repeat(KEY_LEN), accessKeys: VALID_KEYS_ENV });
ok(r.gateOk === false, "不一致：間違った合言葉 → gateOk=false");

// 署名鍵が空のとき → hmac は呼ばれず value="" → gateOk=false（例外なし）
r = await postGate({ secret: "", input: VALID_KEY, accessKeys: VALID_KEYS_ENV });
ok(r.gateOk === false && r.value === "", "署名鍵が空 → 例外なし、gateOk=false");

// 入力長が KEY_LEN 未満 → value="" → gateOk=false
r = await postGate({ secret: SECRET, input: "short", accessKeys: VALID_KEYS_ENV });
ok(r.gateOk === false && r.value === "", "入力が短い → value=\"\"、gateOk=false");

// 入力長が KEY_LEN 超 → value="" → gateOk=false
r = await postGate({ secret: SECRET, input: "X".repeat(64), accessKeys: VALID_KEYS_ENV });
ok(r.gateOk === false && r.value === "", "入力が長い（64桁）→ value=\"\"、gateOk=false");

// hmac が例外を投げるケースのシミュレーション：importKey に空の鍵を渡して DataError を発生させる
{
  let gateOk = false;
  let value = "";
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    value = "should_not_reach";
    gateOk = true;
  } catch { gateOk = false; }
  ok(gateOk === false && value === "", "crypto が例外（空鍵の DataError）→ catch が機能し gateOk=false");
}

// 合言葉なし（空のキー一覧）→ validKeys が空 → gateOk=false
r = await postGate({ secret: SECRET, input: VALID_KEY, accessKeys: "" });
ok(r.gateOk === false, "ACCESS_KEYS が未設定 → validKeys=[] → gateOk=false");

// 不正な文字を含む入力（KEY_LEN に合わせた非 ASCII）→ gateOk=false（照合不一致）
r = await postGate({ secret: SECRET, input: "あ".repeat(KEY_LEN), accessKeys: VALID_KEYS_ENV });
ok(r.gateOk === false, "非 ASCII 入力（KEY_LEN 合致）→ 照合不一致 gateOk=false");

console.log(failN ? `\n不合格 ${failN} 件` : `\n合格（${pass}項目）`);
process.exit(failN ? 1 : 0);
