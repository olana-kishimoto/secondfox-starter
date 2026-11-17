/**
 * scripts/test-rls.mjs
 * RLS 否定テスト（screen-contract.md C-1）。
 * pglite で使い捨て DB を立て、全マイグレーションを適用後、
 * anon / 担当者 / 管理者の操作可否を機械で検証する。
 * Docker 不要。supabase ローカルスタック上でも同じスクリプトが走る。
 *
 * Run: node scripts/test-rls.mjs
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const ADMIN_ID  = '00000000-0000-4001-8000-000000000001';
const TANTOU_ID = '00000000-0000-4001-8000-000000000002';
// テスト用の固定 UUID。seedData() で作成する。
const CUST_ID   = '00000000-0000-4000-8000-000000000001';
// 案件を持たない顧客（FK 制約なしで削除可能な DELETE テスト用）
const CUST_ID2  = '00000000-0000-4000-8000-000000000002';
const CASE_ID   = '00000000-0000-4000-8000-000000000011';

// ── Supabase 相当の事前定義 ──────────────────────────────────────────────────
// pglite には auth スキーマ・ロールが無いため手動で用意する。
const SETUP_SQL = `
  do $$ begin create role anon noinherit;      exception when duplicate_object then null; end $$;
  do $$ begin create role authenticated noinherit; exception when duplicate_object then null; end $$;
  do $$ begin create role service_role noinherit bypassrls; exception when duplicate_object then null; end $$;

  create schema if not exists auth;

  create table if not exists auth.users (
    id                   uuid primary key,
    email                text,
    raw_app_meta_data    jsonb not null default '{}'
  );

  -- Supabase が提供する auth.uid()：JWT claims の sub を返す。
  create or replace function auth.uid()
  returns uuid
  language sql stable security definer
  set search_path = auth
  as $$
    select (
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    )::uuid
  $$;

  grant usage  on schema auth to authenticated, anon, service_role;
  grant select on auth.users  to authenticated, service_role;
`;

function migration(name) {
  return readFileSync(join(ROOT, 'supabase', 'migrations', name), 'utf8');
}

// ── データベースのセットアップ ───────────────────────────────────────────────
async function buildDb(migrationFiles) {
  const db = await PGlite.create();
  await db.exec(SETUP_SQL);
  for (const f of migrationFiles) {
    await db.exec(migration(f));
  }
  return db;
}

async function seedUsers(db) {
  // auth.users に insert → _auto_profile トリガが profiles を自動作成する。
  // トリガが走らない環境への安全網として profiles も on conflict do nothing で用意。
  await db.exec(`
    insert into auth.users (id, email, raw_app_meta_data) values
      ('${ADMIN_ID}',  'admin@test.local',  '{"role": "admin"}'),
      ('${TANTOU_ID}', 'tantou@test.local', '{}')
    on conflict (id) do nothing;

    insert into profiles (user_id, role_id, email)
    select
      u.id,
      case when u.raw_app_meta_data->>'role' = 'admin'
        then '00000000-0000-4000-9000-000000000001'::uuid
        else '00000000-0000-4000-9000-000000000002'::uuid
      end,
      u.email
    from auth.users u
    on conflict (user_id) do nothing;
  `);
}

// マイグレーションは初期データを持たないので、テスト用の行をスーパーユーザーで挿入する。
async function seedData(db) {
  await db.exec(`
    insert into customers (id, name) values
      ('${CUST_ID}',  'テスト顧客1'),
      ('${CUST_ID2}', 'テスト顧客2（案件なし）')
    on conflict (id) do nothing;

    insert into cases (id, title, customer_id) values
      ('${CASE_ID}', 'テスト案件', '${CUST_ID}')
    on conflict (id) do nothing;
  `);
}

// ── ヘルパー ─────────────────────────────────────────────────────────────────
// 認証済みユーザーとして BEGIN〜ROLLBACK 内で操作する。
async function asUser(db, userId, fn) {
  await db.exec('begin');
  try {
    await db.exec(
      `select set_config('request.jwt.claims',
        '{"sub":"${userId}","role":"authenticated"}', true)`
    );
    await db.exec('set local role authenticated');
    return await fn(db);
  } finally {
    await db.exec('rollback');
  }
}

// anon（未ログイン）として操作する。
async function asAnon(db, fn) {
  await db.exec('begin');
  try {
    await db.exec("select set_config('request.jwt.claims', '', true)");
    await db.exec('set local role anon');
    return await fn(db);
  } finally {
    await db.exec('rollback');
  }
}

// INSERT/SELECT：エラーが起きたら ok=false。
async function tryOp(fn) {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

// UPDATE/DELETE 専用：0 行更新も「拒否」として ok=false を返す。
// RLS の using 句は拒否時に行を不可視にするだけでエラーを投げないため。
async function tryModify(db, sql) {
  try {
    const r = await db.query(sql);
    return { ok: (r.affectedRows ?? 0) > 0 };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

// ── テストランナー ───────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function test(label, fn) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

// ── メイン ───────────────────────────────────────────────────────────────────
const ALL_MIGRATIONS = [
  '0001_init.sql',
  '0002_auth_rls.sql',
  '0003_roles.sql',
  '0004_master_customers.sql',
];

console.log('\nRLS 否定テスト\n');

// ── A. anon ──────────────────────────────────────────────────────────────────
console.log('A. anon（未ログイン）');
{
  const db = await buildDb(ALL_MIGRATIONS);
  await seedUsers(db);
  await seedData(db);

  const selCust  = await asAnon(db, d => tryOp(() => d.query('select * from customers')));
  const insCust  = await asAnon(db, d => tryOp(() => d.exec("insert into customers (name) values ('x')")));
  const selCases = await asAnon(db, d => tryOp(() => d.query('select * from cases')));
  const insCases = await asAnon(db, d => tryOp(() =>
    d.exec(`insert into cases (title, customer_id) values ('t', '${CUST_ID}')`)));
  const delCases = await asAnon(db, d => tryOp(() => d.exec('delete from cases')));

  test('customers SELECT が拒否される（permission denied）',
    () => assert.equal(selCust.ok, false));
  test('customers INSERT が拒否される',
    () => assert.equal(insCust.ok, false));
  test('cases SELECT が拒否される',
    () => assert.equal(selCases.ok, false));
  test('cases INSERT が拒否される',
    () => assert.equal(insCases.ok, false));
  test('cases DELETE が拒否される',
    () => assert.equal(delCases.ok, false));
}

// ── B. 担当者（tantou）──────────────────────────────────────────────────────
console.log('\nB. 担当者（customers=view, cases=edit）');
{
  const db = await buildDb(ALL_MIGRATIONS);
  await seedUsers(db);
  await seedData(db);

  const selCust  = await asUser(db, TANTOU_ID, d => d.query('select * from customers'));
  const insCust  = await asUser(db, TANTOU_ID, d => tryOp(() =>
    d.exec("insert into customers (name) values ('new')")));
  // UPDATE/DELETE で 0 rows も「拒否」と判定するため tryModify を使う
  const updCust  = await asUser(db, TANTOU_ID, d =>
    tryModify(d, `update customers set name = 'x' where id = '${CUST_ID}'`));
  const delCust  = await asUser(db, TANTOU_ID, d =>
    tryModify(d, `delete from customers where id = '${CUST_ID}'`));

  const selCases = await asUser(db, TANTOU_ID, d => d.query('select * from cases'));
  const insCases = await asUser(db, TANTOU_ID, d => tryOp(() =>
    d.exec(`insert into cases (title, customer_id) values ('tantou-case', '${CUST_ID}')`)));
  const updCases = await asUser(db, TANTOU_ID, d =>
    tryModify(d, `update cases set title = 'updated' where id = '${CASE_ID}'`));
  const delCases = await asUser(db, TANTOU_ID, d =>
    tryModify(d, `delete from cases where id = '${CASE_ID}'`));

  test('customers SELECT が通る（view 権限）',
    () => assert.ok(selCust.rows.length >= 0));  // エラーでなければ OK
  test('customers INSERT が拒否される（edit が必要）',
    () => assert.equal(insCust.ok, false));
  test('customers UPDATE が拒否される（edit が必要）',
    () => assert.equal(updCust.ok, false));
  test('customers DELETE が拒否される（manage が必要）',
    () => assert.equal(delCust.ok, false));
  test('cases SELECT が通る（edit >= view）',
    () => assert.ok(selCases.rows.length >= 0));
  test('cases INSERT が通る（edit 権限）',
    () => assert.equal(insCases.ok, true));
  test('cases UPDATE が通る（edit 権限）',
    () => assert.equal(updCases.ok, true));
  test('cases DELETE が拒否される（manage が必要）',
    () => assert.equal(delCases.ok, false));
}

// ── C. 管理者（admin）───────────────────────────────────────────────────────
console.log('\nC. 管理者（is_system=true → 全 feature manage）');
{
  const db = await buildDb(ALL_MIGRATIONS);
  await seedUsers(db);
  await seedData(db);

  const insCust  = await asUser(db, ADMIN_ID, d => tryOp(() =>
    d.exec("insert into customers (name) values ('admin-new')")));
  const updCust  = await asUser(db, ADMIN_ID, d =>
    tryModify(d, `update customers set name = 'admin-updated' where id = '${CUST_ID}'`));
  // CUST_ID には案件が紐付いているため FK=restrict で削除不可。案件なしの CUST_ID2 で検証する。
  const delCust  = await asUser(db, ADMIN_ID, d =>
    tryModify(d, `delete from customers where id = '${CUST_ID2}'`));

  // delCust は ROLLBACK されるので CUST_ID は残っている
  const insCases = await asUser(db, ADMIN_ID, d => tryOp(() =>
    d.exec(`insert into cases (title, customer_id) values ('admin-case', '${CUST_ID}')`)));
  const delCases = await asUser(db, ADMIN_ID, d =>
    tryModify(d, `delete from cases where id = '${CASE_ID}'`));

  test('customers INSERT が通る（manage）',
    () => assert.equal(insCust.ok, true));
  test('customers UPDATE が通る（manage）',
    () => assert.equal(updCust.ok, true));
  test('customers DELETE が通る（manage）',
    () => assert.equal(delCust.ok, true));
  test('cases INSERT が通る（manage）',
    () => assert.equal(insCases.ok, true));
  test('cases DELETE が通る（manage）',
    () => assert.equal(delCases.ok, true));
}

// ── D. self-check（歯があることの確認）────────────────────────────────────
// 0001+0002 だけ適用した緩い DB（customers に using(true) ポリシー）では
// tantou でも customers INSERT が通ることを確認する。
// → テストに歯がある（本来の制御が無ければ必ず検出できる）ことの実証。
console.log('\nD. self-check（緩いポリシーでは担当者の customers insert が通ること）');
{
  const db = await buildDb(['0001_init.sql', '0002_auth_rls.sql']);
  // 0003 が無いので profiles テーブルが存在しない。
  // 認証済みなら using(true) ポリシーで全操作可なので、単純にロールだけ設定する。
  await db.exec(`
    insert into auth.users (id, email, raw_app_meta_data) values
      ('${TANTOU_ID}', 'tantou@test.local', '{}')
    on conflict (id) do nothing;
  `);

  const result = await asUser(db, TANTOU_ID, d => tryOp(() =>
    d.exec("insert into customers (name) values ('self-check')")));

  test('緩いポリシー（0002）では担当者が customers に insert できる（制御が無ければ検出可能）',
    () => assert.equal(result.ok, true,
      `self-check failed: insert が通るはずなのに拒否された（${result.err}）`));
}

// ── 集計 ─────────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} 項目中 ${passed} 項目通過、${failed} 項目失敗\n`);
if (failed > 0) process.exit(1);
