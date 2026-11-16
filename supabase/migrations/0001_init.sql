-- 0001 型スターターの初期スキーマ（見本画面「案件一覧」が動く最小セット）。
-- SecondFox が新規作成時に、お客様の Supabase へ順に適用する。何度流しても同じ結果になる。
--
--   customers          顧客マスタ（見本）
--   cases              案件（見本の業務データ。状態・金額・期限つき）
--   search_templates   一覧の検索条件の保存（SearchTemplates）
--
-- 方針：すべて RLS 有効。画面はサーバー（service_role）経由で読み書きするので、anon / authenticated には何も許可しない。
-- ログインを足すときは、ここに利用者ごとのポリシーと grant を足す（番号付きの新しいマイグレーションで）。

begin;

create table if not exists customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  contact    text,
  email      text,
  created_at timestamptz not null default now()
);

create sequence if not exists case_no_seq;

create table if not exists cases (
  id          uuid primary key default gen_random_uuid(),
  case_no     text not null unique default ('C-' || lpad(nextval('case_no_seq')::text, 5, '0')),
  title       text not null,
  customer_id uuid references customers(id) on delete restrict,
  status      text not null default 'draft' check (status in ('draft', 'active', 'done', 'canceled')),
  amount      integer not null default 0 check (amount >= 0),
  due_date    date,
  memo        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists cases_status_idx on cases (status, created_at desc);
create index if not exists cases_customer_idx on cases (customer_id);
create index if not exists cases_due_idx on cases (due_date);

create table if not exists search_templates (
  id         bigint generated always as identity primary key,
  screen_key text not null,
  name       text not null,
  params     text not null default '',
  created_at timestamptz not null default now(),
  unique (screen_key, name)
);

alter table customers enable row level security;
alter table cases enable row level security;
alter table search_templates enable row level security;

-- 明示の権限（Supabase は新しいテーブルを既定では API に見せない）。サーバー（service_role）だけが読み書きできる。
revoke all on customers, cases, search_templates from anon, authenticated;
grant all on customers, cases, search_templates to service_role;
grant usage, select on sequence case_no_seq to service_role;

-- 画面確認用のデモデータは supabase/seed/demo.sql へ移動。
-- 本番初期化はこのファイルのみ適用する（デモ行は含まない）。
-- 開発・プレビューでサンプルデータが必要なときは: pnpm seed:demo

commit;
