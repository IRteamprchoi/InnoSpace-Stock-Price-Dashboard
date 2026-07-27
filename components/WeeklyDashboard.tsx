"use client";

import React, { useMemo } from "react";
import { TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import type { WeeklyPriceRow, WeeklyNewsRow } from "@/lib/sheets";

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

function koreanDateLabel(dateStr: string) {
  if (!dateStr) return "-";
  const dt = new Date(dateStr + "T00:00:00+09:00");
  const wd = WEEKDAY_KO[dt.getDay()];
  const [y, m, d] = dateStr.split("-");
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일 (${wd})`;
}

function fmt(n: number | null) {
  if (n == null) return "-";
  return n.toLocaleString("ko-KR");
}

function PctCell({ v }: { v: number | null }) {
  if (v == null) return <span className="text-slate-600">-</span>;
  const up = v > 0;
  const flat = v === 0;
  const color = flat ? "text-slate-300" : up ? "text-red-400" : "text-blue-400";
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${color}`}>
      {!flat && (up ? <TrendingUp size={12} /> : <TrendingDown size={12} />)}
      {up ? "+" : ""}{v.toFixed(2)}%
    </span>
  );
}

function PriceTable({ rows }: { rows: WeeklyPriceRow[] }) {
  return (
    <div className="bg-slate-900/70 border border-slate-700 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="text-left font-semibold px-3 py-2.5 sticky left-0 bg-slate-900 whitespace-nowrap">종목명</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">종가</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">주간 최고</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">주간 최저</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">1주</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">1개월</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">3개월</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">YTD</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="border-b border-slate-800/60 hover:bg-slate-800/30 font-mono">
                <td className="px-3 py-2 text-left text-slate-100 font-semibold sticky left-0 bg-slate-900/70 whitespace-nowrap">{r.name}</td>
                <td className="px-3 py-2 text-right text-slate-100 tabular-nums">{fmt(r.close)}</td>
                <td className="px-3 py-2 text-right text-slate-400 tabular-nums">{fmt(r.weekHigh)}</td>
                <td className="px-3 py-2 text-right text-slate-400 tabular-nums">{fmt(r.weekLow)}</td>
                <td className="px-3 py-2 text-right"><PctCell v={r.ret1w} /></td>
                <td className="px-3 py-2 text-right"><PctCell v={r.ret1m} /></td>
                <td className="px-3 py-2 text-right"><PctCell v={r.ret3m} /></td>
                <td className="px-3 py-2 text-right"><PctCell v={r.retYtd} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-500">데이터가 없습니다</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewsSection({ news }: { news: WeeklyNewsRow[] }) {
  const byCompany = useMemo(() => {
    const map = new Map<string, WeeklyNewsRow[]>();
    news.forEach((n) => {
      if (!map.has(n.name)) map.set(n.name, []);
      map.get(n.name)!.push(n);
    });
    // 각 회사 안에서는 언론사 수(outlet_count) 많은 순
    map.forEach((arr) => arr.sort((a, b) => b.outletCount - a.outletCount));
    return Array.from(map.entries());
  }, [news]);

  if (!byCompany.length) {
    return (
      <div className="bg-slate-900/70 border border-slate-700 rounded-xl px-6 py-10 text-center text-slate-500 text-sm">
        이번 주 수집된 관련 뉴스가 없습니다.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {byCompany.map(([name, items]) => (
        <div key={name} className="bg-slate-900/70 border border-slate-700 rounded-xl p-4">
          <h3 className="text-[14px] font-bold text-slate-100 mb-2.5">{name}</h3>
          <div className="flex flex-col gap-2.5">
            {items.map((n, i) => (
              <a
                key={i}
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-1.5 text-[12.5px] text-slate-300 hover:text-amber-300 transition-colors"
              >
                <ExternalLink size={12} className="mt-0.5 shrink-0 opacity-50 group-hover:opacity-100" />
                <span className="leading-snug">
                  {n.title}
                  <span className="text-slate-500 font-normal"> · {n.source}</span>
                </span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WeeklyDashboard({
  prices,
  news,
}: {
  prices: WeeklyPriceRow[];
  news: WeeklyNewsRow[];
}) {
  const indices = prices.filter((p) => p.category === "index");
  const domestic = prices.filter((p) => p.category === "domestic");
  const us = prices.filter((p) => p.category === "us");
  const refFriday = prices[0]?.refFriday;
  const reportDate = prices[0]?.reportDate;

  if (!prices.length) {
    return (
      <div className="bg-slate-900/70 border border-slate-700 rounded-xl px-6 py-14 text-center">
        <p className="text-slate-400 text-sm">
          아직 주간 데이터가 없습니다. 매주 월요일 자동 수집 이후 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="w-1 h-4 bg-amber-400 rounded-sm shrink-0" />
          <h2 className="section-title">우주항공기업 주가 동향</h2>
        </div>
        <p className="text-[13px] text-slate-500 font-mono pl-3">
          기준일 {koreanDateLabel(refFriday)} 종가 · {koreanDateLabel(reportDate)} 집계
        </p>
      </div>

      <div className="flex flex-col gap-8 mb-10">
        <div>
          <h3 className="text-[14px] font-bold text-slate-300 mb-2">지수</h3>
          <PriceTable rows={indices} />
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-slate-300 mb-2">국내 종목</h3>
          <PriceTable rows={domestic} />
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-slate-300 mb-2">해외 종목</h3>
          <PriceTable rows={us} />
          <p className="text-[11px] text-slate-600 mt-2">
            * 해외 종목은 자체 수집 이력이 쌓이는 대로 1개월/3개월/YTD가 채워집니다. 신규 상장 종목은 상장 이전 기간의 값이 비어있을 수 있습니다.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="w-1 h-4 bg-amber-400 rounded-sm shrink-0" />
        <h2 className="section-title">주요 관련 기사</h2>
      </div>
      <NewsSection news={news} />
    </div>
  );
}
