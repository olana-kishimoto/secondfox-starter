-- 0003 役割による権限分離の土台（認証の内側の、さらに細かい出し分け）。
--
-- 入口の合言葉・ログイン・0002 の RLS（ログイン済みなら業務テーブルを読み書きできる）は、そのまま変えない。
-- ここは「その上に足す」だけ：役割をデータとして持ち、表ごとに「この役割だけ」と閉じられる型を用意する。
--
--   roles     役割の一覧（データ。決め打ちの enum にしない）。admin だけは予約の特別役割＝全部見える。
--   profiles  利用者ごとの役割（1人1役割）。行が無い利用者は「役割なし」。
--   app_role() / app_is_admin() / app_has_role(keys)  ポリシーから使う判定。
--   sample_notes  役割で閉じる表の見本（型）。実際の業務の表は、各システムが同じ書き方で足す。
--
-- 役割の割り当ては管理者だけ（自己登録なし・自分で役割を上げられない）。最初の管理者は、新規作成時に
-- サーバー側（service_role）で profiles に入れる（README「役割と権限」）。
-- 何度流しても同じ結果になる。

begin;

-- ---- 役割の一覧 ----
create table if not exists roles (
  key        text primary key check (key ~ '^[a-z][a-z0-9_]{1,30}$'),
  label      text not null check (char_length(label) between 1 and 40),
  sort       integer not null default 100,
  created_at timestamptz not null default now()
);

-- ---- 利用者ごとの役割 ----
create table if not exists profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null references roles(key) on update cascade on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index if not exists profiles_role_idx on profiles (role);

alter table roles enable row level security;
alter table profiles enable row level security;

-- ---- 判定（ポリシーから呼ぶ）----
-- security definer：profiles 自身の RLS を通さずに、ログイン中の利用者の役割だけを読む（ポリシーの自己参照・再帰を避ける）。
-- 戻すのは「自分の」役割だけ。search_path を固定する。
create or replace function app_role() returns text
  language sql stable security definer set search_path = public as
$$ select role from public.profiles where user_id = auth.uid() $$;

create or replace function app_is_admin() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'admin' from public.profiles where user_id = auth.uid()), false) $$;

-- 管理者は常に true。それ以外は、渡した役割のどれかに当たるとき true。役割なしは false。
create or replace function app_has_role(keys text[]) returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'admin' or role = any(keys) from public.profiles where user_id = auth.uid()), false) $$;

revoke all on function app_role(), app_is_admin(), app_has_role(text[]) from public, anon;
grant execute on function app_role(), app_is_admin(), app_has_role(text[]) to authenticated, service_role;

-- ---- roles / profiles のポリシー ----
-- roles：ログイン済みなら一覧を読める（画面の名前表示用）。足す・直す・消すは管理者だけ。admin の行は固定。
drop policy if exists roles_read on roles;
create policy roles_read on roles for select to authenticated using (true);
drop policy if exists roles_admin_insert on roles;
create policy roles_admin_insert on roles for insert to authenticated with check (app_is_admin() and key <> 'admin');
drop policy if exists roles_admin_update on roles;
create policy roles_admin_update on roles for update to authenticated using (app_is_admin() and key <> 'admin') with check (app_is_admin() and key <> 'admin');
drop policy if exists roles_admin_delete on roles;
create policy roles_admin_delete on roles for delete to authenticated using (app_is_admin() and key <> 'admin');

-- profiles：自分の行は読める。管理者は全員ぶん読み書きできる。自分で自分の役割は変えられない（管理者でなければ書けない）。
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select to authenticated using (user_id = auth.uid() or app_is_admin());
drop policy if exists profiles_admin_insert on profiles;
create policy profiles_admin_insert on profiles for insert to authenticated with check (app_is_admin());
drop policy if exists profiles_admin_update on profiles;
create policy profiles_admin_update on profiles for update to authenticated using (app_is_admin()) with check (app_is_admin());
drop policy if exists profiles_admin_delete on profiles;
create policy profiles_admin_delete on profiles for delete to authenticated using (app_is_admin());

-- ---- 役割で閉じる表の見本（型）----
-- 読む：管理者と、列挙した役割（ここでは staff）だけ。役割なしは読めない。
-- 書く：管理者だけ。
-- 各システムは、業務の表に同じ形でポリシーを書く。役割名は各システムが決める。例（差し替える例）：
--   using (app_has_role(array['sales']))              … 営業と管理者だけ読める
--   using (app_has_role(array['accounting']))         … 経理と管理者だけ読める
--   using (app_has_role(array['sales','accounting'])) … 営業・経理・管理者が読める
-- 既存の cases / customers は 0002 のまま（ログイン済みなら全員）。絞りたい表だけ、ポリシーを作り直す。
create table if not exists sample_notes (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null default '',
  created_at timestamptz not null default now()
);
alter table sample_notes enable row level security;

drop policy if exists sample_notes_read on sample_notes;
create policy sample_notes_read on sample_notes for select to authenticated using (app_has_role(array['staff']));
drop policy if exists sample_notes_admin_write on sample_notes;
create policy sample_notes_admin_write on sample_notes for all to authenticated using (app_is_admin()) with check (app_is_admin());

-- ---- 明示の権限（anon には何も与えない）----
revoke all on roles, profiles, sample_notes from anon, public;
grant select, insert, update, delete on roles, profiles, sample_notes to authenticated;
grant all on roles, profiles, sample_notes to service_role;

-- ---- 既定の種：汎用の2役割だけ ----
-- 営業・経理などの業種の役割は入れない。各システムが roles に足す（例：('sales','営業') ('accounting','経理')）。
insert into roles (key, label, sort) values ('admin', '管理者', 0), ('staff', '担当者', 10)
on conflict (key) do nothing;

commit;
