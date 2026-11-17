"use client";

import { useActionState, useState } from "react";
import { addUser, resetPassword, type UserActionState } from "./actions";

const init: UserActionState = { ok: false };

export function AddUserForm({ roles }: { roles: { id: string; name: string }[] }) {
  const [state, dispatch, pending] = useActionState(addUser, init);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const copy = async () => {
    if (!state.tmpPassword) return;
    try { await navigator.clipboard.writeText(state.tmpPassword); setCopied(true); } catch { /* 手動選択 */ }
  };

  if (state.ok && state.tmpPassword && !dismissed) {
    return (
      <div>
        <div style={{ border: "2px solid var(--bad, #c0392b)", borderRadius: 10, padding: "16px 18px", background: "#FFF6F4" }}>
          <strong style={{ color: "var(--bad, #c0392b)", display: "block", marginBottom: 8 }}>
            この画面を離れると二度と表示されません。今すぐ控えてください。
          </strong>
          <div className="text-[13px] text-muted mb-1">追加した利用者：{state.email}</div>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="text-[13px]">仮パスワード</span>
            <code className="flex-1 min-w-0 bg-white border border-line rounded px-3 py-1.5 text-[13px] font-mono tracking-wider">{state.tmpPassword}</code>
            <button type="button" className="secondary" onClick={copy}>{copied ? "コピーしました" : "コピー"}</button>
          </div>
          <button type="button" className="text-[12px] text-muted underline" onClick={() => { setDismissed(true); setCopied(false); }}>表示を消す</button>
        </div>
      </div>
    );
  }

  return (
    <form action={dispatch} className="form-width">
      {state.error && <p className="error mb-3">{state.error}</p>}
      <div className="field">
        <label htmlFor="add-email">メールアドレス</label>
        <input id="add-email" name="email" type="email" required autoComplete="off" placeholder="user@example.com" />
      </div>
      <div className="field">
        <label htmlFor="add-role">役割</label>
        <select id="add-role" name="role_id" required>
          <option value="">選択してください</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>
      <div className="form-actions">
        <span className="save">追加すると、仮パスワードが1回だけ表示されます</span>
        <button type="submit" className="primary" disabled={pending}>{pending ? "処理中…" : "利用者を追加する"}</button>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ userId, email }: { userId: string; email: string }) {
  const [state, dispatch, pending] = useActionState(resetPassword, init);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const copy = async () => {
    if (!state.tmpPassword) return;
    try { await navigator.clipboard.writeText(state.tmpPassword); setCopied(true); } catch { /* 手動選択 */ }
  };

  if (state.ok && state.tmpPassword && !dismissed) {
    return (
      <div style={{ border: "2px solid var(--bad, #c0392b)", borderRadius: 8, padding: "12px 14px", background: "#FFF6F4", marginTop: 8 }}>
        <strong style={{ color: "var(--bad, #c0392b)", display: "block", marginBottom: 6, fontSize: 12 }}>この画面を離れると消えます</strong>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="flex-1 min-w-0 bg-white border border-line rounded px-2 py-1 text-[12px] font-mono">{state.tmpPassword}</code>
          <button type="button" className="secondary" style={{ fontSize: 12, padding: "4px 10px" }} onClick={copy}>{copied ? "✓" : "コピー"}</button>
        </div>
        <button type="button" className="text-[11px] text-muted underline mt-1" onClick={() => { setDismissed(true); setCopied(false); }}>消す</button>
      </div>
    );
  }

  return (
    <form action={dispatch}>
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="email" value={email} />
      {state.error && <p className="text-[11px] text-bad mt-1">{state.error}</p>}
      <button type="submit" className="secondary" style={{ fontSize: 12, padding: "4px 10px" }} disabled={pending}>
        {pending ? "処理中…" : "仮パスワード再発行"}
      </button>
    </form>
  );
}
