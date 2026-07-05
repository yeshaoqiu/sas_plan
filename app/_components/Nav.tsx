"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "今日", icon: "📋" },
  { href: "/rewards", label: "奖励", icon: "🎁" },
  { href: "/growth", label: "成长", icon: "🌱" },
  { href: "/records", label: "记录", icon: "📖" },
  { href: "/manage", label: "管理", icon: "⚙️" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <>
      {/* 桌面端：顶部横向导航 */}
      <nav className="hidden items-center gap-1 bg-white px-6 py-3 shadow-sm sm:flex">
        <span className="mr-3 text-lg font-extrabold text-amber-600">🎒 学习陪跑</span>
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 font-medium ${
                active ? "bg-amber-500 text-white" : "hover:bg-amber-100"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>

      {/* 移动端：顶部标题栏 */}
      <header className="flex items-center justify-center bg-white px-4 py-3 shadow-sm sm:hidden">
        <span className="text-lg font-extrabold text-amber-600">🎒 学习陪跑</span>
      </header>

      {/* 移动端：底部固定 Tab 栏 */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-amber-100 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_8px_rgba(0,0,0,0.05)] sm:hidden">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
                active ? "text-amber-600" : "text-slate-400"
              }`}
            >
              <span className="text-xl leading-none">{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
