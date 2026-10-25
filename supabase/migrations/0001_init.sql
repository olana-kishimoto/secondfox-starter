-- 0001 型スターターの初期スキーマ（最小のサンプル）。
-- SecondFoxが本番構築時に、お客様のSupabaseへこのSQLを適用する。
-- 公開テーブルは必ずRLSを有効にし、読み取りの範囲をポリシーで明示する。

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);

alter table notes enable row level security;

-- サンプル方針：匿名でも閲覧できる公開メモ（本番では業務に合わせて必ず見直す）。
create policy notes_read on notes for select using (true);

-- 画面確認用の初期データ（1件）。
insert into notes (title, body)
values ('ようこそ', 'この画面が見えていれば、Supabaseとの接続と初期スキーマの適用が成功しています。')
on conflict do nothing;
