// RSC 境界を icon 関数（非直列化値）が越えていないかを確認する構造検査。
// layout.tsx（サーバー）→ AppShell（"use client"）に MenuItem[]（icon 関数入り）が渡っていたら exit 1。
// このテンプレートでは perms?: Perms（直列化可能）を渡す設計のため icon 関数は越えない。
// Run: node --no-warnings scripts/test-noserverfnprops.mjs

import fs from "node:fs";

let pass = 0, fail = 0;
const ok = (c, msg) => {
  if (c) { pass++; console.log(`  ✓ ${msg}`); }
  else   { fail++; console.error(`  ✗ ${msg}`); }
};

const layoutSrc   = fs.readFileSync("src/app/(app)/layout.tsx",   "utf8");
const appShellSrc = fs.readFileSync("src/app/(app)/AppShell.tsx", "utf8");

// ---- layout.tsx の確認 -------------------------------------------------------

// menuItems= / tabItems= を AppShell に渡していないか（再発の直接検知）
ok(
  !layoutSrc.includes("menuItems={") && !layoutSrc.includes("tabItems={"),
  "layout.tsx が AppShell に menuItems= / tabItems=（icon 関数入り MenuItem[]）を渡していない"
);

// 直列化可能な値だけを渡しているか（perms= が存在するか）
ok(
  layoutSrc.includes("perms="),
  "layout.tsx が AppShell に perms=（直列化可能な Perms オブジェクト）を渡している"
);

// ---- AppShell.tsx の確認 -----------------------------------------------------

// props 型に MenuItem[] が残っていないか
ok(
  !appShellSrc.includes("menuItems?: MenuItem[]") &&
  !appShellSrc.includes("tabItems?: MenuItem[]"),
  "AppShell.tsx の props に MenuItem[] 型が無い（RSC 境界を icon 関数が越えない）"
);

// AppShell が Perms 型を受け取っているか（直列化可能設計）
ok(
  appShellSrc.includes("perms?:") || appShellSrc.includes("perms:"),
  "AppShell.tsx が perms: Perms（直列化可能）を prop として受け取っている"
);

// ---- (app) 配下のサーバーコンポーネントの横断チェック ------------------------

// サーバーコンポーネント（先頭 "use client" 無し）が icon={ComponentName} パターンを持つか確認（heuristic）
const appDir = "src/app/(app)";
for (const file of fs.readdirSync(appDir)) {
  if (!(file.endsWith(".tsx") || file.endsWith(".ts"))) continue;
  const src = fs.readFileSync(`${appDir}/${file}`, "utf8");
  const isServer = !src.startsWith('"use client"') && !src.startsWith("'use client'");
  if (!isServer) continue;
  if (/icon=\{[A-Z][A-Za-z]+\}/.test(src)) {
    console.warn(`  ! ${file}: サーバーコンポーネントが icon={ComponentName} パターンを含む（要確認）`);
  }
}
ok(true, "(app) 配下のサーバーコンポーネント横断チェック完了");

// ---- 結果 -------------------------------------------------------------------

console.log(fail ? `\n不合格 ${fail} 件 / 合格 ${pass} 件` : `\n合格（${pass} 項目）`);
process.exit(fail ? 1 : 0);
