// 役割による権限分離の土台：判定ヘルパー・メニューの出し分け・RLS（実際の Postgres で動かす）・既存の守りが変わっていないこと。
//   node --experimental-strip-types --no-warnings scripts/test-roles.mjs
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { ADMIN_ROLE, roleAllows, filterByRole, roleKeyProblem, isAdminRole } from "../src/lib/roles-core.ts";
let pass = 0, failN = 0;
const ok = (c, m) => { if (c) pass++; else { failN++; console.log("  ✗ " + m); } };
const rd = (p) => fs.readFileSync(p, "utf8");
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");

// ---- 判定ヘルパー ----
ok(ADMIN_ROLE === "admin" && isAdminRole("admin") && !isAdminRole("staff") && !isAdminRole(null), "admin だけが予約の特別役割");
ok(roleAllows("admin", []) && roleAllows("admin", ["sales"]) && roleAllows("staff", ["staff"]) && roleAllows("sales", ["sales", "accounting"]), "管理者は常に許される／列挙した役割は許される");
ok(!roleAllows("staff", ["sales"]) && !roleAllows(null, ["staff"]) && !roleAllows(undefined, []) && !roleAllows("", ["staff"]) && !roleAllows("staff", []), "別の役割・役割なし・空の指定は許されない（空なら管理者だけ）");
ok(roleKeyProblem("sales") === null && roleKeyProblem("a1_b") === null && ["", "A", "1a", "a", "ab-c", "あ", "x".repeat(40)].every((k) => roleKeyProblem(k)), "役割のキーの形（英小文字始まり・2〜31文字）");
const items = [{ k: "a" }, { k: "b", roles: ["staff"] }, { k: "c", roles: [] }, { k: "d", roles: ["sales"] }];
const names = (r) => filterByRole(items, r).map((x) => x.k).join("");
ok(names(null) === "a" && names("staff") === "ab" && names("sales") === "ad" && names("admin") === "abcd", "メニュー：役割なし＝共通だけ／担当者＝共通＋担当者の項目／管理者＝すべて（空の指定は管理者だけ）");

