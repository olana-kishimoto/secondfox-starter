const MAX_DISPLAY_LEN = 300;

function truncate(s: string): string {
  return s.length > MAX_DISPLAY_LEN ? s.slice(0, MAX_DISPLAY_LEN) + "…" : s;
}

export function FlashMessage({
  msg,
  error,
}: {
  msg?: string;
  error?: string;
}) {
  if (!msg && !error) return null;
  if (error) {
    return (
      <div className="mb-4 rounded border border-bad/30 bg-bad-bg px-3 py-2 text-[12.5px] text-bad">
        {truncate(error)}
      </div>
    );
  }
  return (
    <div className="mb-4 rounded border border-ok/30 bg-ok-bg px-3 py-2 text-[12.5px] text-ok">
      {truncate(msg!)}
    </div>
  );
}
