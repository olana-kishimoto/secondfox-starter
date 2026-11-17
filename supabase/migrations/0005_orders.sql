-- 0005 受注（orders）とその明細（order_items）、商品マスタ（products）。
-- ヘッダ明細の参照実装（契約 B-ヘッダ明細 体現用）。
-- RLS は 0003 の has_level 方式に揃える。
-- features に orders/products を追加する。

begin;

-- ── シーケンス（orders_no 採番）──────────────────────────────
-- order_no の DEFAULT 句より先に宣言しないとテーブル作成時にエラーになる。
create sequence if not exists orders_seq start 1;

-- ── テーブル ──────────────────────────────────────────────────

create table if not exists products (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  name       text not null,
  unit_price int  not null check (unit_price >= 0),
  updated_at timestamptz not null default now()
);

-- 受注ヘッダ
create table if not exists orders (
  id         uuid primary key default gen_random_uuid(),
  order_no   text unique not null
               default ('SO-' || lpad(nextval('orders_seq')::text, 5, '0')),
  customer_id uuid references customers(id) on delete restrict,
  order_date  date not null default current_date,
  status      text not null default 'draft'
               check (status in ('draft','confirmed','shipped','done','canceled')),
  memo        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 明細行
create table if not exists order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name       text not null,
  qty        int  not null check (qty > 0),
  unit_price int  not null check (unit_price >= 0),
  amount     int  generated always as (qty * unit_price) stored,
  line_no    int  not null
);

-- ── RLS有効化 ─────────────────────────────────────────────────

alter table products    enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;

-- ── GRANT（Supabase 2024-10以降、public schemaの新テーブルは既定で非公開） ──

revoke all on products, orders, order_items from anon, public;
grant select, insert, update, delete on products, orders, order_items to authenticated;
grant all on products, orders, order_items to service_role;
grant usage, select on sequence orders_seq to authenticated, service_role;

-- ── RLSポリシー ───────────────────────────────────────────────

-- products
drop policy if exists products_read on products;
create policy products_read on products
  for select to authenticated
  using (has_level('products', 'view'));

drop policy if exists products_write on products;
create policy products_write on products
  for insert to authenticated
  with check (has_level('products', 'edit'));

drop policy if exists products_update on products;
create policy products_update on products
  for update to authenticated
  using (has_level('products', 'edit'))
  with check (has_level('products', 'edit'));

drop policy if exists products_delete on products;
create policy products_delete on products
  for delete to authenticated
  using (has_level('products', 'manage'));

-- orders
drop policy if exists orders_read on orders;
create policy orders_read on orders
  for select to authenticated
  using (has_level('orders', 'view'));

drop policy if exists orders_write on orders;
create policy orders_write on orders
  for insert to authenticated
  with check (has_level('orders', 'edit'));

drop policy if exists orders_update on orders;
create policy orders_update on orders
  for update to authenticated
  using (has_level('orders', 'edit'))
  with check (has_level('orders', 'edit'));

drop policy if exists orders_delete on orders;
create policy orders_delete on orders
  for delete to authenticated
  using (has_level('orders', 'manage'));

-- order_items（受注の edit 権限者が明細を操作できる）
drop policy if exists order_items_read on order_items;
create policy order_items_read on order_items
  for select to authenticated
  using (has_level('orders', 'view'));

drop policy if exists order_items_write on order_items;
create policy order_items_write on order_items
  for insert to authenticated
  with check (has_level('orders', 'edit'));

drop policy if exists order_items_update on order_items;
create policy order_items_update on order_items
  for update to authenticated
  using (has_level('orders', 'edit'))
  with check (has_level('orders', 'edit'));

drop policy if exists order_items_delete on order_items;
create policy order_items_delete on order_items
  for delete to authenticated
  using (has_level('orders', 'edit'));

-- ── features への追加（有効な画面キーを増やす） ──────────────

insert into features (key, label, grp, sort) values
  ('orders',   '受注',       '業務', 15),
  ('products', '商品マスタ', '設定', 25)
on conflict (key) do nothing;

-- ── 既存ロールへのデフォルト権限付与 ─────────────────────────

-- 管理者（is_system=true のロール）：全機能 manage
insert into role_permissions (role_id, feature_key, level)
select r.id, f.key, 'manage'
from roles r cross join features f
where r.is_system = true
  and f.key in ('orders', 'products')
on conflict (role_id, feature_key) do nothing;

-- 担当者：orders=edit, products=view
insert into role_permissions (role_id, feature_key, level) values
  ('00000000-0000-4000-9000-000000000002', 'orders',   'edit'),
  ('00000000-0000-4000-9000-000000000002', 'products', 'view')
on conflict (role_id, feature_key) do nothing;

-- 閲覧：orders=view, products=view
insert into role_permissions (role_id, feature_key, level) values
  ('00000000-0000-4000-9000-000000000003', 'orders',   'view'),
  ('00000000-0000-4000-9000-000000000003', 'products', 'view')
on conflict (role_id, feature_key) do nothing;

commit;
