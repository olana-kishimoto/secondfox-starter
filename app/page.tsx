import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type Note = { id: string; title: string; body: string };

export default async function Home() {
  const configured = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  let notes: Note[] = [];
  let error: string | null = null;

  if (configured) {
    try {
      const sb = supabaseServer();
      const { data, error: e } = await sb
        .from("notes")
        .select("id,title,body")
        .order("created_at", { ascending: true });
      if (e) error = e.message;
      else notes = (data as Note[]) ?? [];
    } catch (e) {
      error = e instanceof Error ? e.message : "接続に失敗しました";
    }
  }

  const ok = configured && !error;

  return (
    <main>
      <div className="card">
        <h1>SecondFox Starter</h1>
        <p className="sub">型スターター（最小構成）。SecondFoxがこのテンプレから新しいシステムを作ります。</p>

        <span className={`status ${ok ? "ok" : "ng"}`}>
          <span className="dot" />
          {ok ? "Supabaseに接続できています" : configured ? "接続エラー" : "未設定（環境変数がまだ）"}
        </span>

        {error ? <p className="sub" style={{ marginTop: 16 }}>詳細: {error}</p> : null}

        {ok ? (
          <ul className="notes">
            {notes.map((n) => (
              <li key={n.id}>
                <div className="t">{n.title}</div>
                <div className="b">{n.body}</div>
              </li>
            ))}
            {notes.length === 0 ? <li className="b">データがまだありません。</li> : null}
          </ul>
        ) : null}

        <p className="foot">
          このページが正常に表示され「ようこそ」が見えていれば、リポジトリ作成・Supabaseへのスキーマ適用・鍵の投入・デプロイまでが通っています。
        </p>
      </div>
    </main>
  );
}
