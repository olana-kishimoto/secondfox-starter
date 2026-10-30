// パスワードの最低条件（ログインの型）。12文字以上で、弱いものは弾く。
// さらに Supabase 側でも検査される（プロジェクトの Auth 設定：最小長・漏洩パスワードの拒否）。
export const PASSWORD_MIN = 12;

const COMMON = [
  "password", "passw0rd", "qwerty", "qwertyuiop", "asdfghjkl", "letmein", "welcome", "admin", "iloveyou",
  "123456789", "111111111111", "000000000000", "abcdefghijkl", "abc123456789", "changeme", "p@ssw0rd",
  "pa55word", "monkey", "dragon", "football", "baseball", "sunshine", "trustno1", "secondfox",
];

// 問題があれば理由（日本語）、なければ null。
export function passwordProblem(pw: string, email?: string | null): string | null {
  if ([...pw].length < PASSWORD_MIN) return `パスワードは${PASSWORD_MIN}文字以上にしてください。`;
  if (pw.length > 128) return "パスワードが長すぎます（128文字まで）。";
  const lower = pw.toLowerCase();
  if (new Set([...lower]).size < 5) return "同じ文字の繰り返しは使えません。";
  if (COMMON.some((c) => lower.includes(c))) return "よくあるパスワードを含むため使えません。";
  if (/^(?:0123456789|1234567890|abcdefghijklmnopqrstuvwxyz)/.test(lower.replace(/[^a-z0-9]/g, "")) && /^[a-z0-9]+$/.test(lower)) return "連続した文字だけのパスワードは使えません。";
  const local = (email ?? "").split("@")[0].toLowerCase();
  if (local.length >= 4 && lower.includes(local)) return "メールアドレスを含むパスワードは使えません。";
  return null;
}
