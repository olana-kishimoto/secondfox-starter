-- 0002 アクセス制御：RLS を「ログイン済みの利用者だけ」に作り直す。
--
-- 0001 は「service_role だけが読み書きできる」状態だった。ここから、
--   ・authenticated（Supabase Auth でログイン済み）の利用者は、業務テーブルを読み書きできる
--   ・anon（ログインしていない）は何もできない（権限ごと外す）
--   ・service_role は引き続き全部できる（サーバー専用の鍵。ブラウザ・ログ・画面に出さない）
-- に変える。このシステムは1社専用（お客様ごとに別の DB）なので、テナント分割はしない。
-- ログイン済み = そのお客様のスタッフ。利用者は管理者が Supabase Auth で作る（自己登録・メール認証なし）。
--
-- 検索条件の保存（search_templates）だけは利用者ごと（user_id = auth.uid()）。
-- 何度流しても同じ結果になる。

begin;

-- 検索条件を利用者ごとに分ける
alter table search_templates add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();
alter table search_templates drop constraint if exists search_templates_screen_key_name_key;
create unique index if not exists search_templates_user_uk on search_templates (user_id, screen_key, name);

-- 業務テーブル：ログイン済みなら読み書きできる
drop policy if exists customers_staff on customers;
create policy customers_staff on customers for all to authenticated using (true) with check (true);

drop policy if exists cases_staff on cases;
create policy cases_staff on cases for all to authenticated using (true) with check (true);

-- 検索条件：自分のものだけ
drop policy if exists search_templates_own on search_templates;
create policy search_templates_own on search_templates for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 明示の権限（Supabase は新しいテーブルを既定では API に見せない）。anon には何も与えない。
revoke all on customers, cases, search_templates from anon;
revoke all on customers, cases, search_templates from public;
grant select, insert, update, delete on customers, cases, search_templates to authenticated;
grant all on customers, cases, search_templates to service_role;
-- 案件番号の採番（既定値の nextval）に必要
grant usage, select on sequence case_no_seq to authenticated, service_role;

commit;
