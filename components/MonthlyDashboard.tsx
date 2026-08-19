"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type {
  IndexDailyRow,
  MarketNewsMonthlyRow,
  WeeklyPriceRow,
  WeeklyNewsRow,
  DomesticInvestorFlowRow,
  WeeklyChartPoint,
  UsStockHistoryRow,
} from "@/lib/sheets";

type Group = "us" | "self" | "domestic";

const COMPANY_ORDER: { name: string; group: Group }[] = [
  { name: "Space X", group: "us" },
  { name: "Rocket Lab", group: "us" },
  { name: "Firefly Aerospace", group: "us" },
  { name: "이노스페이스", group: "self" },
  { name: "한화에어로스페이스", group: "domestic" },
  { name: "한화시스템", group: "domestic" },
  { name: "한국항공우주", group: "domestic" },
  { name: "LIG D&A", group: "domestic" },
  { name: "현대로템", group: "domestic" },
  { name: "인텔리안테크", group: "domestic" },
  { name: "쎄트렉아이", group: "domestic" },
  { name: "컨텍", group: "domestic" },
  { name: "켄코아에어로스페이스", group: "domestic" },
  { name: "AP위성", group: "domestic" },
  { name: "제노코", group: "domestic" },
  { name: "루미르", group: "domestic" },
  { name: "비츠로넥스텍", group: "domestic" },
  { name: "나라스페이스테크놀로지", group: "domestic" },
];

type MonthlyDashboardProps = {
  month: string;
  indexRows: IndexDailyRow[];
  marketNewsRows: MarketNewsMonthlyRow[];
  priceRows: WeeklyPriceRow[];
  companyNewsRows: WeeklyNewsRow[];
  investorFlowRows: DomesticInvestorFlowRow[];
  chartRows: WeeklyChartPoint[];
  usHistoryRows: UsStockHistoryRow[];
};

