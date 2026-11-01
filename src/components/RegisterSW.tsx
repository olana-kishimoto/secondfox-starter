"use client";
import { useEffect } from "react";

// サービスワーカーを登録するだけ（見た目なし）。本番のみ。キャッシュの方針は public/sw.js。
export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => { /* 登録できなくても通常どおり使える */ });
  }, []);
  return null;
}
