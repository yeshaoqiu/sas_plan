import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "学习陪跑" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-slate-50 text-slate-900">
        <nav className="flex gap-4 bg-white px-6 py-3 shadow-sm">
          <a href="/" className="font-semibold">今日清单</a>
          <a href="/rewards">奖励商店</a>
          <a href="/manage">管理</a>
        </nav>
        <main className="mx-auto max-w-3xl p-6">{children}</main>
      </body>
    </html>
  );
}
