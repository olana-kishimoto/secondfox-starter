-- 0003 権限マスタ：ユーザー管理・役割・機能ごとのアクセス制御。
-- 追加のみ・冪等（何度流しても同じ結果）。
-- 0002 の「authenticated全部可」ポリシーをfeatureベースのRLSに置き換える。
--
--   roles              役割（管理者・担当者・閲覧など）
--   features           画面・機能キー（ハーネスが画面を足したらinsertする運用）
--   role_permissions   役割×機能のアクセス水準（none/view/edit/manage）
--   profiles           Auth利用者と役割の紐付け
--
-- 権限判定：
--   current_level(feature) → 'none'|'view'|'edit'|'manage'（is_systemロールは常に'manage'）
--   has_level(feature, min) → boolean（none < view < edit < manage）
--   my_perms() → jsonb（全feature→levelのマップ、1往復で取れる）
--
-- 注意: GRANTはauthenticated/service_roleに付け直す（Supabase 2024-10以降、public schemaの新テーブルは既定で非公開）。

begin;

-- ── テーブル ──────────────────────────────────────────────────

create table if not exists roles (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  is_system  boolean not null default false,
  created_at timestamptz not null default now()
);

-- features: 画面・機能のキー一覧。ハーネスが画面を足したら insert する運用（コメントで明記）。
create table if not exists features (
  key   text primary key,
  label text not null,
  grp   text,
  sort  int not null default 0
);

create table if not exists role_permissions (
  role_id     uuid references roles(id) on delete cascade,
  feature_key text references features(key) on delete cascade,
  level       text not null check (level in ('none', 'view', 'edit', 'manage')),
  primary key (role_id, feature_key)
);

create table if not exists profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role_id    uuid references roles(id),
  active     boolean not null default true,
  email      text,
  created_at timestamptz not null default now()
);

-- ── RLS有効化 ─────────────────────────────────────────────────

alter table roles enable row level security;
alter table features enable row level security;
alter table role_permissions enable row level security;
alter table profiles enable row level security;

-- ── GRANT（新テーブルはデフォルト非公開のため明示する） ────────

revoke all on roles, features, role_permissions, profiles from anon, public;
grant select, insert, update, delete on roles, features, role_permissions, profiles to authenticated;
grant all on roles, features, role_permissions, profiles to service_role;

-- ── 権限判定関数 ──────────────────────────────────────────────

create or replace function current_level(feature text)
returns text
language sql
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from profiles p
      join roles r on r.id = p.role_id
      where p.user_id = auth.uid() and r.is_system = true and p.active = true
    ) then 'manage'
    else coalesce(
      (select rp.level
       from profiles p
       join role_permissions rp on rp.role_id = p.role_id
       where p.user_id = auth.uid() and p.active = true and rp.feature_key = feature),
      'none'
    )
  end;
$$;

create or replace function has_level(feature text, min text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select array_position(array['none','view','edit','manage']::text[], current_level(feature))
      >= array_position(array['none','view','edit','manage']::text[], min);
$$;

-- 全feature→levelのマップ（1往復で取れる、TypeScriptのgetMyPerms()で使う）
create or replace function my_perms()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_object_agg(f.key, current_level(f.key)),
    '{}'::jsonb
  )
  from features f;
$$;

-- ── 初期シード（役割・機能） ──────────────────────────────────

-- features: 画面を足したら insert するたびにここに追記する
insert into features (key, label, grp, sort) values
  ('cases',     '案件',         '業務', 10),
  ('customers', '顧客マスタ',   '業務', 20),
  ('users',     'ユーザー管理', '設定', 30),
  ('roles',     '権限マスタ',   '設定', 40)
on conflict (key) do nothing;

-- roles: 管理者（is_system=true）・担当者・閲覧
insert into roles (id, name, is_system) values
  ('00000000-0000-4000-9000-000000000001', '管理者', true),
  ('00000000-0000-4000-9000-000000000002', '担当者', false),
  ('00000000-0000-4000-9000-000000000003', '閲覧',   false)
on conflict (id) do nothing;

-- 管理者：全feature manage
insert into role_permissions (role_id, feature_key, level)
select '00000000-0000-4000-9000-000000000001', key, 'manage' from features
on conflict (role_id, feature_key) do nothing;

