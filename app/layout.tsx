import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "学习陪跑" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <nav className="flex items-center gap-1 bg-white px-6 py-3 shadow-sm">
          <span className="mr-3 text-lg font-extrabold text-amber-600">🎒 学习陪跑</span>
          <a href="/" className="rounded-full px-3 py-1.5 font-medium hover:bg-amber-100">今日清单</a>
          <a href="/rewards" className="rounded-full px-3 py-1.5 font-medium hover:bg-amber-100">奖励商店</a>
          <a href="/records" className="rounded-full px-3 py-1.5 font-medium hover:bg-amber-100">记录</a>
          <a href="/manage" className="rounded-full px-3 py-1.5 font-medium hover:bg-amber-100">管理</a>
        </nav>
        <main className="mx-auto max-w-3xl p-6">{children}</main>
      </body>
    </html>
  );
}