// ---- RLS：実際の Postgres（pglite）で、Supabase と同じ役割・auth.uid() の形を作って動かす ----
const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to service_role;
`);
const A = "00000000-0000-4000-8000-0000000000a1", S = "00000000-0000-4000-8000-0000000000b1", N = "00000000-0000-4000-8000-0000000000c1", S2 = "00000000-0000-4000-8000-0000000000b2";
await db.exec(`insert into auth.users values ('${A}'),('${S}'),('${N}'),('${S2}')`);
for (const f of ["0001_init.sql", "0002_auth_rls.sql", "0003_roles.sql"]) await db.exec(rd("supabase/migrations/" + f));
await db.exec(`insert into profiles (user_id, role) values ('${A}','admin'),('${S}','staff'),('${S2}','staff')`);   // N は役割なし

// 利用者として実行する。失敗（権限・RLS）は { err } で返す
async function as(who, sql) {
  await db.exec("reset role");
  if (who === "service") await db.exec("set role service_role");
  else if (who === "anon") await db.exec("set role anon");
  else { await db.exec("set role authenticated"); await db.exec(`select set_config('request.jwt.claim.sub','${who}',false)`); }
  try { const r = await db.query(sql); return { rows: r.rows, n: r.affectedRows ?? r.rows.length }; }
  catch (e) { return { err: String(e.message || e) }; }
  finally { await db.exec("reset role"); }
}
const one = async (who, sql) => (await as(who, sql)).rows?.[0] ?? null;

ok((await db.query("select key from roles order by sort")).rows.map((r) => r.key).join() === "admin,staff", "既定の種は、管理者と担当者の2つだけ（業種の役割は入れない）");
ok((await one(A, "select app_role() r, app_is_admin() a, app_has_role(array['x']) h")).a === true && (await one(A, "select app_has_role(array['x']) h")).h === true, "管理者：admin と判定され、どの役割の指定にも当たる");
const sv = await one(S, "select app_role() r, app_is_admin() a, app_has_role(array['staff']) h, app_has_role(array['sales']) h2");
ok(sv.r === "staff" && sv.a === false && sv.h === true && sv.h2 === false, "担当者：staff と判定。自分の役割に当たり、別の役割には当たらない");
const nv = await one(N, "select app_role() r, app_is_admin() a, app_has_role(array['staff']) h");
ok(nv.r === null && nv.a === false && nv.h === false, "役割なし：何にも当たらない");
ok((await as("anon", "select app_is_admin()")).err, "anon は判定関数も呼べない");

// 役割で閉じる表の見本
await as(A, "insert into sample_notes (title) values ('管理者のメモ'),('全員向け')");
ok((await as(A, "select * from sample_notes")).rows.length === 2, "管理者は全部見える");
ok((await as(S, "select * from sample_notes")).rows.length === 2, "担当者（列挙した役割）は読める");
ok((await as(N, "select * from sample_notes")).rows.length === 0, "役割なしは読めない（0件）");
ok(!!(await as("anon", "select * from sample_notes")).err, "ログインしていない（anon）は権限ごと無い");
ok(!!(await as(S, "insert into sample_notes (title) values ('x')")).err && !!(await as(N, "insert into sample_notes (title) values ('x')")).err, "担当者・役割なしは書き込めない（書けるのは管理者だけ）");
ok((await as(S, "update sample_notes set title='改ざん'")).n === 0 && (await as(S, "delete from sample_notes")).n === 0 && (await as(A, "select * from sample_notes where title='改ざん'")).rows.length === 0, "担当者は更新も削除もできない（0件）");
ok((await as(A, "update sample_notes set body='b' where title='全員向け'")).n === 1, "管理者は更新できる");
// 担当者は、管理者専用の表（他人の役割）を読めない
ok((await as(S, "select * from profiles")).rows.length === 1 && (await as(S, "select * from profiles")).rows[0].user_id === S, "担当者が読める profiles は自分の行だけ（他人の役割は読めない）");
ok((await as(A, "select * from profiles")).rows.length === 3, "管理者は全員の役割を読める");
ok((await as(N, "select * from profiles")).rows.length === 0, "役割なしは profiles に行が無い");
// 自分で役割を上げられない
ok((await as(S, "update profiles set role='admin' where user_id='" + S + "'")).n === 0 && (await one("service", "select role from profiles where user_id='" + S + "'")).role === "staff", "担当者は自分の役割を管理者に変えられない");
ok(!!(await as(N, "insert into profiles (user_id, role) values ('" + N + "','admin')")).err && !!(await as(S, "insert into profiles (user_id, role) values ('" + S2 + "','admin') on conflict (user_id) do update set role='admin'")).err, "役割なしが自分に管理者を付けられない／担当者が他人を管理者にできない");
ok((await as(S, "delete from profiles")).n === 0 && (await db.query("select count(*)::int c from profiles")).rows[0].c === 3, "担当者は役割を消せない");
// 管理者が割り当てる
ok((await as(A, "insert into profiles (user_id, role) values ('" + N + "','staff')")).n === 1 && (await as(N, "select * from sample_notes")).rows.length === 2, "管理者が役割を付けると、その利用者に見えるようになる");
ok((await as(A, "delete from profiles where user_id='" + N + "'")).n === 1 && (await as(N, "select * from sample_notes")).rows.length === 0, "管理者が役割を外すと、また見えなくなる");
ok(!!(await as(A, "insert into profiles (user_id, role) values ('" + N + "','nonexistent')")).err, "存在しない役割は付けられない");
// 役割の一覧
ok((await as(S, "select * from roles")).rows.length === 2, "ログイン済みは役割の一覧を読める");
ok(!!(await as(S, "insert into roles (key,label) values ('sales','営業')")).err && (await as(A, "insert into roles (key,label) values ('sales','営業')")).n === 1, "役割を足せるのは管理者だけ（各システムが決める）");
ok((await as(A, "update roles set label='x' where key='admin'")).n === 0 && (await as(A, "delete from roles where key='admin'")).n === 0 && !!(await as(A, "insert into roles (key,label) values ('admin','偽')")).err, "admin の行は、管理者でも変えられない");
ok(!!(await as(A, "insert into roles (key,label) values ('Bad Key','x')")).err, "役割のキーの形は DB でも守る");
await as(A, "insert into profiles (user_id, role) values ('" + N + "','sales')");
ok(!!(await as(A, "delete from roles where key='sales'")).err, "使われている役割は消せない");
await db.exec("delete from profiles where user_id='" + N + "'");
// 既存の認証・テナント分離（0002）が変わっていない
ok((await as(N, "select * from cases")).rows.length === 42 && (await as(S, "select * from customers")).rows.length === 5, "既存の業務テーブルは、これまでどおり（ログイン済みなら役割なしでも読める）");
ok(!!(await as("anon", "select * from cases")).err && !!(await as("anon", "select * from customers")).err && !!(await as("anon", "select * from profiles")).err && !!(await as("anon", "select * from roles")).err, "anon は何も読めない（既存も新しい表も）");
await as(S, "insert into search_templates (screen_key,name,params) values ('k','s-own','')");
ok((await as(S2, "select * from search_templates")).rows.length === 0 && (await as(S, "select * from search_templates")).rows.length === 1, "検索条件は利用者ごと（変わっていない）");
ok((await as("service", "select * from profiles")).rows.length === 3 && (await as("service", "insert into sample_notes (title) values ('svc')")).n === 1, "service_role は引き続き全部できる（サーバー専用）");
const before = (await db.query("select count(*)::int c from roles")).rows[0].c;
await db.exec(rd("supabase/migrations/0003_roles.sql"));
ok((await db.query("select count(*)::int c from roles")).rows[0].c === before && (await db.query("select count(*)::int c from profiles")).rows[0].c === 3, "0003 は何度流しても同じ結果（データを壊さない）");

// ---- 既存の守りを弱めていない（中身の不変条件）----
const mw = rd("src/middleware.ts");
ok(mw.includes("const KEY_LEN = 32") && mw.includes("ACCESS_COOKIE_SECRET") && mw.includes('OPEN_PATHS = new Set(["/api/health", "/manifest.webmanifest", "/sw.js"])') && mw.includes("LOGIN_PATHS"), "入口の32桁の合言葉・公開の口の完全一致は、そのまま");
const rls = rd("supabase/migrations/0002_auth_rls.sql"), init = rd("supabase/migrations/0001_init.sql");
ok(rls.includes("create policy cases_staff on cases for all to authenticated using (true)") && rls.includes("revoke all on customers, cases, search_templates from anon;") && init.includes("revoke all on customers, cases, search_templates from anon, authenticated;"), "0001・0002（RLS・GRANT）は書き換えていない");
ok(!/service_role|createAdminClient/.test(strip(rd("src/lib/roles.ts"))) && !/createAdminClient|SERVICE_ROLE/.test(strip(rd("src/app/(app)/admin/roles/actions.ts"))), "役割の判定・割り当ては、ログイン中の利用者として行う（service_role を使わない）");
// ---- サーバーで判定している ----
const act = rd("src/app/(app)/admin/roles/actions.ts"), pg = rd("src/app/(app)/admin/roles/page.tsx");
ok(/export async function setUserRole[\s\S]*?\{\s*await requireAdmin\(\);/.test(act) && /export async function addRole[\s\S]*?\{\s*await requireAdmin\(\);/.test(act) && /export default async function RolesPage[\s\S]*?\{\s*await requireAdmin\(\);/.test(pg), "役割の画面・操作は、サーバーで最初に管理者を確かめる（メニューを隠すだけにしない）");
ok(act.includes('role !== ADMIN_ROLE) back("error", "自分自身の管理者の役割は外せません') && act.includes("UUID.test(userId)"), "自分の管理者の役割は外せない・入力は検査する");
const lay = rd("src/app/(app)/layout.tsx"), rl = rd("src/lib/roles.ts");
ok(lay.includes("await currentRole()") && lay.includes("role={role}") && rd("src/components/Sidebar.tsx").includes("menuFor(role)") && rd("src/components/MobileTabBar.tsx").includes("tabsFor(role)"), "役割はレイアウトでサーバーが判定し、メニューの出し分けに渡す");
ok(rl.includes('from("profiles").select("role")') && rl.includes("if (error) return null") && rl.includes("export async function requireRole") && rl.includes("export const isAdmin") && rl.includes("export const hasRole"), "currentRole／isAdmin／hasRole／requireRole がある（失敗時は役割なし＝安全側）");
ok(rd("src/lib/menu.ts").includes('key: "roles"') && /key: "roles"[^\n]*roles: \[\]/.test(rd("src/lib/menu.ts")), "役割の画面のメニューは管理者だけ");
ok(rd("README.md").includes("役割と権限") && rd("README.md").includes("隠す＝守る"), "README に使い方（隠すだけでは守れないこと）がある");
// ---- 業種のロジックを入れない ----
const appCode = ["src/lib/roles-core.ts", "src/lib/roles.ts", "src/lib/menu.ts", "src/app/(app)/admin/roles/actions.ts", "src/app/(app)/admin/roles/page.tsx"].map((f) => strip(rd(f))).join("\n");
ok(!/accounting|sales|営業|経理/.test(appCode.replace(/例：[^"\n]*/g, "")) && !/insert into roles[^;]*(sales|accounting)/.test(strip(rd("supabase/migrations/0003_roles.sql").replace(/^--.*$/gm, ""))), "具体的な役割（営業・経理）を作り込まない（例として書くだけ）");
ok(!/環境|デプロイ|リポジトリ/.test(pg), "画面に開発用語を出さない");
console.log(failN ? `不合格（${failN}件）` : `合格（${pass}項目）`); process.exit(failN ? 1 : 0);
