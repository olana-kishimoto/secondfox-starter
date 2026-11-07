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

- `vercel.json` … 実行リージョンを東京（`hnd1`）に固定。Supabase を東京（ap-northeast-1）で作る前提と揃えるため。未指定だと Vercel の既定が米国になり、画面を出すたびに DB と太平洋を往復して致命的に遅い。地域が日本以外の客は、Vercel と Supabase の両方をその地域にそろえる。
- `src/app/(app)/` … アプリシェル（`AppShell.tsx`：サイドバー＋ページ本体＋スマホの上部バー／下部タブ）、`loading.tsx`、`error.tsx`。
  - `page.tsx` … 見本画面「案件一覧」（検索カード・保存条件・見出しクリックの並べ替え・サーバーのページ送り・StatusBadge。スマホはカード表示）。
  - `cases/new`・`cases/[id]` … 登録・編集（Field 類・顧客の検索モーダル・SubmitButton・ConfirmModal・FlashMessage）。`cases/actions.ts` が Server Action。
  - `master/` … マスタの見本（SubNav ＋ DataCard）。
- `src/components/` … `Sidebar` / `MobileTabBar` / `NavProgress` / `icons` と、`ui/`（Button, PageHeader, SubNav, StatusBadge, DataCard, Pagination, SearchModal, SearchTemplates, ConfirmModal, FlashMessage, Field, DateField, MonthField, SubmitButton, Skeleton, Tip）、`print/`（PrintSheet・BackButton：ブラウザ印刷の共通基盤。帳票を作るときに使う）。
- `.github/workflows/ops-heartbeat.yml` … このシステムは Den に心拍（15分ごと）を送る。トークン（`DEN_URL` / `OPS_TOKEN` / `APP_HEALTH_URL`）は本稼働時に司令塔が自動で入れる。未設定のあいだは何もせず正常終了する。
- `src/middleware.ts` … 入口のアクセスコード（任意・既定OFF）＋ログイン確認の2段。`src/app/login/`（ログイン）、`src/app/(app)/account/`（パスワード変更）。
- `src/lib/` … `password`（パスワード条件）、`format` / `labels` / `errors/db-error` / `fold-search` / `csv` / `csv-escape` / `cn` / `redirect` / `menu` / `app-info`（システム名）と、`supabase/`（`server.ts` = ログイン中の利用者として動く標準の入口、`middleware.ts` = ログイン確認、`client.ts`、`admin.ts` = 特権操作だけの service_role）。
- `src/app/api/health/route.ts` … 死活監視の口（DB に軽く1本届くことまで確かめ、`{ ok }` だけ返す。落ちていれば 503）。ログインやアクセスコードのゲートを足したら、ここは必ず除外すること。
- `supabase/migrations/0001_init.sql` … 見本が動く最小スキーマ（`customers` / `cases` / `search_templates`）。全テーブル RLS 有効・明示 GRANT つき。`0002_auth_rls.sql` で「ログイン済みだけ読み書き可」に作り直す。初期データ（顧客5・案件42）は本番に出す前に消してよい。

## アクセス制御（焼き込み済みの型）

お客様に渡せる状態で出荷される。**入口のアクセスコード（任意・既定OFF） → ログイン → RLS** の3段で守る。

1. **入口＝アクセスコード**（`src/middleware.ts`）。玄関を隠し、第三者を画面に近づけない任意の層（本人確認ではない）。**既定はOFF**で、素通りでログイン画面へ進む。
   - 有効にするのは `ACCESS_ENABLED="true"` のときだけ（SecondFox のセキュリティ設定でONにすると、`ACCESS_ENABLED=true` とアクセスコード `ACCESS_KEYS` が Vercel に入る）。
   - env `ACCESS_KEYS`（アクセスコード。内部的には32桁で、32桁以外は無視・カンマ区切りで複数可・1本消せばそのコードだけ即失効）と照合。フォーム送信（`/__access`）。画面には「アクセスコード」「コード」とだけ出て、「32桁」の語は出ない。
   - Cookie は生のアクセスコードでなく HMAC-SHA256 署名（鍵は `ACCESS_COOKIE_SECRET`）。httpOnly。有効期限はスライディング60日・端末ごと（通過のたびに貼り直す）。
   - 有効（`ACCESS_ENABLED="true"`）なのにアクセスコードまたは署名鍵 `ACCESS_COOKIE_SECRET` が未設定だと**誰も入れない**（安全側に止まる）。`ACCESS_ENABLED` が未設定・`true` 以外なら入口は無効で、この層は何もしない。
2. **内側＝Supabase Auth のログイン**（`/login`、`src/lib/supabase/middleware.ts`）。自己登録なし・メール認証なし。パスワードは12文字以上で、弱いものは弾く（`src/lib/password.ts` と Supabase 側の検査）。`/account` で自分のパスワードを変更。
3. **読み書きはログイン中の利用者として**（`src/lib/supabase/server.ts` の `createClient()`）。**ページと Server Action で service_role は使わない**。`admin.ts` の service_role は、権限確認が済んだ特権操作（例：管理者による利用者の作成）にだけ使う。
4. **RLS**（`supabase/migrations/0002_auth_rls.sql`）：ログイン済み（authenticated）は業務テーブルを読み書きできる、anon は何もできない。1社専用なのでテナント分割はしない（ログイン済み＝そのお客様のスタッフ）。検索条件の保存だけ利用者ごと。

