"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/daily", label: "일간 동향" },
  { href: "/weekly", label: "주간 동향" },
  { href: "/monthly", label: "월간 동향" },
];

// 세그먼트 탭 형태의 페이지 이동 네비게이션. 실제 라우트(/daily, /weekly, /monthly)를 쓰는
// next/link 기반이라 브라우저 뒤로가기/앞으로가기가 그대로 정상 작동합니다.
export default function PeriodNavigation() {
  const pathname = usePathname();

  return (
    <div className="mb-8">
      <div className="inline-flex w-full sm:w-auto bg-slate-900 border border-slate-700 rounded-lg p-1 gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href || (tab.href === "/daily" && pathname === "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 sm:flex-none text-center px-4 py-2 rounded-md text-[14px] font-semibold transition-colors ${
                active
                  ? "bg-amber-400/15 text-amber-300"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
