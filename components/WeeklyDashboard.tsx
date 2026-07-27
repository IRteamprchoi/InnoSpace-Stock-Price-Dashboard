"use client";

import React, { useMemo } from "react";
import { TrendingUp, TrendingDown, ExternalLink, Clock } from "lucide-react";
import type { WeeklyPriceRow, WeeklyNewsRow, UsStockHistoryRow } from "@/lib/sheets";
import MiniChart from "./MiniChart";

function PlaceholderChart({ height = 64 }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center gap-1.5 border border-dashed border-slate-700 rounded-md bg-slate-950/40"
      style={{ height }}
    >
      <Clock size={12} className="text-slate-600" />
      <span className="text-[11px] text-slate-600">데이터 수집 중</span>
    </div>
  );
}

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

// 국내는 억원, 해외는 백만달러 단위로 시가총액 표시
function fmtMarketCap(n: number | null, isUs: boolean) {
  if (n == null) return "-";
  if (isUs) return "$" + (n / 1000000).toLocaleString("ko-KR", { maximumFractionDigits: 0 }) + "M";
  return (n / 100000000).toLocaleString("ko-KR", { maximumFractionDigits: 0 }) + "억원";
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

function CompareTable({ rows }: { rows: WeeklyPriceRow[] }) {
  return (
    <div className="bg-slate-900/70 border border-slate-700 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="text-left font-semibold px-3 py-2.5 sticky left-0 bg-slate-900 whitespace-nowrap">종목명</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">상장주식수</th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">시가총액</th>
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
            {rows.map((r) => {
              const isInnospace = r.code === "462350";
              const isUs = r.category === "us";
              const isIndex = r.category === "index";
              return (
                <tr
                  key={`${r.category}-${r.code}`}
                  className={`border-b border-slate-800/60 font-mono ${
                    isInnospace ? "bg-amber-400/10 border-l-2 border-l-amber-400" : "hover:bg-slate-800/30"
                  }`}
                >
                  <td className={`px-3 py-2 text-left whitespace-nowrap sticky left-0 ${
                    isInnospace ? "bg-slate-900/95 text-amber-300 font-bold" : "bg-slate-900/70 text-slate-100 font-semibold"
                  }`}>
                    {r.name}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-400 tabular-nums">{isIndex ? "-" : fmt(r.shares)}</td>
                  <td className="px-3 py-2 text-right text-slate-400 tabular-nums">{isIndex ? "-" : fmtMarketCap(r.marketCap, isUs)}</td>
                  <td className="px-3 py-2 text-right text-slate-100 tabular-nums">{fmt(r.close)}</td>
                  <td className="px-3 py-2 text-right text-slate-400 tabular-nums">{fmt(r.weekHigh)}</td>
                  <td className="px-3 py-2 text-right text-slate-400 tabular-nums">{fmt(r.weekLow)}</td>
                  <td className="px-3 py-2 text-right"><PctCell v={r.ret1w} /></td>
                  <td className="px-3 py-2 text-right"><PctCell v={r.ret1m} /></td>
                  <td className="px-3 py-2 text-right"><PctCell v={r.ret3m} /></td>
                  <td className="px-3 py-2 text-right"><PctCell v={r.retYtd} /></td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-slate-500">데이터가 없습니다</td>
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
function ChartGrid({
  rows,
  innospaceHistory,
  usHistory,
}: {
  rows: WeeklyPriceRow[];
  innospaceHistory: { date: string; close: number }[];
  usHistory: UsStockHistoryRow[];
}) {
  // 지수는 원본 리포트에서도 개별 차트가 없었으므로 제외
  const companies = rows.filter((r) => r.category !== "index");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {companies.map((r) => {
        const isInnospace = r.code === "462350";
        const isUs = r.category === "us";
        let chartData: { date: string; close: number }[] = [];

        if (isInnospace) {
          chartData = innospaceHistory.slice(-30); // 최근 약 1개월
        } else if (isUs) {
          chartData = usHistory
            .filter((h) => h.symbol === r.code)
            .sort((a, b) => (a.date < b.date ? -1 : 1))
            .slice(-90); // 최근 약 3개월
        }

        return (
          <div
            key={`${r.category}-${r.code}`}
            className={`bg-slate-900/70 border rounded-xl p-3.5 ${
              isInnospace ? "border-amber-400/40" : "border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[13px] font-semibold ${isInnospace ? "text-amber-300" : "text-slate-200"}`}>
                {r.name}
              </span>
              <PctCell v={r.ret1w} />
            </div>
            {chartData.length >= 2 ? <MiniChart data={chartData} /> : <PlaceholderChart />}
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
  innospaceHistory,
  usHistory,
}: {
  prices: WeeklyPriceRow[];
  news: WeeklyNewsRow[];
  innospaceHistory: { date: string; close: number }[];
  usHistory: UsStockHistoryRow[];
}) {
  const orderedRows = useMemo(() => orderForComparison(prices), [prices]);
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
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-1">
          <span className="w-1 h-4 bg-amber-400 rounded-sm shrink-0" />
          <h2 className="section-title">우주항공기업 주가 동향</h2>
        </div>
        <p className="text-[13px] text-slate-500 font-mono pl-3">
          기준일 {koreanDateLabel(refFriday)} 종가 · {koreanDateLabel(reportDate)} 집계
        </p>
      </div>

      <p className="text-[12px] text-slate-500 mb-3 pl-3">
        <span className="inline-block w-2.5 h-2.5 bg-amber-400/40 border border-amber-400 rounded-sm align-middle mr-1.5" />
        음영 표시된 행이 이노스페이스입니다
      </p>

      <div className="mb-10">
        <CompareTable rows={orderedRows} />
        <p className="text-[11px] text-slate-600 mt-2">
          * 해외 종목은 자체 수집 이력이 쌓이는 대로 1개월/3개월/YTD가 채워집니다. 신규 상장 종목은 상장 이전 기간의 값이 비어있을 수 있습니다.
        </p>
      </div>

      <div className="flex items-center gap-3 mb-1">
        <span className="w-1 h-4 bg-amber-400 rounded-sm shrink-0" />
        <h2 className="section-title">종목별 주가 추이</h2>
      </div>
      <p className="text-[12px] text-slate-500 mb-4 pl-3">
        이노스페이스·해외 3종목은 실제 추이, 나머지 국내 종목은 데이터가 쌓이는 대로 표시됩니다
      </p>
      <div className="mb-10">
        <ChartGrid rows={orderedRows} innospaceHistory={innospaceHistory} usHistory={usHistory} />
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="w-1 h-4 bg-amber-400 rounded-sm shrink-0" />
        <h2 className="section-title">주요 관련 기사</h2>
      </div>
      <NewsSection news={news} />
    </div>
  );
}
