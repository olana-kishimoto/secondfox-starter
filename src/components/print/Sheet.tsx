import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/** A4 台紙ラッパ。印刷時はこの要素だけが出力される。 */
export function Sheet({ children, className }: Props) {
  return (
    <div className={["sheet", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
