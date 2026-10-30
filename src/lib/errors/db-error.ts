/**
 * Supabase/PostgreSQL エラーをユーザー向け日本語メッセージに変換する。
 * 英語の技術的エラーをそのままユーザーに見せないためのヘルパー。
 */

type PostgresError = {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

// ─── HTML/長大メッセージのサニタイズ ────────────────────────────
const HTML_THRESHOLD = 300;

/**
 * Cloudflare 520 等でレスポンスボディ（HTML全文）がエラーメッセージに
 * 入り込む場合を検出し、定型文に置き換える。
 * HTTPステータスコードが抽出できれば括弧書きで付ける。
 */
function extractHttpStatus(msg: string): string | null {
  // "520", "502", "503" 等の3桁コードを探す
  const m = msg.match(/\b(5\d{2}|4\d{2})\b/);
  return m ? m[1] : null;
}

function isHtmlResponse(msg: string): boolean {
  const trimmed = msg.trimStart();
  return (
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<!doctype") ||
    trimmed.startsWith("<html") ||
    trimmed.startsWith("<HTML") ||
    // Cloudflare エラーページ等のマーカー
    trimmed.includes("</html>") ||
    trimmed.includes("</HTML>")
  );
}

/**
 * 生の error.message をユーザーに表示する前にサニタイズする。
 * - HTML レスポンスは定型文に変換
 * - 300文字超は定型文に変換（日本語バリデーションメッセージは短いため影響なし）
 * - 通常の短いメッセージはそのまま返す
 */
export function sanitizeDbMessage(msg: string): string {
  if (isHtmlResponse(msg) || msg.length > HTML_THRESHOLD) {
    const status = extractHttpStatus(msg);
    return status
      ? `データベースに一時的に接続できません。しばらく待って再試行してください。（コード: ${status}）`
      : "データベースに一時的に接続できません。しばらく待って再試行してください。";
  }
  return msg;
}

// ─── 日本語文字が含まれているか判定 ─────────────────────────────────
function containsJapanese(str: string): boolean {
  return /[　-鿿豈-﫿＀-￯]/.test(str);
}

// ────────────────────────────────────────────────────────────
// スキーマ系（致命的）エラーの変換
// ────────────────────────────────────────────────────────────

/** 列名不足・制約欠如など、スキーマ未適用が原因のエラーを日本語化する。 */
function translateSchemaError(err: PostgresError): string | null {
  const code = err.code ?? "";
  const msg  = err.message;
  const low  = msg.toLowerCase();

  // 42703: undefined_column — 列が存在しない
  if (code === "42703" || (low.includes("column") && low.includes("does not exist"))) {
    const m = msg.match(/column "([^"]+)"/i);
    return m
      ? `列 "${m[1]}" がデータベースに存在しません。マイグレーション未適用の可能性があります。`
      : "指定した列がデータベースに存在しません。マイグレーション未適用の可能性があります。";
  }

  // 42P01: undefined_table — テーブルが存在しない
  if (code === "42P01" || (low.includes("relation") && low.includes("does not exist"))) {
    const m = msg.match(/relation "([^"]+)"/i);
    return m
      ? `テーブル "${m[1]}" がデータベースに存在しません。マイグレーション未適用の可能性があります。`
      : "対象テーブルがデータベースに存在しません。マイグレーション未適用の可能性があります。";
  }

  // 42P10 / ON CONFLICT 一意制約なし
  if (
    code === "42P10" ||
    low.includes("no unique or exclusion constraint") ||
    low.includes("on conflict specification")
  ) {
    return "対象テーブルに ON CONFLICT 用の一意制約が見つかりません（DB の制約定義をご確認ください）。";
  }

  // PostgREST スキーマキャッシュ不整合
  if (low.includes("could not find a relationship") || low.includes("schema cache")) {
    return "データベーススキーマキャッシュが古い状態です。しばらく待ってから再試行してください。";
  }

  return null;
}

/**
 * スキーマ系（致命的）DBエラーかどうかを判定する。
 * true のとき、行単位リトライは無意味なので即中断すべき。
 */
export function isFatalDbError(err: PostgresError): boolean {
  const code = err.code ?? "";
  const msg  = err.message.toLowerCase();
  const fatalCodes = ["42703", "42P01", "42P10", "42501", "57014", "25P02", "53300"];
  if (fatalCodes.includes(code)) return true;
  if (msg.includes("does not exist")) return true;
  if (msg.includes("no unique or exclusion constraint")) return true;
  if (msg.includes("could not find a relationship")) return true;
  if (msg.includes("schema cache")) return true;
  return false;
}

/** 制約名から FK 違反時の日本語ヒントを生成する（23503 用） */
function constraintHint(constraint: string | undefined): string {
  if (!constraint) return "";
  const c = constraint.toLowerCase();
  if (c.includes("customer")) return "顧客を選択してください。";
  return "関連する項目が見つかりません。";
}

