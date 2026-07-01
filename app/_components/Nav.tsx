"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "今日清单" },
  { href: "/rewards", label: "奖励商店" },
  { href: "/growth", label: "成长" },
  { href: "/records", label: "记录" },
  { href: "/manage", label: "管理" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 bg-white px-6 py-3 shadow-sm">
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
  );
}