-- 担当者：cases=edit, customers=view, users=none, roles=none
insert into role_permissions (role_id, feature_key, level) values
  ('00000000-0000-4000-9000-000000000002', 'cases',     'edit'),
  ('00000000-0000-4000-9000-000000000002', 'customers', 'view'),
  ('00000000-0000-4000-9000-000000000002', 'users',     'none'),
  ('00000000-0000-4000-9000-000000000002', 'roles',     'none')
on conflict (role_id, feature_key) do nothing;

-- 閲覧：全feature view
insert into role_permissions (role_id, feature_key, level)
select '00000000-0000-4000-9000-000000000003', key, 'view' from features
on conflict (role_id, feature_key) do nothing;

-- ── トリガ：Auth利用者が登録されたら自動でprofiles作成 ─────────

create or replace function _auto_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (user_id, role_id, email)
  values (
    new.id,
    (case when new.raw_app_meta_data->>'role' = 'admin'
      then '00000000-0000-4000-9000-000000000001'
      else '00000000-0000-4000-9000-000000000002'
    end)::uuid,
    new.email
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists auto_profile on auth.users;
create trigger auto_profile
  after insert on auth.users
  for each row execute function _auto_profile();

-- 既存ユーザーにprofilesが無ければ作る（冪等）
insert into profiles (user_id, role_id, email)
select
  u.id,
  (case when u.raw_app_meta_data->>'role' = 'admin'
    then '00000000-0000-4000-9000-000000000001'
    else '00000000-0000-4000-9000-000000000002'
  end)::uuid,
  u.email
from auth.users u
on conflict (user_id) do nothing;

-- ── RLSポリシー（0002の「認証済み全部可」を置き換え） ────────────

-- customers（0002のpolicyを削除して新しいものに）
drop policy if exists customers_staff on customers;

drop policy if exists customers_read on customers;
create policy customers_read on customers
  for select to authenticated
  using (has_level('customers', 'view'));

drop policy if exists customers_write on customers;
create policy customers_write on customers
  for insert to authenticated
  with check (has_level('customers', 'edit'));

drop policy if exists customers_update on customers;
create policy customers_update on customers
  for update to authenticated
  using (has_level('customers', 'edit'))
  with check (has_level('customers', 'edit'));

drop policy if exists customers_delete on customers;
create policy customers_delete on customers
  for delete to authenticated
  using (has_level('customers', 'manage'));

-- cases（0002のpolicyを削除して新しいものに）
drop policy if exists cases_staff on cases;

drop policy if exists cases_read on cases;
create policy cases_read on cases
  for select to authenticated
  using (has_level('cases', 'view'));

drop policy if exists cases_write on cases;
create policy cases_write on cases
  for insert to authenticated
  with check (has_level('cases', 'edit'));

drop policy if exists cases_update on cases;
create policy cases_update on cases
  for update to authenticated
  using (has_level('cases', 'edit'))
  with check (has_level('cases', 'edit'));

drop policy if exists cases_delete on cases;
create policy cases_delete on cases
  for delete to authenticated
  using (has_level('cases', 'manage'));

-- roles
drop policy if exists roles_read on roles;
create policy roles_read on roles
  for select to authenticated
  using (has_level('roles', 'view'));

drop policy if exists roles_write on roles;
create policy roles_write on roles
  for all to authenticated
  using (has_level('roles', 'manage'))
  with check (has_level('roles', 'manage'));

-- features
drop policy if exists features_read on features;
create policy features_read on features
  for select to authenticated
  using (has_level('roles', 'view'));

drop policy if exists features_write on features;
create policy features_write on features
  for all to authenticated
  using (has_level('roles', 'manage'))
  with check (has_level('roles', 'manage'));

-- role_permissions
drop policy if exists role_permissions_read on role_permissions;
create policy role_permissions_read on role_permissions
  for select to authenticated
  using (has_level('roles', 'view'));

drop policy if exists role_permissions_write on role_permissions;
create policy role_permissions_write on role_permissions
  for all to authenticated
  using (has_level('roles', 'manage'))
  with check (has_level('roles', 'manage'));

-- profiles
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles
  for select to authenticated
  using (has_level('users', 'view'));

drop policy if exists profiles_write on profiles;
create policy profiles_write on profiles
  for all to authenticated
  using (has_level('users', 'manage'))
  with check (has_level('users', 'manage'));

commit;
