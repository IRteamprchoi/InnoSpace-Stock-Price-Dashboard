"use client";

import React, { useState, useEffect } from "react";
import { Rocket, Circle } from "lucide-react";

function isMarketOpenNow() {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const day = kst.getDay();
  const mins = kst.getHours() * 60 + kst.getMinutes();
  return day >= 1 && day <= 5 && mins >= 9 * 60 && mins <= 15 * 60 + 30;
}

function HeaderClock() {
  const [elapsed, setElapsed] = useState(0);
  const [open] = useState(isMarketOpenNow());
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const h = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const s = String(elapsed % 60).padStart(2, "0");
  return (
    <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
      <Circle size={8} className={open ? "fill-amber-400 text-amber-400 animate-pulse" : "fill-slate-600 text-slate-600"} />
      <span>{open ? "장중" : "장마감"}</span>
      <span className="text-slate-600">|</span>
      <span>T+{h}:{m}:{s}</span>
    </div>
  );
}

// 페이지(일간/주간/월간)에 따라 제목만 바뀌고, 종목코드·시장구분·장상태 표시는 공통
export default function DashboardHeader({ title }: { title: string }) {
  return (
    <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center shrink-0">
          <Rocket size={20} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">{title}</h1>
          <p className="text-xs text-slate-500 font-mono">462350 · KOSDAQ</p>
        </div>
      </div>
      <HeaderClock />
    </div>
  );
}
