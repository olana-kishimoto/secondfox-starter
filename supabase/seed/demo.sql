-- 開発・プレビュー専用。本番には適用しない。
-- ローカル DB に流すには: pnpm seed:demo
--
-- 画面確認用のサンプルデータ（顧客5件・案件42件・商品5件・受注10件）。
-- 0001〜0005 のスキーマと 0003_roles.sql の構成 seed（roles/features/role_permissions）が
-- 適用済みの状態で流す。構成 seed のロール・機能・権限行はここには含まない。

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

-- ── 商品マスタ（5件） ─────────────────────────────────────────
insert into products (id, code, name, unit_price) values
  ('00000000-0000-4005-8000-000000000001', 'P-001', '基本サポートパック',    50000),
  ('00000000-0000-4005-8000-000000000002', 'P-002', 'プレミアムサポートパック', 120000),
  ('00000000-0000-4005-8000-000000000003', 'P-003', '訪問点検（1回）',        30000),
  ('00000000-0000-4005-8000-000000000004', 'P-004', '消耗品セット',            8000),
  ('00000000-0000-4005-8000-000000000005', 'P-005', '緊急対応オプション',     25000)
on conflict (id) do nothing;

-- ── 受注データ（10件）＋明細 ─────────────────────────────────
-- 受注の order_no は sequence を使うため、insert 時には値を省略する（default で自動採番）。
-- 凍結スナップショットの確認：商品 P-001 の name を後から変えても既存明細の name は変わらない。
do $$
declare
  o1 uuid; o2 uuid; o3 uuid; o4 uuid; o5 uuid;
  o6 uuid; o7 uuid; o8 uuid; o9 uuid; o10 uuid;
  c1 constant uuid := '00000000-0000-4000-8000-000000000001';
  c2 constant uuid := '00000000-0000-4000-8000-000000000002';
  c3 constant uuid := '00000000-0000-4000-8000-000000000003';
  c4 constant uuid := '00000000-0000-4000-8000-000000000004';
  c5 constant uuid := '00000000-0000-4000-8000-000000000005';
begin
  if exists (select 1 from orders) then return; end if;

  insert into orders (customer_id, order_date, status, memo) values
    (c1, current_date - 20, 'done',      '年間サポート')    returning id into o1;
  insert into orders (customer_id, order_date, status, memo) values
    (c2, current_date - 15, 'shipped',   '機器点検含む')    returning id into o2;
  insert into orders (customer_id, order_date, status, memo) values
    (c3, current_date - 10, 'confirmed', '')                returning id into o3;
  insert into orders (customer_id, order_date, status, memo) values
    (c4, current_date - 7,  'draft',     '見積調整中')      returning id into o4;
  insert into orders (customer_id, order_date, status, memo) values
    (c5, current_date - 5,  'draft',     '')                returning id into o5;
  insert into orders (customer_id, order_date, status, memo) values
    (c1, current_date - 3,  'confirmed', '')                returning id into o6;
  insert into orders (customer_id, order_date, status, memo) values
    (c2, current_date - 2,  'draft',     '')                returning id into o7;
  insert into orders (customer_id, order_date, status, memo) values
    (c3, current_date - 1,  'canceled',  'キャンセル済み')  returning id into o8;
  insert into orders (customer_id, order_date, status, memo) values
    (c4, current_date,      'draft',     '')                returning id into o9;
  insert into orders (customer_id, order_date, status, memo) values
    (c5, current_date,      'draft',     '')                returning id into o10;

  -- 明細：name はスナップショット（発注時点の商品名を直接保存）
  insert into order_items (order_id, product_id, name, qty, unit_price, line_no) values
    (o1, '00000000-0000-4005-8000-000000000001', '基本サポートパック',    1, 50000, 1),
    (o1, '00000000-0000-4005-8000-000000000003', '訪問点検（1回）',       2, 30000, 2),
    (o2, '00000000-0000-4005-8000-000000000002', 'プレミアムサポートパック', 1, 120000, 1),
    (o2, '00000000-0000-4005-8000-000000000004', '消耗品セット',           3,  8000, 2),
    (o3, '00000000-0000-4005-8000-000000000001', '基本サポートパック',    2, 50000, 1),
    (o3, '00000000-0000-4005-8000-000000000005', '緊急対応オプション',    1, 25000, 2),
    (o4, '00000000-0000-4005-8000-000000000003', '訪問点検（1回）',       1, 30000, 1),
    (o5, '00000000-0000-4005-8000-000000000001', '基本サポートパック',    1, 50000, 1),
    (o5, '00000000-0000-4005-8000-000000000004', '消耗品セット',           2,  8000, 2),
    (o6, '00000000-0000-4005-8000-000000000002', 'プレミアムサポートパック', 1, 120000, 1),
    (o7, '00000000-0000-4005-8000-000000000001', '基本サポートパック',    1, 50000, 1),
    (o8, '00000000-0000-4005-8000-000000000003', '訪問点検（1回）',       1, 30000, 1),
    (o9, '00000000-0000-4005-8000-000000000004', '消耗品セット',           5,  8000, 1),
    (o10,'00000000-0000-4005-8000-000000000005', '緊急対応オプション',    1, 25000, 1);
end $$;
