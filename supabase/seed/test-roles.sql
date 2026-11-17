-- テスト専用シード。本番初期化には使わない。
-- supabase ローカルの db reset（CI / ローカル開発）でのみ流れる。
-- test-rls.mjs が期待するテストユーザー 2 名を auth.users に登録する。
-- _auto_profile トリガが profiles を自動で作るため、profiles への直接 insert は不要。

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '00000000-0000-4001-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@test.local',
    crypt('Password1!', gen_salt('bf')),
    '{"role": "admin"}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-4001-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'tantou@test.local',
    crypt('Password1!', gen_salt('bf')),
    '{}',
    '{}',
    now(),
    now()
  )
on conflict (id) do nothing;
