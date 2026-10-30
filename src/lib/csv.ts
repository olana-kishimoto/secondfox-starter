/**
 * シンプルCSVパーサー（外部依存なし）
 * RFC 4180 準拠（ダブルクォートエスケープ対応）
 */

/** 0始まり列インデックス → Excel列文字（0→A, 25→Z, 26→AA, …） */
export function colIndexToLetter(idx: number): string {
  let result = "";
  let n = idx;
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
}
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuote) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        row.push(field);
        field = "";
      } else if (ch === '\r' && next === '\n') {
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** ヘッダー行を使って行データをオブジェクトにマップ。
 *  has_header=true 時は見出しキーに加えて "@A"/"@B"… の列位置キーも併設する。
 *  空見出し列で "" キーが衝突する問題も回避（空見出しは位置キーのみ格納）。 */
export function rowsToObjects(rows: string[][], hasHeader: boolean): { headers: string[]; records: Record<string, string>[] } {
  if (rows.length === 0) return { headers: [], records: [] };

  let headers: string[];
  let dataRows: string[][];

  if (hasHeader) {
    headers = rows[0].map((h) => h.trim());
    dataRows = rows.slice(1);
  } else {
    headers = rows[0].map((_, i) => `col${i + 1}`);
    dataRows = rows;
  }

  const records = dataRows
    .filter((r) => r.some((v) => v.trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        // 見出しキー（空は衝突回避のためスキップ）
        if (h) obj[h] = (r[i] ?? "").trim();
        // 列位置キー @A/@B/… を常に追加（has_header 時のみ。has_header=false は col1/col2 が位置キー）
        if (hasHeader) obj[`@${colIndexToLetter(i)}`] = (r[i] ?? "").trim();
      });
      return obj;
    });

  return { headers, records };
}

/** CSVセルの値をboolean に変換 */
export function parseBoolCell(v: string): boolean {
  const lower = v.toLowerCase().trim();
  return lower === "1" || lower === "true" || lower === "yes" || lower === "有効" || lower === "○" || lower === "◯";
}

/** CSVセルの値を数値に変換（カンマ・円記号除去）。浮動小数点表現誤差を小数6桁丸めで吸収。 */
export function parseNumCell(v: string): number {
  const cleaned = v.replace(/[,，¥￥\s]/g, "");
  const n = Number(cleaned);
  if (isNaN(n)) return 0;
  if (Number.isInteger(n)) return n;
  return Math.round(n * 1e6) / 1e6;
}
