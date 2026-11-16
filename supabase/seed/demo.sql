-- 開発・プレビュー専用。本番には適用しない。
-- ローカル DB に流すには: pnpm seed:demo
--
-- 画面確認用のサンプルデータ（顧客5件・案件42件）。
-- 0001_init.sql のスキーマと 0003_roles.sql の構成 seed（roles/features/role_permissions）が
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
