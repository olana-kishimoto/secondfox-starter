// smoke.json の契約テスト。npm run test:smoke-contract で実行。
// 確かめること:
//   1. src/app/(app) 配下の一覧ページ（動的セグメント配下を除く page.tsx）が全部 smoke.json に載っていること
//   2. 載っているパスが実在すること（page.tsx が存在する）
//   3. create.fields のラベルがそのフォームに実在すること（<Field label="..."> で確認）
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../");
const smoke = JSON.parse(readFileSync(join(ROOT, "smoke.json"), "utf8"));

let fails = 0;
const t = (name, fn) => {
  try { fn(); console.log("  ✓ " + name); }
  catch (e) { fails++; console.log("  ✗ " + name + "\n      " + e.message); }
};

const appRoot = join(ROOT, "src/app/(app)");

// ルートの (app)/page.tsx
const rootPage = join(appRoot, "page.tsx");
const allListPaths = existsSync(rootPage) ? ["/"] : [];

function collectListPages(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    if (entry.startsWith("[")) continue; // 動的セグメント配下を除く
    const pageFile = join(full, "page.tsx");
    if (existsSync(pageFile)) {
      const rel = full.replace(appRoot, "").replace(/\\/g, "/");
      allListPaths.push(rel || "/");
    }
    collectListPages(full);
  }
}
collectListPages(appRoot);

const smokePaths = new Set(smoke.screens.map(s => s.path));

console.log("--- smoke.json: 一覧ページの網羅 ---");
for (const p of allListPaths) {
  t(`一覧ページ ${p} が smoke.json に載っている`, () => assert(smokePaths.has(p), `smoke.json に ${p} がない`));
}

console.log("--- smoke.json: パスの実在確認 ---");
for (const screen of smoke.screens) {
  const pagePath = join(appRoot, screen.path === "/" ? "" : screen.path, "page.tsx");
  t(`${screen.path} の page.tsx が存在する`, () => assert(existsSync(pagePath), `${pagePath} が存在しない`));
  if (screen.create?.path) {
    const formPath = join(appRoot, screen.create.path, "page.tsx");
    t(`${screen.create.path} の page.tsx が存在する`, () => assert(existsSync(formPath), `${formPath} が存在しない`));
  }
}

console.log("--- smoke.json: create.fields のラベル実在確認 ---");
for (const screen of smoke.screens) {
  if (!screen.create?.fields?.length) continue;
  // フォームのある .tsx ファイルを再帰的に読んでラベルを探す
  const formDir = join(appRoot, screen.create.path, "..");
  function readAllTsx(dir) {
    let content = "";
    for (const f of readdirSync(dir)) {
      const full = join(dir, f);
      if (statSync(full).isFile() && f.endsWith(".tsx")) content += readFileSync(full, "utf8");
    }
    return content;
  }
  const src = readAllTsx(formDir);
  for (const field of screen.create.fields) {
    t(`${screen.name} の create に「${field.label}」ラベルが実在する`, () =>
      assert(src.includes(`label="${field.label}"`), `「${field.label}」ラベルが ${screen.create.path} 配下にない`)
    );
  }
}

if (fails === 0) { console.log("\n全部OK"); process.exit(0); }
else { console.log(`\nNG ${fails} 件`); process.exit(1); }
