"use client";

import React, { useMemo } from "react";
import { TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import type { WeeklyPriceRow, WeeklyNewsRow, WeeklyIntradayRow } from "@/lib/sheets";
import type { FxRate } from "@/lib/fx";
import MiniStockChart from "./MiniStockChart";
import PeerComparisonTable from "./PeerComparisonTable";

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

function NewsSection({ news }: { news: WeeklyNewsRow[] }) {
  const byCompany = useMemo(() => {
    const map = new Map<string, WeeklyNewsRow[]>();
    news.forEach((n) => {
      if (!map.has(n.name)) map.set(n.name, []);
      map.get(n.name)!.push(n);
    });
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

// 원본 리포트와 같은 순서: 지수 -> 해외 -> 이노스페이스 -> 국내 나머지, 전부 하나의 표로
function RetArrow({ v }: { v: number | null }) {
  if (v == null) return <span className="text-slate-600 text-[15px] font-bold">-</span>;
  const up = v > 0;
  const flat = v === 0;
  const color = flat ? "text-slate-400" : up ? "text-red-400" : "text-blue-400";
  const arrow = flat ? "―" : up ? "▲" : "▼";
  return (
    <span className={`inline-flex items-center gap-1 font-bold tabular-nums text-[15px] ${color}`}>
      <span>{arrow}</span>{Math.abs(v).toFixed(2)}%
    </span>
  );
}

function ChartGrid({
  rows,
  innospaceIntraday,
  peerIntraday,
}: {
  rows: WeeklyPriceRow[];
  innospaceIntraday: { date: string; time: string; price: number }[];
  peerIntraday: WeeklyIntradayRow[];
}) {
  // 지수는 원본 리포트에서도 개별 차트가 없었으므로 제외
  const companies = rows.filter((r) => r.category !== "index");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {companies.map((r) => {
        const isInnospace = r.code === "462350";
        const isUs = r.category === "us";
        const points = isInnospace
          ? innospaceIntraday
          : peerIntraday
              .filter((p) => p.code === r.code)
              .map((p) => ({ date: p.tradeDate, time: p.time, price: p.price }));

        return (
          <div
            key={`${r.category}-${r.code}`}
            className={`bg-slate-900/60 border rounded-xl p-3.5 ${
              isInnospace ? "border-amber-400/30" : "border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-2.5 gap-2">
              <span className={`text-[14px] font-semibold truncate ${isInnospace ? "text-amber-300" : "text-slate-200"}`}>
                {r.name}
              </span>
              <RetArrow v={r.ret1w} />
            </div>
            <MiniStockChart points={points} isUs={isUs} prevClose={r.prevClose} />
          </div>
        );
      })}
    </div>
  );
}

function orderForComparison(rows: WeeklyPriceRow[]): WeeklyPriceRow[] {
  const indices = rows.filter((r) => r.category === "index");
  const us = rows.filter((r) => r.category === "us");
  const innospace = rows.filter((r) => r.code === "462350");
  const otherDomestic = rows.filter((r) => r.category === "domestic" && r.code !== "462350");
  return [...indices, ...us, ...innospace, ...otherDomestic];
}

export default function WeeklyDashboard({
  prices,
  news,
  innospaceIntraday,
  peerIntraday,
  fx,
}: {
  prices: WeeklyPriceRow[];
  news: WeeklyNewsRow[];
  innospaceIntraday: { date: string; time: string; price: number }[];
  peerIntraday: WeeklyIntradayRow[];
  fx: FxRate | null;
}) {
  const orderedRows = useMemo(() => orderForComparison(prices), [prices]);
  const indices = useMemo(() => prices.filter((r) => r.category === "index"), [prices]);

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
      {/* 시장 지수 (참고용, 간단히) */}
      {indices.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {indices.map((idx) => (
            <div key={idx.code} className="bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="metric-label">{idx.name}</span>
              <div className="flex items-center gap-2">
                <span className="metric-value text-slate-100">{idx.close?.toLocaleString("ko-KR")}</span>
                <PctCell v={idx.ret1w} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-10">
        <PeerComparisonTable rows={orderedRows} fx={fx} />
      </div>

      <div className="flex items-center gap-3 mb-1">
        <span className="w-1 h-4 bg-amber-400 rounded-sm shrink-0" />
        <h2 className="section-title">종목별 주가 추이</h2>
      </div>
      <p className="text-[12px] text-slate-500 mb-4 pl-3">
        이노스페이스·해외 3종목은 실제 추이, 나머지 국내 종목은 데이터가 쌓이는 대로 표시됩니다
      </p>
      <div className="mb-10">
        <ChartGrid rows={orderedRows} innospaceIntraday={innospaceIntraday} peerIntraday={peerIntraday} />
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="w-1 h-4 bg-amber-400 rounded-sm shrink-0" />
        <h2 className="section-title">주요 관련 기사</h2>
      </div>
      <NewsSection news={news} />
    </div>
  );
}
