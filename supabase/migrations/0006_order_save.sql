-- 0006 save_order RPC：ヘッダと明細を1トランザクションで原子的に保存する。
--
-- 設計メモ：
--   security invoker を採用 → 呼び出し元（authenticated ロール）の RLS が自然に効く。
--   security definer にすると postgres owner として実行され RLS をバイパスするため不採用。
--   加えて、INSERT の with check 違反と UPDATE の 0 rows の応答差を吸収するため、
--   関数冒頭で has_level('orders', 'edit') を明示チェックして均一なエラー応答にする。
--   grant execute は authenticated のみ（anon には付けない）。

begin;

create or replace function save_order(
  p_id                  uuid,
  p_customer_id         uuid,
  p_order_date          date,
  p_status              text,
  p_memo                text,
  p_items               jsonb,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order_id   uuid;
  v_order_no   text;
  v_updated_at timestamptz;
  v_item       jsonb;
  v_line_no    int;
  i            int;
begin
  -- 明示的な権限確認（security invoker の自然な RLS に加え、INSERT/UPDATE で
  -- 応答が違うため（例外 vs 0行）均一なエラー応答にする）
  if not has_level('orders', 'edit') then
    raise exception '受注を保存する権限がありません';
  end if;

  if p_id is null then
    -- ── 新規受注 ──────────────────────────────────────────────
    insert into orders (customer_id, order_date, status, memo)
    values (p_customer_id, p_order_date, p_status, coalesce(p_memo, ''))
    returning id, order_no into v_order_id, v_order_no;

  else
    -- ── 更新：楽観ロック確認 ───────────────────────────────────
    select updated_at into v_updated_at
    from orders
    where id = p_id;

    if not found then
      return jsonb_build_object('result', 'not_found');
    end if;

    if p_expected_updated_at is not null
       and v_updated_at is distinct from p_expected_updated_at then
      return jsonb_build_object('result', 'conflict');
    end if;

    update orders
    set customer_id = p_customer_id,
        order_date  = p_order_date,
        status      = p_status,
        memo        = coalesce(p_memo, ''),
        updated_at  = now()
    where id = p_id;

    if not found then
      return jsonb_build_object('result', 'not_found');
    end if;

    v_order_id := p_id;
    select order_no into v_order_no from orders where id = p_id;

    -- 明細を全削除（後で再 insert）
    delete from order_items where order_id = p_id;
  end if;

  -- ── 明細を insert ─────────────────────────────────────────
  -- amount は generated always なので入れない。
  -- line_no は配列添字から採番（入力側で持つ必要なし）。
  v_line_no := 0;
  for i in 0 .. jsonb_array_length(p_items) - 1 loop
    v_line_no := v_line_no + 1;
    v_item    := p_items -> i;
    insert into order_items (order_id, product_id, name, qty, unit_price, line_no)
    values (
      v_order_id,
      nullif(v_item ->> 'product_id', '')::uuid,
      v_item ->> 'name',
      (v_item ->> 'qty')::int,
      (v_item ->> 'unit_price')::int,
      v_line_no
    );
  end loop;

  return jsonb_build_object(
    'result',   'ok',
    'order_id', v_order_id,
    'order_no', v_order_no
  );
end;
$$;

-- anon と public は呼び出し不可（デフォルトで public に EXECUTE が付くため明示 revoke）
revoke execute on function save_order(uuid, uuid, date, text, text, jsonb, timestamptz)
  from public, anon;
grant execute on function save_order(uuid, uuid, date, text, text, jsonb, timestamptz)
  to authenticated;

commit;
