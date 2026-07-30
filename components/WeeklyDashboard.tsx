"use client";

import React, { useMemo } from "react";
import { ExternalLink } from "lucide-react";
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

function PctCell({ v, size = "base" }: { v: number | null; size?: "base" | "lg" }) {
  if (v == null) return <span className="text-slate-600">-</span>;
  const up = v > 0;
  const flat = v === 0;
  const color = flat ? "text-slate-400" : up ? "text-red-400" : "text-blue-400";
  const arrow = flat ? "―" : up ? "▲" : "▼";
  const sizeClass = size === "lg" ? "text-[19px] sm:text-[21px]" : "";
  return (
    <span className={`inline-flex items-center gap-1 font-bold tabular-nums ${sizeClass} ${color}`}>
      <span>{arrow}</span>{Math.abs(v).toFixed(2)}%
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
  news,
}: {
  rows: WeeklyPriceRow[];
  innospaceIntraday: { date: string; time: string; price: number }[];
  peerIntraday: WeeklyIntradayRow[];
  news: WeeklyNewsRow[];
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
        const companyNews = news.filter((n) => n.name === r.name);

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

            {companyNews.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-800">
                <div className="text-[11px] font-semibold text-slate-500 mb-1.5">최신뉴스</div>
                <div className="flex flex-col gap-1.5">
                  {companyNews.map((n, i) => (
                    <a
                      key={i}
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-1.5 text-[12px] text-slate-300 hover:text-amber-300 transition-colors"
                    >
                      <ExternalLink size={11} className="mt-0.5 shrink-0 opacity-50 group-hover:opacity-100" />
                      <span className="leading-snug line-clamp-2">
                        {n.title}
                        <span className="text-slate-500 font-normal"> · {n.source}</span>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
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

  const refFriday = prices[0]?.refFriday || "";
  const weekStartRaw = refFriday ? new Date(refFriday + "T00:00:00+09:00") : null;
  if (weekStartRaw) weekStartRaw.setDate(weekStartRaw.getDate() - 4);
  const weekStart = weekStartRaw
    ? `${weekStartRaw.getFullYear()}-${String(weekStartRaw.getMonth() + 1).padStart(2, "0")}-${String(weekStartRaw.getDate()).padStart(2, "0")}`
    : "";
  const periodLabel = (d: string) => {
    if (!d) return "-";
    const [y, m, day] = d.split("-");
    const wd = ["일", "월", "화", "수", "목", "금", "토"][new Date(d + "T00:00:00+09:00").getDay()];
    return `${y}.${m}.${day}(${wd})`;
  };

  return (
    <div>
      {/* 시장 지수 주간 동향 */}
      {indices.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="w-1 h-4 bg-amber-400 rounded-sm shrink-0" />
            <h2 className="section-title">시장지수 주간 동향</h2>
          </div>
          <p className="text-[13px] sm:text-[14px] font-medium mb-3" style={{ color: "#9FB0C7" }}>
            <span className="font-semibold">기준기간</span> {periodLabel(weekStart)} ~ {periodLabel(refFriday)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {indices.map((idx) => {
              const chgPt = idx.close != null && idx.prevClose != null ? idx.close - idx.prevClose : null;
              const rangePt = idx.weekHigh != null && idx.weekLow != null ? idx.weekHigh - idx.weekLow : null;
              const rangePct = rangePt != null && idx.weekLow ? (rangePt / idx.weekLow) * 100 : null;
              return (
                <div key={idx.code} className="bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-3.5 sm:px-5 flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[15px] sm:text-[16px] font-bold text-slate-200">{idx.name}</div>
                    {rangePt != null && (
                      <div className="text-right shrink-0">
                        <div className="text-[11px] text-slate-500 font-medium">주간 변동폭</div>
                        <div className="text-[12.5px] font-bold text-slate-300 tabular-nums">
                          {rangePt.toFixed(2)}pt{rangePct != null && <span className="text-slate-500 font-medium"> · {rangePct.toFixed(2)}%</span>}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="metric-value-primary text-slate-100">{idx.close?.toLocaleString("ko-KR")}</span>
                    <PctCell v={idx.ret1w} size="lg" />
                    {chgPt != null && (
                      <span className={`text-[12px] font-medium tabular-nums ${chgPt >= 0 ? "text-red-400" : "text-blue-400"}`}>
                        {chgPt >= 0 ? "+" : ""}{chgPt.toFixed(2)}pt
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                    <div className="text-[12px] text-slate-500 font-medium tabular-nums">
                      주초 → 주말<br />
                      <span className="text-slate-300">{idx.prevClose?.toLocaleString("ko-KR")} → {idx.close?.toLocaleString("ko-KR")}</span>
                    </div>
                    <div className="flex flex-col gap-1 pl-3 border-l border-slate-800 text-[12px] font-medium tabular-nums">
                      <div className="text-slate-500">최고 <span className="text-slate-300">{idx.weekHigh?.toLocaleString("ko-KR")}</span> · 최저 <span className="text-slate-300">{idx.weekLow?.toLocaleString("ko-KR")}</span></div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">YTD</span>
                        <PctCell v={idx.retYtd} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-10">
        <PeerComparisonTable rows={orderedRows} fx={fx} />
      </div>

      <div className="flex items-center gap-3 mb-1">
        <span className="w-1 h-4 bg-amber-400 rounded-sm shrink-0" />
        <h2 className="section-title">종목별 주가 추이 및 최신뉴스</h2>
      </div>
      <p className="text-[12px] text-slate-500 mb-4 pl-3">
        이노스페이스·해외 3종목은 실제 추이, 나머지 국내 종목은 데이터가 쌓이는 대로 표시됩니다
      </p>
      <div>
        <ChartGrid rows={orderedRows} innospaceIntraday={innospaceIntraday} peerIntraday={peerIntraday} news={news} />
      </div>
    </div>
  );
}