### middleware の約束事（崩さない）

- 公開の口は**完全一致**で判定する：`/login`（アクセスコードは通すがログイン確認は通さない）、`/api/health`（`{ ok }` だけ返す監視口。アクセスコードもログインも不要）。公開の口を `updateSession` に通すと、未ログイン→`/login` へ 307 で結局弾かれる。
- `/api/webhooks/` と `/api/cron/` は入口のアクセスコードから外してある。**その口の中で、自前の鍵（署名・`CRON_SECRET`）を必ず検証すること**（検証しないと誰でも叩ける）。
- Next 16 は `middleware` を `proxy` に改名する方向で、dev で非推奨の警告が出る（動作する）。移行は `src/middleware.ts` → `src/proxy.ts`、関数名 `middleware` → `proxy`。

### 新規作成時に必ずやること（漏れると安全でない）

- **Supabase の Auth で「サインアップ（新規登録）」を無効にする**（Authentication → Sign In / Providers → "Allow new users to sign up" を OFF）。anon キーはブラウザに配られるため、これを OFF にしないと誰でもアカウントを作って「ログイン済み」になり、RLS を通れてしまう。パスワードの最小長も12に設定し、可能なら漏洩パスワードの拒否を有効にする。
- **初期ユーザーは Supabase で作る**（Authentication → Users → Add user、またはプロビジョニング時に Auth の Admin API で作る）。自己登録はさせない。メール確認済みで作り、仮パスワードは本人に安全な方法で渡す（DB・ログに残さない）。本人は `/account` で変更する。
  - 雛形にはユーザー追加の画面は入れていない（利用者そのものは Supabase で作る）。役割の割り当ては、下の「役割と権限」の画面でできる。
- 入口のアクセスコードを使うときだけ、`ACCESS_ENABLED=true`・`ACCESS_KEYS`（アクセスコード。内部的には32桁）・`ACCESS_COOKIE_SECRET` を Vercel に入れる（既定は入口OFFで、入れなくてもログイン画面に進む）。Supabase の3つ以外は自動では入らない。

## 役割と権限（認証の内側の出し分け）

入口のアクセスコード・ログイン・0002 の RLS は変えず、その**上に足す**土台です（`supabase/migrations/0003_roles.sql`）。営業・経理などの具体的な役割は入れていません。**各システムが自分の役割を決めて使います。**

- **役割はデータ**：`roles`（役割の一覧）と `profiles`（利用者ごとの役割。1人1役割・行が無ければ「役割なし」）。決め打ちの enum にしない。`admin` だけは予約の特別役割＝全部見える。既定の種は `admin`（管理者）と `staff`（担当者）の2つだけ。
- **判定（サーバー）**：`src/lib/roles.ts` の `currentRole()` / `isAdmin()` / `hasRole("sales", …)` / `requireRole("sales")` / `requireAdmin()`。レイアウト・ページ・Server Action で使う。ページや Server Action の**最初**で `requireRole(...)` を呼び、操作そのものを止める。純関数は `src/lib/roles-core.ts`。
- **見た目の出し分け**：`src/lib/menu.ts` の項目に `roles: ["sales"]` を付けると、その役割（と管理者）にだけ出る（`roles: []` なら管理者だけ）。付けない項目は、ログイン済みなら全員に出る（従来どおり）。
- **隠す＝守る、ではない**：メニューやボタンを隠しても、URL を直接開く・操作を直接呼ぶことは止まりません。**守るべきデータは、必ず RLS でも閉じてください。**
- **RLS の型**：`0003_roles.sql` の `sample_notes` が見本。読むのは「管理者と、列挙した役割だけ」、書くのは管理者だけ。

  ```sql
  create policy x_read on x for select to authenticated using (app_has_role(array['sales']));   -- 営業と管理者だけ読める
  create policy x_write on x for all to authenticated using (app_is_admin()) with check (app_is_admin());
  ```
  `app_has_role(keys)`（管理者は常に true／役割なしは false）、`app_is_admin()`、`app_role()` を使う。表ごとのポリシーは各システムが書く。既存の `cases` / `customers` は 0002 のまま（ログイン済みなら全員）。絞りたい表だけ作り直す。見本の `sample_notes` は、実際の表ができたら消してよい。
- **割り当て**：管理者が `/admin/roles`（メニュー「利用者と役割」）で、利用者ごとの役割と、役割の追加ができる。自分で自分の役割は変えられない（RLS）。自分の管理者の役割は外せない。
- **最初の管理者**：新規作成時に、サーバー側（service_role）で最初の1人を `profiles` に入れる（`insert into profiles (user_id, role) values ('<auth.users の id>', 'admin')`）。この1人がいないと、役割の画面は誰も開けない。仮パスワードなどの秘密は DB・ログに残さない。
- 0003 が未適用でも、既存の画面は動く（`currentRole()` は「役割なし」を返す）。

テスト：`pnpm test`（役割の判定・メニューの出し分け・実際の Postgres での RLS・既存の守りが変わっていないこと）。

## 開発

```
pnpm install
pnpm dev          # .env.local に Supabase の値と ACCESS_*。入口は既定で無効（有効にするときだけ ACCESS_ENABLED=true と ACCESS_KEYS）
pnpm typecheck && pnpm build
```
