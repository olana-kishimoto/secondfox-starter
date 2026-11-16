// master/actions.ts と CustomerForm、0004 マイグレのソース構造確認。
//   node --no-warnings scripts/test-master-crud.mjs
import fs from "node:fs";

let pass = 0, failN = 0;
const ok = (c, m) => { if (c) { pass++; } else { failN++; console.log("  ✗ " + m); } };
const rd = (p) => fs.readFileSync(p, "utf8");

// ---- 0004 マイグレ ----
console.log("\n0004_master_customers.sql");
{
  const src = rd("supabase/migrations/0004_master_customers.sql");
  ok(src.includes("updated_at"), "updated_at カラム追加がある");
  ok(src.includes("customers_delete"), "customers_delete ポリシーの定義がある");
  ok(src.includes("has_level('customers', 'manage')"), "削除ポリシーは manage 権限");
  ok(src.includes("rollback") || src.includes("drop column"), "rollback 手順コメントがある");
}

// ---- master/actions.ts ----
console.log("\nmaster/actions.ts");
{
  const src = rd("src/app/(app)/master/actions.ts");
  ok(src.includes("FormState<CustomerValues>"), "FormState<CustomerValues> が使われている");
  ok(/async function createCustomer\s*\(\s*_prev/.test(src), "createCustomer が _prev: FormState を受け取る");
  ok(/async function updateCustomer\s*\(\s*id/.test(src), "updateCustomer が id を第1引数に取る");
  ok(src.includes("expected_updated_at"), "expected_updated_at を formData から読む");
  ok(src.includes(".eq(\"updated_at\", expected)"), "updated_at で楽観ロックの等値比較");
  ok(src.includes("他の端末で変更が行われました"), "競合時エラーメッセージがある");
  ok(src.includes("deleteCustomer"), "deleteCustomer が定義されている");
  ok(
    /deleteCustomer[\s\S]{0,800}data\.length === 0/.test(src),
    "deleteCustomer に 0行チェックがある",
  );
  ok(src.includes("23503"), "FK違反（案件で使われている）を別メッセージで処理");
  ok(src.includes("この顧客は案件で使われているため"), "削除不可の日本語メッセージがある");
  ok(src.includes("fieldErrors: p.fieldErrors"), "バリデーション失敗時に fieldErrors を返す");
  ok(src.includes("values: p.values"), "バリデーション失敗時に values を返す");
  ok(src.includes("formError: toUserMessage"), "DB エラー時に formError を返す");
}

// ---- master/CustomerForm.tsx ----
console.log("\nmaster/CustomerForm.tsx");
{
  const src = rd("src/app/(app)/master/CustomerForm.tsx");
  ok(src.includes("useActionState"), "useActionState を使っている");
  ok(src.includes("FormState<CustomerValues>"), "FormState<CustomerValues> を action の型に使っている");
  ok(src.includes("expectedUpdatedAt"), "expectedUpdatedAt prop がある");
  ok(src.includes("expected_updated_at"), "hidden input name=\"expected_updated_at\" がある");
  ok(src.includes("aria-invalid"), "aria-invalid がある");
  ok(src.includes("aria-describedby"), "aria-describedby がある");
  ok(src.includes("state.formError"), "formError（グローバルエラー）を表示");
  ok(src.includes("FlashMessage"), "formError は FlashMessage コンポーネントで表示");
  ok(src.includes("beforeunload"), "beforeunload 離脱ガードがある");
  ok(src.includes("state.values"), "state.values から値を復元する useEffect がある");
  ok(!src.includes("window.confirm") && !src.includes("window.alert"), "window.confirm/alert を使わない");
}

// ---- master/new/page.tsx ----
console.log("\nmaster/new/page.tsx");
{
  const src = rd("src/app/(app)/master/new/page.tsx");
  ok(src.includes("can(perms") && src.includes('"edit"'), "edit 権限チェックがある");
  ok(src.includes("createCustomer"), "createCustomer を action として渡している");
}

// ---- master/[id]/page.tsx ----
console.log("\nmaster/[id]/page.tsx");
{
  const src = rd("src/app/(app)/master/[id]/page.tsx");
  ok(src.includes("updated_at"), "select に updated_at が含まれる");
  ok(src.includes("expectedUpdatedAt"), "expectedUpdatedAt prop を渡している");
  ok(src.includes("updateCustomer(c.id, prev, formData)"), "updateCustomer を (id, prev, formData) で呼んでいる");
  ok(src.includes("canManage"), "canManage prop を渡している");
}

// ---- master/page.tsx ----
console.log("\nmaster/page.tsx");
{
  const src = rd("src/app/(app)/master/page.tsx");
  ok(src.includes("canEdit"), "canEdit による登録ボタン出し分けがある");
  ok(src.includes("/master/new"), "登録ページへのリンクがある");
  ok(src.includes("/master/${c.id}") || src.includes("`/master/${c.id}`"), "行が詳細ページへのリンクになっている");
  ok(src.includes("FlashMessage"), "FlashMessage で msg/error を表示");
  ok(src.includes("sp.msg"), "msg を searchParams から読む");
  ok(src.includes("sp.error"), "error を searchParams から読む");
}

// ---- 結果 ----
console.log(`\n${pass + failN} 項目のうち ${pass} 合格、${failN} 失敗\n`);
if (failN > 0) process.exit(1);