export default function MonthlyDashboard({
  month,
  indexRows,
  marketNewsRows,
  priceRows,
  companyNewsRows,
  investorFlowRows,
  chartRows,
  usHistoryRows,
}: MonthlyDashboardProps) {
  const monthLabel = `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`;
  const isCurrentMonth = month === new Date().toISOString().slice(0, 7);

  const kospiRows = useMemo(
    () =>
      indexRows
        .filter((r) => r.date.startsWith(month) && r.name.includes("코스피"))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [indexRows, month]
  );
  const kosdaqRows = useMemo(
    () =>
      indexRows
        .filter((r) => r.date.startsWith(month) && r.name.includes("코스닥"))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [indexRows, month]
  );

  const tableRows = useMemo(
    () =>
      COMPANY_ORDER.map((c) => {
        const snap = buildSnapshot(priceRows, c.name, month);
        const flow =
          c.group !== "us" && snap?.code
            ? buildFlowSummary(investorFlowRows, snap.code, month)
            : null;
        return { ...c, snap, flow };
      }),
    [priceRows, investorFlowRows, month]
  );

  const selfRow = tableRows.find((r) => r.group === "self");
  const peerReturns = tableRows
    .filter((r) => r.snap?.changePct != null)
    .map((r) => ({ name: r.name, pct: r.snap!.changePct as number }));
  const peerAvg = (() => {
    const others = peerReturns.filter((p) => p.name !== "이노스페이스");
    if (!others.length) return null;
    return others.reduce((s, p) => s + p.pct, 0) / others.length;
  })();
  const rankSorted = [...peerReturns].sort((a, b) => b.pct - a.pct);
  const selfRank = rankSorted.findIndex((p) => p.name === "이노스페이스") + 1;

  const monthMarketNews = useMemo(() => {
    const filtered = marketNewsRows.filter((r) => weekBelongsToMonth(r, month));
    return dedupeByLink(filtered).sort(
      (a, b) => a.pubDate.localeCompare(b.pubDate) || (a.market === b.market ? 0 : a.market === "KR" ? -1 : 1)
    );
  }, [marketNewsRows, month]);

  const selfNews = useMemo(
    () =>
      dedupeByLink(newsInMonth(companyNewsRows, month).filter((r) => r.name === "이노스페이스")).sort(
        (a, b) => b.pubDate.localeCompare(a.pubDate)
      ),
    [companyNewsRows, month]
  );
  const usNews = useMemo(() => {
    const names = new Set(["Space X", "Rocket Lab", "Firefly Aerospace"]);
    return dedupeByLink(newsInMonth(companyNewsRows, month).filter((r) => names.has(r.name))).sort(
      (a, b) => b.pubDate.localeCompare(a.pubDate)
    );
  }, [companyNewsRows, month]);
  const domesticNews = useMemo(() => {
    const names = new Set(COMPANY_ORDER.filter((c) => c.group === "domestic").map((c) => c.name));
    return dedupeByLink(newsInMonth(companyNewsRows, month).filter((r) => names.has(r.name))).sort(
      (a, b) => b.pubDate.localeCompare(a.pubDate)
    );
  }, [companyNewsRows, month]);

  const latestFx = tableRows
    .filter((r) => r.group === "us" && r.snap?.fxRate != null)
    .map((r) => r.snap!)
    .sort((a, b) => (b.fxDate ?? "").localeCompare(a.fxDate ?? ""))[0];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-slate-400">
          {monthLabel}
          {isCurrentMonth && (
            <span className="ml-2 text-[11px] px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 align-middle">
              진행 중 · 최신 주간 리포트 기준
            </span>
          )}
        </p>
        <MonthSelector month={month} />
      </div>

      {/* B. 월간 핵심 요약 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="이노스페이스 월간 등락률"
          value={pctText(selfRow?.snap?.changePct ?? null)}
          tone={toneOf(selfRow?.snap?.changePct ?? null)}
        />
        <StatCard
          label="피어그룹 평균 · 당사 순위"
          value={pctText(peerAvg)}
          sub={selfRank ? `${rankSorted.length}개사 중 ${selfRank}위` : undefined}
        />
        <StatCard
          label="당사 시가총액 증감"
          value={
            selfRow?.snap?.marketCapChange != null
              ? `${selfRow.snap.marketCapChange >= 0 ? "+" : "-"}${fmtMarketCapKrw(Math.abs(selfRow.snap.marketCapChange))}`
              : "-"
          }
          tone={toneOf(selfRow?.snap?.marketCapChange ?? null)}
        />
        <StatCard
          label="당사 투자자 순매수(월간)"
          value={selfRow?.flow ? `개인 ${fmtFlow(selfRow.flow.individual)}` : "-"}
          sub={
            selfRow?.flow
              ? `외국인 ${fmtFlow(selfRow.flow.foreign)} · 기관 ${fmtFlow(selfRow.flow.institution)}`
              : undefined
          }
        />
      </section>

      {/* C. 시장지수 월간 동향 */}
      <section className="space-y-3">
        <SectionTitle>I. 코스피·코스닥 월간 지수 동향</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <IndexCard title="코스피" rows={kospiRows} />
          <IndexCard title="코스닥" rows={kosdaqRows} />
        </div>
        <DailyCompareChart
          kospi={kospiRows.map((r) => ({ date: r.date, value: r.close }))}
          kosdaq={kosdaqRows.map((r) => ({ date: r.date, value: r.close }))}
        />
      </section>

      {/* D. 18개사 월간 현황 */}
      <section className="space-y-3">
        <SectionTitle>II. 이노스페이스 및 피어그룹 월간 현황</SectionTitle>
        <PeerMonthlyTable
          rows={tableRows}
          month={month}
          chartRows={chartRows}
          usHistoryRows={usHistoryRows}
        />
        {latestFx && (
          <p className="text-[10px] text-slate-500">
            해외 종목 원화 환산 적용 환율: 1 USD = {Math.round(latestFx.fxRate as number).toLocaleString("ko-KR")}원
            ({latestFx.fxDate} 기준)
          </p>
        )}
      </section>

      {/* E. 주요 공시 및 관련 기사 */}
      <section className="space-y-3">
        <SectionTitle>III. {monthLabel} 우주항공기업 주요 공시 및 관련 기사</SectionTitle>
        <div className="space-y-2">
          <Accordion title="월간 시장 시황" count={monthMarketNews.length} defaultOpen>
            {monthMarketNews.length === 0 ? (
              <EmptyNews />
            ) : (
              monthMarketNews.map((n) => <NewsRow key={n.link} item={n} />)
            )}
          </Accordion>
          <Accordion title="이노스페이스" count={selfNews.length} defaultOpen>
            {selfNews.length === 0 ? <EmptyNews /> : selfNews.map((n) => <NewsRow key={n.link} item={n} />)}
          </Accordion>
          <Accordion title="해외 피어그룹" count={usNews.length}>
            {usNews.length === 0 ? <EmptyNews /> : usNews.map((n) => <NewsRow key={n.link} item={n} />)}
          </Accordion>
          <Accordion title="국내 피어그룹" count={domesticNews.length}>
            {domesticNews.length === 0 ? (
              <EmptyNews />
            ) : (
              domesticNews.map((n) => <NewsRow key={n.link} item={n} />)
            )}
          </Accordion>
        </div>
      </section>
    </div>
  );
}

// ---------- 데이터 집계 유틸 ----------

type CompanySnapshot = {
  category: string;
  code: string;
  openClose: number | null;
  closeClose: number | null;
  changePct: number | null;
  openMarketCap: number | null;
  closeMarketCap: number | null;
  marketCapChange: number | null;
  shares: number | null;
  monthVolume: number | null;
  fxRate: number | null;
  fxDate: string | null;
  weeksCount: number;
  monthHigh: number | null;
  monthLow: number | null;
  weeklyCloses: number[];
};

