// サーバ→クライアント境界で関数（icon: ComponentType）を prop として渡していないかの構造チェック。
// ビルドでは落ちない実行時エラーを事前検知する。
//   node scripts/check-boundary.mjs
import fs from "node:fs";

let failed = 0;
const fail = (msg) => { console.error("  ✗ " + msg); failed++; };

const read = (p) => fs.readFileSync(p, "utf8");

// layout.tsx が AppShell に MenuItem[] を渡していないこと（menuItems= / tabItems= が無いこと）
const layout = read("src/app/(app)/layout.tsx");
if (layout.includes("menuItems={") || layout.includes("tabItems={")) {
  fail("layout.tsx: AppShell に menuItems/tabItems（MenuItem[]、icon 関数を含む）を渡している。サーバ→クライアント境界を関数が越える。");
} else {
  console.log("  ✓ layout.tsx: AppShell に MenuItem[] を渡していない");
}

// AppShell.tsx が MenuItem[] 型の prop を持っていないこと
const shell = read("src/app/(app)/AppShell.tsx");
if (/menuItems\s*\??\s*:\s*MenuItem\[\]|tabItems\s*\??\s*:\s*MenuItem\[\]/.test(shell)) {
  fail("AppShell.tsx: menuItems/tabItems: MenuItem[] の prop がある。icon 関数を含む型はサーバから渡せない。");
} else {
  console.log("  ✓ AppShell.tsx: MenuItem[] 型の prop がない");
}

// Sidebar.tsx が perms: Perms を受け取りクライアント側でフィルタしていること
const sidebar = read("src/components/Sidebar.tsx");
if (!/perms\s*\??\s*:\s*Perms/.test(sidebar)) {
  fail("Sidebar.tsx: perms: Perms prop が見つからない。クライアント側でのフィルタが機能していない可能性がある。");
} else {
  console.log("  ✓ Sidebar.tsx: perms: Perms prop でクライアント側フィルタ");
}

// MobileTabBar.tsx が perms: Perms を受け取りクライアント側でフィルタしていること
const tabbar = read("src/components/MobileTabBar.tsx");
if (!/perms\s*\??\s*:\s*Perms/.test(tabbar)) {
  fail("MobileTabBar.tsx: perms: Perms prop が見つからない。クライアント側でのフィルタが機能していない可能性がある。");
} else {
  console.log("  ✓ MobileTabBar.tsx: perms: Perms prop でクライアント側フィルタ");
}

// Perms は Record<string, string> でシリアライズ可能（Level は文字列型）
const canFile = read("src/lib/can.ts");
if (!canFile.includes("export type Perms") || !canFile.includes("export type Level")) {
  fail("src/lib/can.ts: Perms / Level の export がない");
} else {
  console.log("  ✓ src/lib/can.ts: Perms / Level をクライアントセーフなモジュールに分離済み");
}

if (failed) {
  console.error(`\n${failed} 件の問題があります。`);
  process.exit(1);
} else {
  console.log(`\nすべて OK（${5 - failed} 項目）`);
}
