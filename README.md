# SecondFox Starter（業務システムの型）

SecondFox がお客様のシステムを新規作成するときの「元」になるテンプレートです（GitHub の Template repository に設定）。
作った瞬間から、Quarc / kobeya 水準の見た目と部品が揃っています。

スタック = Next 16 / React 19 / Tailwind v4 / @fontsource/noto-sans-jp / Supabase（@supabase/ssr）/ Vercel / pnpm。

## SecondFox がこのテンプレをどう使うか

1. このテンプレから新しいリポジトリを生成（お客様の GitHub アカウント配下）。
2. `supabase/migrations/*.sql` をお客様の Supabase へ順に適用（`0001_init.sql` から）。
3. `.env.example` のキーを読み取り、値を入れて Vercel へ投入（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` は自動。足したいキーは `.env.example` に追記）。
4. お客様の Vercel へデプロイ。**トップに「案件一覧」が出れば、接続・スキーマ・鍵・デプロイが通っています**（接続確認専用の画面は無い）。

## 設計の前提（係はここを読む）

- **デザインシステムと部品は雛形に焼き込み済み**。色・角丸・フォントは `src/app/globals.css` のトークン経由（直値の色は書かない）。
- **係は、この上に「業務の流れ」を足すだけ**。画面は見本の「案件」と同じ作り（PageHeader → 検索カード → 一覧 → 登録・編集フォーム）で足し、ナビは `src/lib/menu.ts` に業務の流れ順で並べる。見出しは機能名そのまま。
- **業種ロジックは足さない**。会計・在庫・モール連携などの業種固有の lib はこのテンプレに入れない（案件ごとのリポジトリで作る）。
- ボタンは `components/ui` の `Button` / `LinkButton` / `SubmitButton`、確認は `ConfirmModal`、通知は `FlashMessage`。`window.confirm` / `alert` は使わない。
- ステータスのラベルと色は `src/lib/labels.ts` に集約。日時は `src/lib/format.ts`（Asia/Tokyo）。

## 中身

- `src/app/(app)/` … アプリシェル（`AppShell.tsx`：サイドバー＋ページ本体＋スマホの上部バー／下部タブ）、`loading.tsx`、`error.tsx`。
  - `page.tsx` … 見本画面「案件一覧」（検索カード・保存条件・見出しクリックの並べ替え・サーバーのページ送り・StatusBadge。スマホはカード表示）。
  - `cases/new`・`cases/[id]` … 登録・編集（Field 類・顧客の検索モーダル・SubmitButton・ConfirmModal・FlashMessage）。`cases/actions.ts` が Server Action。
  - `master/` … マスタの見本（SubNav ＋ DataCard）。
- `src/components/` … `Sidebar` / `MobileTabBar` / `NavProgress` / `icons` と、`ui/`（Button, PageHeader, SubNav, StatusBadge, DataCard, Pagination, SearchModal, SearchTemplates, ConfirmModal, FlashMessage, Field, DateField, MonthField, SubmitButton, Skeleton, Tip）、`print/`（PrintSheet・BackButton：ブラウザ印刷の共通基盤。帳票を作るときに使う）。
- `src/lib/` … `format` / `labels` / `errors/db-error` / `fold-search` / `csv` / `csv-escape` / `cn` / `redirect` / `menu` / `app-info`（システム名）と、`supabase/`（`admin.ts` = サーバー専用 service_role、`server.ts` / `client.ts` = 公開鍵・RLS）。
- `src/app/api/health/route.ts` … 死活監視の口（`{ ok: true }` だけ返す）。ログインや合言葉のゲートを足したら、ここは必ず除外すること。
- `supabase/migrations/0001_init.sql` … 見本が動く最小スキーマ（`customers` / `cases` / `search_templates`）。全テーブル RLS 有効・明示 GRANT つき。初期データ（顧客5・案件42）は本番に出す前に消してよい。

## 認証について（重要）

この型にはログインが入っていません。画面はサーバー側で service_role を使って読み書きし、RLS は有効のまま anon / authenticated には何も許可していません（ブラウザから直接 DB を叩く経路は閉じてあります）。
ただし**ログインを足すまでは、URL を知っている人は誰でも画面を操作できます**。お客様に渡す前に必ず認証を足し、画面側を `supabase/server.ts` の `createClient()` と利用者ごとの RLS ポリシー（新しい番号のマイグレーション）へ切り替えること。

## 開発

```
pnpm install
pnpm dev          # 環境変数（.env.local）に Supabase の値が要る
pnpm typecheck && pnpm build
```