function buildSnapshot(rows: WeeklyPriceRow[], name: string, month: string): CompanySnapshot | null {
  const companyRows = rows
    .filter((r) => r.name === name && r.category !== "index" && r.refFriday.startsWith(month))
    .sort((a, b) => a.refFriday.localeCompare(b.refFriday));
  if (companyRows.length === 0) return null;
  const first = companyRows[0];
  const last = companyRows[companyRows.length - 1];
  const hasVolume = companyRows.some((r) => r.weekVolume != null);
  const monthVolume = hasVolume
    ? companyRows.reduce((sum, r) => sum + (r.weekVolume ?? 0), 0)
    : null;
  const changePct =
    first.close != null && last.close != null && first.close !== 0
      ? ((last.close - first.close) / first.close) * 100
      : null;
  // market_cap 필드는 해외 종목의 경우 원화가 아닌 달러(USD) 원값으로 저장되어 있어,
  // 원화 표시를 위해서는 그 시점의 환율(fxRate)을 곱해 변환해야 합니다.
  const isUsRow = last.category === "us";
  const toKrw = (v: number | null, fxRate: number | null) =>
    v == null ? null : isUsRow && fxRate != null ? v * fxRate : v;
  const openMarketCapKrw = toKrw(first.marketCap, first.fxRate);
  const closeMarketCapKrw = toKrw(last.marketCap, last.fxRate);
  const marketCapChange =
    openMarketCapKrw != null && closeMarketCapKrw != null ? closeMarketCapKrw - openMarketCapKrw : null;
  return {
    category: last.category,
    code: last.code,
    openClose: first.close,
    closeClose: last.close,
    changePct,
    openMarketCap: openMarketCapKrw,
    closeMarketCap: closeMarketCapKrw,
    marketCapChange,
    shares: last.shares,
    monthVolume,
    fxRate: last.fxRate,
    fxDate: last.fxDate,
    weeksCount: companyRows.length,
    monthHigh: companyRows.some((r) => r.weekHigh != null)
      ? Math.max(...companyRows.map((r) => r.weekHigh ?? -Infinity))
      : null,
    monthLow: companyRows.some((r) => r.weekLow != null)
      ? Math.min(...companyRows.map((r) => r.weekLow ?? Infinity))
      : null,
    weeklyCloses: companyRows.map((r) => r.close ?? 0).filter((c) => c !== 0),
  };
}

type FlowSummary = { individual: number; foreign: number; institution: number; otherTotal: number };

function buildFlowSummary(rows: DomesticInvestorFlowRow[], code: string, month: string): FlowSummary | null {
  const companyRows = rows.filter((r) => r.code === code && r.date.startsWith(month));
  if (companyRows.length === 0) return null;
  return {
    individual: companyRows.reduce((s, r) => s + r.individual, 0),
    foreign: companyRows.reduce((s, r) => s + r.foreign, 0),
    institution: companyRows.reduce((s, r) => s + r.institution, 0),
    otherTotal: companyRows.reduce((s, r) => s + r.otherTotal, 0),
  };
}

function dedupeByLink<T extends { link: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.link)) continue;
    seen.add(item.link);
    out.push(item);
  }
  return out;
}

function weekBelongsToMonth(row: MarketNewsMonthlyRow, month: string): boolean {
  if (row.reportDate.startsWith(month)) return true;
  const pd = new Date(row.pubDate);
  if (isNaN(pd.getTime())) return false;
  const pdMonth = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, "0")}`;
  return pdMonth === month;
}

function newsInMonth(rows: WeeklyNewsRow[], month: string): WeeklyNewsRow[] {
  return rows.filter((r) => {
    const pd = new Date(r.pubDate);
    if (isNaN(pd.getTime())) return r.reportDate.startsWith(month);
    const pdMonth = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, "0")}`;
    return pdMonth === month;
  });
}

// ---------- 포맷 유틸 (PeerComparisonTable.tsx와 동일 규칙) ----------