/** CHECK 制約名から違反メッセージを推定する（23514 用） */
function checkConstraintMsg(constraint: string | undefined): string {
  if (!constraint) return "入力値が許可された範囲外です。";
  const c = constraint.toLowerCase();
  if (c.includes("status")) return "状態の値が不正です。";
  if (c.includes("amount")) return "金額が不正です（0以上を入力してください）。";
  if (c.includes("date")) return "日付の指定が不正です。";
  return "入力値が許可された範囲外です。";
}

/** 列名を日本語化する（主要列名のみ） */
function columnLabel(col: string | undefined): string {
  if (!col) return "";
  const map: Record<string, string> = {
    customer_id: "顧客",
    case_no:     "案件番号",
    title:       "件名",
    status:      "状態",
    amount:      "金額",
    due_date:    "期限",
    name:        "名前",
    email:       "メールアドレス",
  };
  return map[col] ?? col;
}

/** PostgreSQL エラーコードからユーザー向け日本語メッセージを返す */
export function translateDbError(err: PostgresError): string {
  // 0. HTML/長大メッセージ（Cloudflare 520 等）は定型文に変換
  if (isHtmlResponse(err.message) || err.message.length > HTML_THRESHOLD) {
    const status = extractHttpStatus(err.message);
    console.error("[db-error] HTML/oversized message detected", err.code, err.message.slice(0, 120));
    return status
      ? `データベースに一時的に接続できません。しばらく待って再試行してください。（コード: ${status}）`
      : "データベースに一時的に接続できません。しばらく待って再試行してください。";
  }

  // 1. message が既に日本語なら（RPC RAISE EXCEPTION 等）そのまま返す
  if (containsJapanese(err.message)) return err.message;

  // 2. スキーマ系エラーを先に判定（42703/42P01/42P10 など）
  const schemaMsg = translateSchemaError(err);
  if (schemaMsg) return schemaMsg;

  const code = err.code ?? "";

  // 3. P0001: RPC の RAISE EXCEPTION（日本語チェック済みだが念のため）
  if (code === "P0001") {
    return err.message || "処理中にエラーが発生しました。";
  }

  // 制約名を message / details から抽出する試み
  const constraintMatch =
    err.message.match(/constraint["\s]+"?([a-z0-9_]+)"?/i) ??
    (err.details ?? "").match(/constraint["\s]+"?([a-z0-9_]+)"?/i);
  const constraint = constraintMatch?.[1];

  // 列名を message / details から抽出する試み
  const columnMatch =
    err.message.match(/column["\s]+"?([a-z0-9_]+)"?/i) ??
    (err.details ?? "").match(/column["\s]+"?([a-z0-9_]+)"?/i);
  const column = columnMatch?.[1];

  switch (code) {
    case "23503": {
      // foreign_key_violation
      const hint = constraintHint(constraint);
      return hint || "関連する項目が未選択または存在しません（選択内容を確認してください）。";
    }

    case "23505":
      // unique_violation
      return column
        ? `${columnLabel(column)} はすでに同じ値が登録されています。`
        : "すでに同じ値が登録されています。";

    case "23502": {
      // not_null_violation
      const label = columnLabel(column);
      return label
        ? `${label} は必須項目です（未入力です）。`
        : "必須項目が未入力です。";
    }

    case "23514":
      // check_violation
      return checkConstraintMsg(constraint);

    case "22P02":
      // invalid_text_representation
      return "数値または日付の形式が不正です。";

    case "22003":
      // numeric_value_out_of_range
      return "数値が許容範囲を超えています。";

    case "42501":
      // insufficient_privilege
      return "この操作を実行する権限がありません。";

    case "40001":
    case "40P01":
      // serialization / deadlock
      return "同時に別の操作が行われています。少し待ってから再試行してください。";

    case "42725":
      // ambiguous_function
      return "処理関数が重複しています。管理者にお問い合わせください。";

    default:
      // 予期しないエラーは原文を開発ログに出し、ユーザーには汎用メッセージ
      console.error("[db-error]", code, err.message, err.details);
      return code
        ? `保存に失敗しました（${code}）。管理者にお問い合わせください。`
        : "処理中にエラーが発生しました。時間をおいて再度お試しください。";
  }
}

/**
 * 非 DB 例外（ネットワーク/パースエラー等）のフォールバック変換。
 * Error オブジェクトまたは Supabase error どちらでも受け付ける汎用ラッパー。
 */
export function toUserMessage(
  e: unknown,
  fallback = "処理中にエラーが発生しました。時間をおいて再度お試しください。"
): string {
  if (!e) return fallback;
  // Supabase error: code プロパティがある
  if (typeof e === "object" && "message" in e) {
    const obj = e as { code?: string; message: string; details?: string; hint?: string };
    if (obj.code !== undefined) return translateDbError(obj);
    // 日本語メッセージはそのまま
    if (containsJapanese(obj.message)) return obj.message;
  }
  if (e instanceof Error && containsJapanese(e.message)) return e.message;
  console.error("[toUserMessage]", e);
  return fallback;
}
