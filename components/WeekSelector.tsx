"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { History } from "lucide-react";

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

function fmtLabel(reportDate: string, isLatest: boolean) {
  // reportDate는 "yyyy-MM-dd" (실제 리포트 생성일). 요일도 같이 보여줌
  const wd = WEEKDAY_KO[new Date(reportDate + "T00:00:00+09:00").getDay()];
  return `${reportDate}(${wd}) 리포트${isLatest ? " · 최신" : ""}`;
}

export default function WeekSelector({
  availableWeeks,
  selectedWeek,
}: {
  availableWeeks: string[]; // 최신순으로 정렬된 report_date 목록
  selectedWeek: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (availableWeeks.length <= 1) return null; // 과거 리포트가 없으면 선택기 자체를 숨김

  const latest = availableWeeks[0];

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (value === latest) {
      params.delete("week"); // 최신은 쿼리 없이 기본 상태로
    } else {
      params.set("week", value);
    }
    const qs = params.toString();
    router.push(qs ? `/weekly?${qs}` : "/weekly");
  };

  return (
    <div className="flex items-center gap-2">
      <History size={14} className="text-slate-500" />
      <select
        value={selectedWeek || latest}
        onChange={handleChange}
        className="bg-slate-900 border border-slate-700 text-slate-200 text-[13px] font-medium rounded-md px-2.5 py-1.5 focus:outline-none focus:border-amber-400/50 cursor-pointer"
      >
        {availableWeeks.map((w) => (
          <option key={w} value={w}>
            {fmtLabel(w, w === latest)}
          </option>
        ))}
      </select>
    </div>
  );
}
