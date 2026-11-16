// CaseForm の ActionState 返し・楽観ロック・0行チェックのソース構造確認。
//   node --no-warnings scripts/test-caseform-state.mjs
import fs from "node:fs";

let pass = 0, failN = 0;
const ok = (c, m) => { if (c) { pass++; } else { failN++; console.log("  ✗ " + m); } };
const rd = (p) => fs.readFileSync(p, "utf8");

// ---- form-state.ts ----
console.log("\nform-state.ts");
{
  const src = rd("src/lib/form-state.ts");
  ok(src.includes("FormState"), "FormState が export されている");
  ok(src.includes("fieldErrors"), "fieldErrors フィールドがある");
  ok(src.includes("formError"), "formError フィールドがある");
  ok(src.includes("values"), "values フィールドがある");
}

// ---- actions.ts ----
console.log("\nactions.ts");
{
  const src = rd("src/app/(app)/cases/actions.ts");

  // createCase は FormState を返す
  ok(src.includes("FormState<CaseValues>"), "FormState<CaseValues> が使われている");
  ok(/async function createCase\s*\(\s*_prev/.test(src), "createCase は _prev: FormState を受け取る");
  ok(/async function updateCase\s*\(\s*id/.test(src), "updateCase は id を第1引数に取る");
  ok(src.includes("_prev: FormState<CaseValues>"), "updateCase も _prev を受け取る");

  // 楽観ロック
  ok(src.includes("expected_updated_at"), "expected_updated_at を formData から読む");
  ok(src.includes(".eq(\"updated_at\", expected)"), "updated_at で楽観ロックの等値比較");
  ok(src.includes("他の端末で変更が行われました"), "競合時のエラーメッセージがある");

  // 0行チェック — setCaseStatus
  ok(
    /setCaseStatus[\s\S]{0,500}data\.length === 0/.test(src),
    "setCaseStatus に 0行チェックがある",
  );

  // 0行チェック — deleteCase
  ok(
    /deleteCase[\s\S]{0,500}data\.length === 0/.test(src),
    "deleteCase に 0行チェックがある",
  );

  // fieldErrors を返す
  ok(src.includes("fieldErrors: p.fieldErrors"), "バリデーション失敗時に fieldErrors を返す");
  ok(src.includes("values: p.values"), "バリデーション失敗時に values を返す");

  // formError を返す
  ok(src.includes("formError: toUserMessage"), "DB エラー時に formError を返す");
}

// ---- CaseForm.tsx ----
console.log("\nCaseForm.tsx");
{
  const src = rd("src/app/(app)/cases/CaseForm.tsx");

  ok(src.includes("useActionState"), "useActionState を使っている");
  ok(src.includes("FormState<CaseValues>"), "FormState<CaseValues> を action の型に使っている");
  ok(src.includes("expectedUpdatedAt"), "expectedUpdatedAt prop がある");
  ok(src.includes("expected_updated_at"), "hidden input name=\"expected_updated_at\" がある");

  // aria 属性
  ok(src.includes("aria-invalid"), "aria-invalid がある");
  ok(src.includes("aria-describedby"), "aria-describedby がある");

  // エラー表示
  ok(src.includes("fe.title"), "title のフィールドエラーを表示");
  ok(src.includes("fe.status"), "status のフィールドエラーを表示");
  ok(src.includes("fe.amount"), "amount のフィールドエラーを表示");
  ok(src.includes("fe.due_date"), "due_date のフィールドエラーを表示");
  ok(src.includes("state.formError"), "formError（グローバルエラー）を表示");

  // 離脱ガード
  ok(src.includes("beforeunload"), "beforeunload 離脱ガードがある");
  ok(src.includes("dirty"), "dirty フラグがある");

  // 入力保持の useEffect
  ok(src.includes("state.values"), "state.values から値を復元する useEffect がある");

  // window.confirm/alert を使わない
  ok(!src.includes("window.confirm") && !src.includes("window.alert"), "window.confirm/alert を使わない");
}

// ---- cases/[id]/page.tsx ----
console.log("\ncases/[id]/page.tsx");
{
  const src = rd("src/app/(app)/cases/[id]/page.tsx");
  ok(src.includes("updated_at"), "select に updated_at が含まれる");
  ok(src.includes("expectedUpdatedAt"), "expectedUpdatedAt prop を CaseForm に渡している");
  ok(src.includes("updateCase(c.id, prev, formData)"), "updateCase を (id, prev, formData) で呼んでいる");
}

// ---- cases/new/page.tsx ----
console.log("\ncases/new/page.tsx");
{
  const src = rd("src/app/(app)/cases/new/page.tsx");
  ok(!src.includes("searchParams"), "searchParams への依存がない");
  ok(!src.includes("FlashMessage"), "FlashMessage の ?error= 依存がない");
  ok(src.includes("createCase"), "createCase を action として渡している");
}

// ---- 結果 ----
console.log(`\n${pass + failN} 項目のうち ${pass} 合格、${failN} 失敗\n`);
if (failN > 0) process.exit(1);