function fmtPrice(n: number | null, isUs: boolean): string {
  if (n == null) return "-";
  if (isUs) return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

function fmtMarketCapKrw(krw: number | null): string {
  if (krw == null) return "-";
  if (krw >= 1e12)
    return (krw / 1e12).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "조원";
  return Math.round(krw / 1e8).toLocaleString("ko-KR") + "억원";
}

function fmtLocalCap(n: number | null, isUs: boolean): string | null {
  if (n == null || !isUs) return null;
  return "$" + (n / 1e6).toLocaleString("ko-KR", { maximumFractionDigits: 0 }) + "M";
}

function fmtVolume(n: number | null): string {
  if (n == null) return "-";
  return Math.round(n).toLocaleString("ko-KR") + "주";
}

function fmtFlow(n: number | undefined | null): string {
  if (n == null) return "-";
  const sign = n > 0 ? "+" : "";
  return sign + Math.round(n).toLocaleString("ko-KR");
}

function pctText(v: number | null): string {
  if (v == null) return "-";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function toneOf(v: number | null): "up" | "down" | "flat" | undefined {
  if (v == null) return undefined;
  if (v > 0) return "up";
  if (v < 0) return "down";
  return "flat";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

// ---------- 기본 UI 조각 ----------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[15px] font-semibold border-l-4 border-amber-400 pl-3">{children}</h2>;
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down" | "flat";
}) {
  const color =
    tone === "up" ? "text-red-400" : tone === "down" ? "text-blue-400" : tone === "flat" ? "text-slate-400" : "text-slate-100";
  return (
    <div className="bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3">
      <p className="text-[11px] text-slate-500 mb-1">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function RetPct({ v }: { v: number | null }) {
  if (v == null) return <span className="text-slate-600">-</span>;
  const up = v > 0;
  const flat = v === 0;
  const color = flat ? "text-slate-400" : up ? "text-red-400" : "text-blue-400";
  const arrow = flat ? "―" : up ? "▲" : "▼";
  return (
    <span className={`${color} font-medium tabular-nums`}>
      {arrow} {Math.abs(v).toFixed(2)}%
    </span>
  );
}

function MonthSelector({ month }: { month: string }) {
  const router = useRouter();
  const options = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const list: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(y, m - 1 - i, 1);
      list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return list;
  }, [month]);
  return (
    <select
      value={month}
      onChange={(e) => router.push(`/monthly?month=${e.target.value}`)}
      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-[13px] text-slate-200"
    >
      {options.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  );
}

// ---------- I장: 지수 카드 ----------

function IndexCard({ title, rows }: { title: string; rows: IndexDailyRow[] }) {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const changePct =
    first && last && first.close ? ((last.close - first.close) / first.close) * 100 : null;
  const high = sorted.length ? Math.max(...sorted.map((r) => r.high)) : null;
  const low = sorted.length ? Math.min(...sorted.map((r) => r.low)) : null;

  if (!sorted.length) {
    return (
      <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-4 text-[12px] text-slate-500">
        {title} 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[13px] font-semibold text-slate-200">{title}</h3>
        <RetPct v={changePct} />
      </div>
      <div className="grid grid-cols-4 gap-2 text-[11px] mb-2">
        <div>
          <p className="text-slate-500">월초</p>
          <p className="tabular-nums text-slate-200">{first.close.toLocaleString("ko-KR")}</p>
        </div>
        <div>
          <p className="text-slate-500">최신</p>
          <p className="tabular-nums text-slate-200">{last.close.toLocaleString("ko-KR")}</p>
        </div>
        <div>
          <p className="text-slate-500">최고</p>
          <p className="tabular-nums text-slate-200">{high?.toLocaleString("ko-KR")}</p>
        </div>
        <div>
          <p className="text-slate-500">최저</p>
          <p className="tabular-nums text-slate-200">{low?.toLocaleString("ko-KR")}</p>
        </div>
      </div>
      <DailyPriceChart
        points={sorted.map((r) => ({ date: r.date, value: r.close }))}
        isUs={false}
        showHeader={false}
        height={130}
      />
    </div>
  );
}

function Sparkline({ rows }: { rows: IndexDailyRow[] }) {
  const width = 300;
  const height = 44;
  const pad = 4;
  if (rows.length < 2) return <div style={{ height: 44 }} />;
  const closes = rows.map((r) => r.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const points = rows
    .map((r, i) => {
      const x = pad + (i / (rows.length - 1)) * (width - pad * 2);
      const y = height - pad - ((r.close - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const up = closes[closes.length - 1] >= closes[0];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 44 }}>
      <polyline points={points} fill="none" stroke={up ? "#f87171" : "#60a5fa"} strokeWidth={1.5} />
    </svg>
  );
}

function CompareChart({ kospi, kosdaq }: { kospi: IndexDailyRow[]; kosdaq: IndexDailyRow[] }) {
  const width = 900;
  const height = 100;
  const pad = 24;

  const normalize = (rows: IndexDailyRow[]): { x: number; pct: number }[] => {
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length === 0) return [];
    const base = sorted[0].close;
    return sorted.map((r, i) => ({
      x: pad + (i / Math.max(sorted.length - 1, 1)) * (width - pad * 2),
      pct: ((r.close - base) / base) * 100,
    }));
  };

  const a = normalize(kospi);
  const b = normalize(kosdaq);
  const allPct = [...a, ...b].map((p) => p.pct);
  if (allPct.length === 0) return null;
  const min = Math.min(0, ...allPct);
  const max = Math.max(0, ...allPct);
  const range = max - min || 1;
  const toPoints = (pts: { x: number; pct: number }[]) =>
    pts.map((p) => `${p.x},${height - pad - ((p.pct - min) / range) * (height - pad * 2)}`).join(" ");
  const zeroY = height - pad - ((0 - min) / range) * (height - pad * 2);

  return (
    <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[13px] font-semibold text-slate-200">코스피/코스닥 월간 누적 등락률 비교</h3>
        <div className="flex gap-3 text-[11px]">
          <span className="text-red-400">● 코스피</span>
          <span className="text-blue-400">● 코스닥</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 110 }}>
        <line x1={pad} y1={zeroY} x2={width - pad} y2={zeroY} stroke="#334155" strokeDasharray="4 4" />
        <polyline points={toPoints(a)} fill="none" stroke="#f87171" strokeWidth={2} />
        <polyline points={toPoints(b)} fill="none" stroke="#60a5fa" strokeWidth={2} />
      </svg>
      <p className="text-[10px] text-slate-500 mt-1">월초 종가를 0%로 정규화한 누적 등락률 기준</p>
    </div>
  );
}

// ---------- II장: 18개사 월간 현황 표 ----------

type TableRowData = {
  name: string;
  group: Group;
  snap: CompanySnapshot | null;
  flow: FlowSummary | null;
};

function groupLabel(g: Group): string {
  return g === "us" ? "해외 피어그룹" : g === "self" ? "당사" : "국내 피어그룹";
}

function badgeStyle(g: Group): string {
  if (g === "self") return "bg-amber-400/20 text-amber-300";
  if (g === "us") return "bg-blue-400/15 text-blue-300";
  return "bg-slate-700/60 text-slate-300";
}

function PeerMonthlyTable({
  rows,
  month,
  chartRows,
  usHistoryRows,
}: {
  rows: TableRowData[];
  month: string;
  chartRows: WeeklyChartPoint[];
  usHistoryRows: UsStockHistoryRow[];
}) {
  const [expandedName, setExpandedName] = useState<string | null>(null);

  return (
    <div className="bg-slate-900/70 border border-slate-700 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[820px]">
          <thead className="sticky top-0 bg-slate-900 z-10">
            <tr className="text-slate-400 text-[11px] border-b border-slate-700">
              <th className="text-left px-3 py-2 font-medium">구분</th>
              <th className="text-left px-3 py-2 font-medium">기업명</th>
              <th className="text-right px-3 py-2 font-medium">월초 종가</th>
              <th className="text-right px-3 py-2 font-medium">월말 종가</th>
              <th className="text-right px-3 py-2 font-medium">월간 등락률</th>
              <th className="text-right px-3 py-2 font-medium">월말 시가총액</th>
              <th className="text-right px-3 py-2 font-medium">월간 거래량</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((r, idx) => {
              const isUs = r.group === "us";
              const isSelf = r.group === "self";
              const expanded = expandedName === r.name;
              const showGroupLabel = idx === 0 || rows[idx - 1].group !== r.group;
              const localCap =
                isUs && r.snap?.shares != null && r.snap?.closeClose != null
                  ? r.snap.shares * r.snap.closeClose
                  : null;
              return (
                <React.Fragment key={r.name}>
                  {showGroupLabel && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 pt-3 pb-1 text-[10px] text-slate-500 bg-slate-900/40"
                      >
                        {groupLabel(r.group)}
                      </td>
                    </tr>
                  )}
                  <tr
                    onClick={() => setExpandedName(expanded ? null : r.name)}
                    className={`cursor-pointer hover:bg-slate-800/40 ${isSelf ? "bg-amber-400/5" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${badgeStyle(r.group)}`}>
                        {isSelf ? "당사" : isUs ? "해외" : "국내"}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-100 whitespace-nowrap">{r.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                      {fmtPrice(r.snap?.openClose ?? null, isUs)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                      {fmtPrice(r.snap?.closeClose ?? null, isUs)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <RetPct v={r.snap?.changePct ?? null} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                      {fmtMarketCapKrw(r.snap?.closeMarketCap ?? null)}
                      {isUs && localCap != null && (
                        <span className="block text-[10px] text-slate-500">{fmtLocalCap(localCap, true)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-400">
                      {isUs ? "-" : fmtVolume(r.snap?.monthVolume ?? null)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-500 transition-transform inline-block ${
                          expanded ? "rotate-180" : ""
                        }`}
                      />
                    </td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={8} className="bg-slate-950/60 px-4 py-4">
                        <CompanyDetail
                          row={r}
                          isUs={isUs}
                          month={month}
                          chartRows={chartRows}
                          usHistoryRows={usHistoryRows}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="text-[14px] font-semibold text-slate-200 tabular-nums">{value}</p>
    </div>
  );
}

function FlowStatCard({ label, value }: { label: string; value: number }) {
  const color = value > 0 ? "text-red-400" : value < 0 ? "text-blue-400" : "text-slate-400";
  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className={`text-[14px] font-semibold tabular-nums ${color}`}>{fmtFlow(value)}</p>
    </div>
  );
}

function DetailItem({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" | "flat" }) {
  const color = tone === "up" ? "text-red-400" : tone === "down" ? "text-blue-400" : tone === "flat" ? "text-slate-400" : "text-slate-200";
  return (
    <div>
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className={`text-[13px] tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function WeeklyMiniChart({ closes, up }: { closes: number[]; up: boolean }) {
  if (closes.length < 2)
    return <p className="text-[11px] text-slate-600">추이를 표시할 데이터가 부족합니다.</p>;
  const width = 600;
  const height = 56;
  const pad = 4;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const points = closes
    .map((c, i) => {
      const x = pad + (i / (closes.length - 1)) * (width - pad * 2);
      const y = height - pad - ((c - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 56 }}>
      <polyline points={points} fill="none" stroke={up ? "#f87171" : "#60a5fa"} strokeWidth={1.5} />
    </svg>
  );
}

function CompanyDetail({
  row,
  isUs,
  month,
  chartRows,
  usHistoryRows,
}: {
  row: TableRowData;
  isUs: boolean;
  month: string;
  chartRows: WeeklyChartPoint[];
  usHistoryRows: UsStockHistoryRow[];
}) {
  const snap = row.snap;
  const flow = row.flow;

  if (!snap) {
    return <p className="text-[12px] text-slate-500">이번 달 수집된 데이터가 없습니다.</p>;
  }

  const dailyPoints = buildCompanyDailyPoints(chartRows, usHistoryRows, row.name, snap.code, isUs, month);
  const marketCapPctChange =
    snap.openMarketCap != null && snap.openMarketCap !== 0 && snap.marketCapChange != null
      ? (snap.marketCapChange / snap.openMarketCap) * 100
      : null;

  return (
    <div className="space-y-4">
      {/* A. 주식 및 거래정보 */}
      <div>
        <p className="text-[10px] text-slate-500 mb-1.5">주식 및 거래정보</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStatCard
            label="발행주식수"
            value={snap.shares != null ? Math.round(snap.shares).toLocaleString("ko-KR") + "주" : "-"}
          />
          <MiniStatCard label="월간 거래량" value={isUs ? "N/A" : fmtVolume(snap.monthVolume)} />
          <MiniStatCard label="월중 최고가" value={fmtPrice(snap.monthHigh, isUs)} />
          <MiniStatCard label="월중 최저가" value={fmtPrice(snap.monthLow, isUs)} />
        </div>
      </div>

      {/* B. 시가총액 변화 */}
      <div>
        <p className="text-[10px] text-slate-500 mb-1.5">시가총액 변화</p>
        <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <p className="text-[10px] text-slate-500">월초</p>
              <p className="text-[14px] font-semibold text-slate-200 tabular-nums">
                {fmtMarketCapKrw(snap.openMarketCap)}
              </p>
            </div>
            <span className="text-slate-600">→</span>
            <div>
              <p className="text-[10px] text-slate-500">월말</p>
              <p className="text-[14px] font-semibold text-slate-200 tabular-nums">
                {fmtMarketCapKrw(snap.closeMarketCap)}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[10px] text-slate-500">증감</p>
              <p
                className={`text-[14px] font-semibold tabular-nums ${
                  toneOf(snap.marketCapChange) === "up"
                    ? "text-red-400"
                    : toneOf(snap.marketCapChange) === "down"
                    ? "text-blue-400"
                    : "text-slate-400"
                }`}
              >
                {snap.marketCapChange != null
                  ? `${snap.marketCapChange >= 0 ? "+" : "-"}${fmtMarketCapKrw(Math.abs(snap.marketCapChange))}`
                  : "-"}
                {marketCapPctChange != null && (
                  <span className="text-[11px] font-normal ml-1">
                    ({marketCapPctChange >= 0 ? "+" : ""}
                    {marketCapPctChange.toFixed(2)}%)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* C. 투자자별 누적 순매수 */}
      <div>
        <p className="text-[10px] text-slate-500 mb-1.5">투자자별 누적 순매수</p>
        {isUs || !flow ? (
          <p className="text-[12px] text-slate-500 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
            해당 종목은 투자자별 매매동향 데이터가 제공되지 않습니다.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FlowStatCard label="개인" value={flow.individual} />
            <FlowStatCard label="외국인" value={flow.foreign} />
            <FlowStatCard label="기관" value={flow.institution} />
            <FlowStatCard label="기타" value={flow.otherTotal} />
          </div>
        )}
      </div>

      {/* 월간 주가 추이 */}
      <div>
        <p className="text-[10px] text-slate-500 mb-1.5">월간 주가 추이</p>
        <DailyPriceChart points={dailyPoints} isUs={isUs} height={160} />
      </div>
    </div>
  );
}
function Accordion({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-900/50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-[13px] font-semibold text-slate-200">
          {title} <span className="text-slate-500 font-normal">({count})</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="border-t border-slate-700 divide-y divide-slate-800">{children}</div>}
    </div>
  );
}

type NewsItemLike = {
  title: string;
  source: string;
  pubDate: string;
  link: string;
  market?: "KR" | "US";
  commentary?: string;
};

function NewsRow({ item }: { item: NewsItemLike }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!item.commentary;
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-start gap-2">
        {item.market && (
          <span className="mt-0.5 shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
            {item.market === "KR" ? "한국" : "미국"}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>{formatDate(item.pubDate)}</span>
            <span>·</span>
            <span className="truncate">{item.source}</span>
          </div>
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-slate-200 hover:text-amber-300 hover:underline"
          >
            {item.title}
          </a>
          {hasDetail && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="block text-[11px] text-slate-500 hover:text-slate-300 mt-0.5"
            >
              {expanded ? "분석 접기 ▲" : "분석 보기 ▼"}
            </button>
          )}
          {expanded && hasDetail && (
            <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">{item.commentary}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyNews() {
  return (
    <p className="px-4 py-6 text-center text-[12px] text-slate-500">이번 달 수집된 기사가 없습니다.</p>
  );
}

// ---------- 일별 데이터 기반 공용 차트 (weekly 페이지와 동일한 구간별 색상 방식) ----------

type ChartPoint = { date: string; value: number };

const CHART_UP = "#f87171";
const CHART_DOWN = "#60a5fa";
const CHART_FLAT = "#94a3b8";

const US_SYMBOL_MAP: Record<string, string> = {
  "Space X": "SPCX",
  "Rocket Lab": "RKLB",
  "Firefly Aerospace": "FLY",
};

function buildCompanyDailyPoints(
  chartRows: WeeklyChartPoint[],
  usHistoryRows: UsStockHistoryRow[],
  name: string,
  code: string,
  isUs: boolean,
  month: string
): ChartPoint[] {
  if (isUs) {
    const symbol = US_SYMBOL_MAP[name];
    return usHistoryRows
      .filter((r) => r.symbol === symbol && r.date.startsWith(month))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({ date: r.date, value: r.close }));
  }
  return chartRows
    .filter((r) => r.code === code && r.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ date: r.date, value: r.close }));
}

function buildSegments(points: ChartPoint[]) {
  const rows: Record<string, number | string>[] = points.map((p, i) => ({
    x: i,
    date: p.date,
  }));
  const segs: { key: string; color: string }[] = [];
  for (let i = 1; i < points.length; i++) {
    const key = `seg${i}`;
    const up = points[i].value > points[i - 1].value;
    const flat = points[i].value === points[i - 1].value;
    rows[i - 1][key] = points[i - 1].value;
    rows[i][key] = points[i].value;
    segs.push({ key, color: flat ? CHART_FLAT : up ? CHART_UP : CHART_DOWN });
  }
  return { rows, segs };
}

function DailyPriceChart({
  points,
  isUs,
  height = 170,
  showHeader = true,
}: {
  points: ChartPoint[];
  isUs: boolean;
  height?: number;
  showHeader?: boolean;
}) {
  const { rows, segs } = useMemo(() => buildSegments(points), [points]);

  if (points.length < 2) {
    return <p className="text-[11px] text-slate-600 py-4">이번 달 수집된 일별 데이터가 부족합니다.</p>;
  }

  const closes = points.map((p) => p.value);
  const changePct = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;
  const high = Math.max(...closes);
  const low = Math.min(...closes);
  const latest = closes[closes.length - 1];

  const tickCount = Math.min(6, rows.length);
  const step = Math.max(1, Math.floor((rows.length - 1) / Math.max(tickCount - 1, 1)));
  const dayTicks = rows.filter((_, i) => i % step === 0 || i === rows.length - 1).map((r) => r.x as number);

  return (
    <div>
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <RetPct v={changePct} />
          <div className="flex gap-3 text-[11px] text-slate-400">
            <span>
              최고 <span className="text-slate-200 tabular-nums">{fmtPrice(high, isUs)}</span>
            </span>
            <span>
              최신 <span className="text-slate-200 tabular-nums">{fmtPrice(latest, isUs)}</span>
            </span>
            <span>
              최저 <span className="text-slate-200 tabular-nums">{fmtPrice(low, isUs)}</span>
            </span>
          </div>
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, rows.length - 1]}
            ticks={dayTicks}
            tickFormatter={(x: number) => (rows[x] ? String(rows[x].date).slice(5).replace("-", "/") : "")}
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={{ stroke: "#334155" }}
            tickLine={false}
          />
          <YAxis domain={["dataMin", "dataMax"]} hide />
          <Tooltip content={<DailyChartTooltip points={points} isUs={isUs} />} />
          {segs.map((s) => (
            <Line
              key={s.key}
              type="linear"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={1.75}
              strokeLinecap="round"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
              activeDot={{ r: 3, fill: s.color, strokeWidth: 0 }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function DailyChartTooltip({ active, payload, points, isUs }: any) {
  if (!active || !payload || !payload.length) return null;
  const x = payload[0]?.payload?.x;
  if (x == null || !points[x]) return null;
  const point = points[x];
  const prev = points[x - 1];
  const chg = prev ? point.value - prev.value : null;
  const chgPct = prev && prev.value !== 0 ? ((chg as number) / prev.value) * 100 : null;
  const cumPct = points[0].value !== 0 ? ((point.value - points[0].value) / points[0].value) * 100 : 0;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-[11px] space-y-0.5 shadow-lg">
      <p className="text-slate-300 font-medium">{point.date}</p>
      <p className="text-slate-200">종가 {fmtPrice(point.value, isUs)}</p>
      {chg != null && (
        <p className={chg > 0 ? "text-red-400" : chg < 0 ? "text-blue-400" : "text-slate-400"}>
          전일대비 {chg > 0 ? "+" : ""}
          {fmtPrice(Math.abs(chg), isUs)} ({(chgPct as number) >= 0 ? "+" : ""}
          {(chgPct as number).toFixed(2)}%)
        </p>
      )}
      <p className="text-slate-500">
        월초 대비 {cumPct >= 0 ? "+" : ""}
        {cumPct.toFixed(2)}%
      </p>
    </div>
  );
}

function DailyCompareChart({ kospi, kosdaq }: { kospi: ChartPoint[]; kosdaq: ChartPoint[] }) {
  const merged = useMemo(() => {
    const map = new Map<string, { date: string; kospi?: number; kosdaq?: number }>();
    const baseK = kospi[0]?.value;
    const baseD = kosdaq[0]?.value;
    kospi.forEach((p) => {
      const pct = baseK ? ((p.value - baseK) / baseK) * 100 : 0;
      map.set(p.date, { ...(map.get(p.date) ?? { date: p.date }), date: p.date, kospi: pct });
    });
    kosdaq.forEach((p) => {
      const pct = baseD ? ((p.value - baseD) / baseD) * 100 : 0;
      map.set(p.date, { ...(map.get(p.date) ?? { date: p.date }), date: p.date, kosdaq: pct });
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [kospi, kosdaq]);

  if (merged.length < 2) {
    return (
      <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-4 text-[12px] text-slate-500">
        비교할 데이터가 충분하지 않습니다.
      </div>
    );
  }

  const tickCount = Math.min(6, merged.length);
  const step = Math.max(1, Math.floor((merged.length - 1) / Math.max(tickCount - 1, 1)));
  const dayTicks = merged.filter((_, i) => i % step === 0 || i === merged.length - 1).map((r) => r.date);

  return (
    <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[13px] font-semibold text-slate-200">코스피/코스닥 월간 누적 등락률 비교</h3>
        <div className="flex gap-3 text-[11px]">
          <span className="text-red-400">● 코스피</span>
          <span className="text-blue-400">● 코스닥</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={merged} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="date"
            ticks={dayTicks}
            tickFormatter={(d: string) => d.slice(5).replace("-", "/")}
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={{ stroke: "#334155" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#64748b" }}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
          <Tooltip content={<CompareTooltip />} />
          <Line
            type="linear"
            dataKey="kospi"
            stroke="#f87171"
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="kosdaq"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-slate-500 mt-1">월초 종가를 0%로 정규화한 누적 등락률 기준</p>
    </div>
  );
}

function CompareTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const kospi = payload.find((p: any) => p.dataKey === "kospi");
  const kosdaq = payload.find((p: any) => p.dataKey === "kosdaq");
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-[11px] space-y-0.5 shadow-lg">
      <p className="text-slate-300 font-medium">{label}</p>
      {kospi && (
        <p className="text-red-400">
          코스피 {kospi.value >= 0 ? "+" : ""}
          {kospi.value.toFixed(2)}%
        </p>
      )}
      {kosdaq && (
        <p className="text-blue-400">
          코스닥 {kosdaq.value >= 0 ? "+" : ""}
          {kosdaq.value.toFixed(2)}%
        </p>
      )}
    </div>
  );
}
