import "./globals.css";
import type { ReactNode } from "react";
import { Nav } from "./_components/Nav";

export const metadata = { title: "学习陪跑" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Nav />
        <main className="mx-auto max-w-3xl p-6">{children}</main>
      </body>
    </html>
  );
}
