# SecondFox Starter（型スターター・最小構成）

SecondFoxがお客様のシステムを自動構築するときの「元」になるテンプレートリポジトリです。
このリポジトリを GitHub の Settings で **Template repository** に設定してください。

スタック = Next.js 14 / TypeScript / Supabase / Vercel。

## SecondFoxがこのテンプレをどう使うか

1. このテンプレから新しいリポジトリを生成（お客様のGitHubアカウント配下）。
2. `supabase/migrations/*.sql` をお客様のSupabaseへ順に適用（`0001_init.sql` から）。
3. `.env.example` に書かれた環境変数のキーを読み取り、値を入れてVercelへ投入。
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` はSecondFoxが自動で埋めます。
   - それ以外のキーを足したい場合は `.env.example` に追記すると、本番投入時に入力欄として出ます。
4. お客様のVercelへデプロイ。

## 中身

- `app/page.tsx` … 接続確認用の最小ページ（`notes` テーブルを読んで表示）。
- `lib/supabaseServer.ts` … 公開鍵で動くリクエスト単位のSupabaseクライアント。
- `supabase/migrations/0001_init.sql` … サンプルの初期スキーマ（RLS有効・公開読み取り）。

本番の型スターターは、ここを土台に、実案件から抽出した部品・規約・UI水準（Quarc準拠）で育てていきます。
