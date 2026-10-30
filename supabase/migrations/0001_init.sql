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

-- 画面確認用の初期データ（顧客5件・案件42件）。本番に出す前に消してよい。
insert into customers (id, name, contact, email) values
  ('00000000-0000-4000-8000-000000000001', '株式会社あおぞら商事', '佐藤 花子', 'sato@example.com'),
  ('00000000-0000-4000-8000-000000000002', '山田製作所',           '山田 太郎', 'yamada@example.com'),
  ('00000000-0000-4000-8000-000000000003', '有限会社みどり堂',     '鈴木 一郎', 'suzuki@example.com'),
  ('00000000-0000-4000-8000-000000000004', 'ひかり物流株式会社',   '高橋 美咲', 'takahashi@example.com'),
  ('00000000-0000-4000-8000-000000000005', '北風フーズ',           '田中 健',   'tanaka@example.com')
on conflict (id) do nothing;

insert into cases (title, customer_id, status, amount, due_date, memo)
select
  (array['年間保守契約の更新','新規店舗の備品手配','配送ルートの見直し','在庫棚卸の代行','販促チラシの制作','社内研修の実施','基幹システムの移行支援','展示会ブースの設営','定期点検の実施','問い合わせ窓口の整備'])[1 + (g % 10)]
    || '（第' || g || '回）',
  ('00000000-0000-4000-8000-00000000000' || (1 + (g % 5)))::uuid,
  (array['draft','active','active','done','done','canceled'])[1 + (g % 6)],
  (50 + (g * 37) % 950) * 1000,
  current_date + ((g * 5) % 90) - 30,
  ''
from generate_series(1, 42) as g
where not exists (select 1 from cases);

commit;
