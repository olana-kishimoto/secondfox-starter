"use client";

import { useEffect } from "react";
import { BackButton } from "./BackButton";

// A4・olanaトーンの共通印刷シート。表示時はグレー下地＋白紙、印刷時は @page 余白で出力。
function buildCss(orientation: "portrait" | "landscape") {
  const pageSize    = orientation === "landscape" ? "A4 landscape" : "A4";
  const printWidth  = orientation === "landscape" ? "297mm" : "210mm";
  const screenWidth = orientation === "landscape" ? "273mm" : "186mm";
  return `
@page { size: ${pageSize}; margin: 0; }
@media screen {
  .print-area { background: #edece7; min-height: 100vh; padding: 24px 0; }
  .print-sheet { border: 1px solid #e2e1db; box-shadow: 0 1px 3px rgba(69,69,69,0.08); padding: 12mm; }
}
@media print {
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
  .no-print { display: none !important; }
  .print-sheet {
    width: ${printWidth} !important;
    padding: 14mm !important;
    box-sizing: border-box !important;
    border: none !important;
    box-shadow: none !important;
  }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
.print-sheet { width: ${screenWidth}; margin: 0 auto; background: #fff; color: #454545; }
.print-sheet table { border-collapse: collapse; width: 100%; }
.print-sheet thead { display: table-header-group; }
.print-sheet tr { break-inside: avoid; page-break-inside: avoid; }
.print-sheet .no-break { break-inside: avoid; page-break-inside: avoid; }
`;
}

export function PrintSheet({
  docTitle,
  orientation = "portrait",
  children,
}: {
  docTitle: string;
  orientation?: "portrait" | "landscape";
  children: React.ReactNode;
}) {
  useEffect(() => {
    const prev = document.title;
    document.title = docTitle;
    const t = setTimeout(() => window.print(), 450);
    return () => { clearTimeout(t); document.title = prev; };
  }, [docTitle]);

  const isLandscape  = orientation === "landscape";
  const previewWidth = isLandscape ? "273mm" : "186mm";
  const maxVw        = isLandscape ? "98vw"  : "94vw";

  return (
    <div className="print-area">
      <style>{buildCss(orientation)}</style>
      <div
        className="no-print mx-auto mb-3 flex items-center justify-end gap-2"
        style={{ width: previewWidth, maxWidth: maxVw }}
      >
        <button
          type="button"
          onClick={() => window.print()}
          className="h-9 rounded bg-accent px-5 text-[12px] font-medium text-white hover:opacity-90"
        >
          印刷 / PDF保存
        </button>
        <BackButton className="h-9 rounded border border-line bg-surface px-4 text-[12px] text-text hover:border-accent hover:text-accent" />
      </div>
      <div className="print-sheet">{children}</div>
    </div>
  );
}
