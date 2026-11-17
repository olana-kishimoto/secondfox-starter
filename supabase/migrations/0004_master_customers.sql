-- 0004 顧客マスタに updated_at を追加し、削除ポリシーを明示する。
-- 0003 で customers_delete（manage 権限）は定義済みだが、updated_at 追加と合わせて再確認のため再定義する。
-- 追加のみ・冪等（何度流しても同じ結果になる）。
--
-- rollback 手順（本番適用前にのみ実施）：
--   drop policy if exists customers_delete on customers;
--   alter table customers drop column if exists updated_at;

begin;

alter table customers
  add column if not exists updated_at timestamptz not null default now();

drop policy if exists customers_delete on customers;
create policy customers_delete on customers
  for delete to authenticated
  using (has_level('customers', 'manage'));

commit;
