import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/app-info";

// ホーム画面に追加できる最小のマニフェスト（/manifest.webmanifest）。
// システム名は NEXT_PUBLIC_APP_NAME（SecondFox が新規作成時に埋める）。未設定なら lib/app-info.ts の名前。
// 全画面（standalone）で開くだけ。オフライン動作はしない（public/sw.js の方針を参照）。
export default function manifest(): MetadataRoute.Manifest {
  const name = (process.env.NEXT_PUBLIC_APP_NAME ?? "").trim() || APP_NAME;
  return {
    name,
    short_name: name.length > 12 ? name.slice(0, 12) : name,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#9a1a3c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
