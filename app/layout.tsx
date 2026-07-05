import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Nav } from "./_components/Nav";

export const metadata: Metadata = {
  title: "学习陪跑",
  applicationName: "学习陪跑",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "学习陪跑",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon-apple.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f59e0b",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Nav />
        <main className="mx-auto max-w-3xl px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-8 sm:pt-6">
          {children}
        </main>
      </body>
    </html>
  );
}
