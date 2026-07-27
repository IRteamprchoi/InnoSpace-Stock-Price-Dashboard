"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from "recharts";
import { Rocket, TrendingUp, TrendingDown, Circle, ChevronDown } from "lucide-react";
import type { DailyRow, IntradayRow } from "@/lib/sheets";

const fmt = (n: number) => n == null ? "-" : n.toLocaleString("ko-KR");
const fmtSigned = (n: number) => n == null ? "-" : (n > 0 ? "+" : "") + n.toLocaleString("ko-KR");
const fmtWon = (n: number) => n == null ? "-" : "₩" + n.toLocaleString("ko-KR");
const fmtEok = (n: number) => n == null ? "-" : (n / 100000000).toLocaleString("ko-KR", { maximumFractionDigits: 0 }) + "억원";

// 숫자와 단위(원/주/억원)를 분리해서 렌더링하기 위한 헬퍼 - 단위는 .metric-unit로 살짝 작게 표시
// unitClassName을 주면 단위 색상을 숫자와 동일하게(예: 고가=빨강, 저가=파랑) 맞출 수 있음
function Won({ n, unitClassName }: { n: number; unitClassName?: string }) {
  if (n == null) return <>-</>;
  return <><span className={`metric-unit ${unitClassName || ""}`}>₩</span>{n.toLocaleString("ko-KR")}</>;
}
function Shares({ n }: { n: number }) {
  if (n == null) return <>-</>;
  return <>{n.toLocaleString("ko-KR")}<span className="metric-unit">주</span></>;
}
function Eok({ n }: { n: number }) {
  if (n == null) return <>-</>;
  return <>{(n / 100000000).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}<span className="metric-unit">억원</span></>;
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

function koreanDateLabel(dateStr: string) {
  const dt = new Date(dateStr + "T00:00:00+09:00");
  const wd = WEEKDAY_KO[dt.getDay()];
  const [y, m, d] = dateStr.split("-");
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일 (${wd})`;
}

function formatNowKST(date: Date) {
  const kst = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const wd = WEEKDAY_KO[kst.getDay()];
  const y = kst.getFullYear(), m = kst.getMonth() + 1, d = kst.getDate();
  const h = kst.getHours();
  const min = String(kst.getMinutes()).padStart(2, "0");
  const ampm = h < 12 ? "오전" : "오후";
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return `${y}년 ${m}월 ${d}일 (${wd}) ${ampm} ${h12}:${min} 기준`;
}

function isMarketOpenNow() {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const day = kst.getDay();
  const mins = kst.getHours() * 60 + kst.getMinutes();
  return day >= 1 && day <= 5 && mins >= 9 * 60 && mins <= 15 * 60 + 30;
}

function ChangeTag({ value, pct, size = "base" }: { value: number; pct?: number | null; size?: "base" | "lg" }) {
  const up = value > 0;
  const flat = value === 0;
  const color = flat ? "text-slate-300" : up ? "text-red-400" : "text-blue-400";
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1.5 price-change ${color}`}>
      {!flat && <Icon size={size === "lg" ? 17 : 15} strokeWidth={2.5} />}
      <span>{up ? "+" : ""}{fmt(value)}</span>
      {pct != null && <span>({up ? "+" : ""}{pct.toFixed(2)}%)</span>}
    </span>
  );
}

function StatCard({
  label, value, sub, highlight, variant = "default",
}: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; highlight?: string;
  variant?: "default" | "primary" | "investor";
}) {
  const valueClass =
    variant === "primary" ? "metric-value-primary" :
    variant === "investor" ? "investor-value" :
    "metric-value";
  return (
    <div className="bg-slate-900/80 border border-slate-700 rounded-lg px-4 py-3.5 flex flex-col gap-1.5 min-w-0">
      <span className="metric-label">{label}</span>
      <span className={`${valueClass} ${highlight || "text-slate-100"}`}>{value}</span>
      {sub && <span className="text-[13px] font-medium text-slate-400 mt-0.5">{sub}</span>}
    </div>
  );
}

function SectionHeader({ title, meta, right }: { title: string; meta?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-1 h-4 bg-amber-400 rounded-sm shrink-0" />
          <h2 className="section-title">{title}</h2>
        </div>
        {right}
      </div>
      {meta && <div className="text-[11px] text-slate-500 font-mono pl-3 mt-1 min-h-[30px] leading-snug">{meta}</div>}
    </div>
  );
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

const RANGES = [
  { key: "1W", label: "1주일", days: 6 },
  { key: "3M", label: "3개월", days: 66 },
  { key: "1Y", label: "1년", days: 252 },
  { key: "ALL", label: "전체", days: 9999 },
] as const;

type RangeKey = typeof RANGES[number]["key"];

const COLUMNS = [
  { key: "d", label: "일자", sticky: true },
  { key: "close", label: "종가" },
  { key: "chg", label: "등락폭", signed: true },
  { key: "chgPct", label: "등락률", pct: true },
  { key: "open", label: "시가" },
  { key: "high", label: "고가" },
  { key: "low", label: "저가" },
  { key: "vol", label: "거래량" },
  { key: "indiv", label: "개인", flow: true },
  { key: "foreign", label: "외국인", flow: true },
  { key: "inst", label: "기관계", flow: true, group: true },
  { key: "fin", label: "금융투자", flow: true, sub: true },
  { key: "ins", label: "보험", flow: true, sub: true },
  { key: "tr", label: "투신", flow: true, sub: true },
  { key: "bank", label: "은행", flow: true, sub: true },
  { key: "etcFin", label: "기타금융", flow: true, sub: true },
  { key: "pen", label: "연기금등", flow: true, sub: true },
  { key: "pe", label: "사모펀드", flow: true, sub: true },
  { key: "etcCorp", label: "기타법인", flow: true, group: true },
  { key: "etcForeign", label: "기타외국인", flow: true, group: true },
  { key: "etcTotal", label: "기타합계", flow: true, group: true },
] as const;

function flowColor(v: number) {
  if (v > 0) return "text-red-400/90";
  if (v < 0) return "text-blue-400/90";
  return "text-slate-500";
}

export default function Dashboard({ dailyData, intradayData }: { dailyData: DailyRow[]; intradayData: IntradayRow[] }) {
  const [range, setRange] = useState<RangeKey>("1W");
  const [query, setQuery] = useState("");
  const [tableOpen, setTableOpen] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const sorted = useMemo(() => [...dailyData].sort((a, b) => a.d.localeCompare(b.d)), [dailyData]);
  const latest = sorted[sorted.length - 1];
  const prevClose = sorted.length > 1 ? sorted[sorted.length - 2].close : latest?.close;
  const marketOpen = isMarketOpenNow();

  // 장중 참고 시세: intraday_price 시트의 가장 최근 값, 없으면 일별 확정 데이터로 대체
  const latestIntraday = intradayData.length ? intradayData[intradayData.length - 1] : null;
  const live = latestIntraday
    ? {
        close: latestIntraday.price, chg: latestIntraday.chg, chgPct: latestIntraday.chgPct,
        open: latestIntraday.open, high: latestIntraday.high, low: latestIntraday.low,
        vol: latestIntraday.vol, amt: latestIntraday.amt, mcap: latestIntraday.mcap,
      }
    : latest
    ? { close: latest.close, chg: latest.chg, chgPct: latest.chgPct, open: latest.open, high: latest.high, low: latest.low, vol: latest.vol, amt: latest.amt, mcap: latest.mcap }
    : null;

  const rangeDays = RANGES.find((r) => r.key === range)!.days;
  const chartData = useMemo(() => {
    const base = sorted.slice(-rangeDays);
    // daily_data에 아직 오늘자 확정 행이 없어도(18:30 이전), 장중 시세가 있으면
    // 그래프 맨 끝에 "지금 이 순간"을 임시로 이어붙여서 마지막 지점이 멈춰있지 않게 함
    const lastDate = base.length ? base[base.length - 1].d : null;
    const todayKey = latestIntraday ? (latestIntraday.ts || "").slice(0, 10) : null;
    if (todayKey && (!lastDate || todayKey > lastDate) && live) {
      const prevCloseForToday = base.length ? base[base.length - 1].close : live.close;
      const chg = live.close - prevCloseForToday;
      const chgPct = prevCloseForToday ? Math.round((chg / prevCloseForToday) * 10000) / 100 : 0;
      return [
        ...base,
        {
          d: todayKey, close: live.close, chg, chgPct,
          open: live.open, high: live.high, low: live.low,
          vol: live.vol, amt: live.amt, mcap: live.mcap,
          indiv: 0, foreign: 0, inst: 0, fin: 0, ins: 0, tr: 0, bank: 0,
          etcFin: 0, pen: 0, pe: 0, etcCorp: 0, etcForeign: 0, etcTotal: 0,
        } as DailyRow,
      ];
    }
    return base;
  }, [sorted, rangeDays, latestIntraday, live]);

  const weekChart = useMemo(() => {
    if (range !== "1W") return null;
    const WEEK_TRADING_DAYS = 5; // 네이버 등 기준, 5거래일
    const MARKET_OPEN_MIN = 9 * 60; // 09:00
    const MARKET_CLOSE_MIN = 15 * 60 + 30; // 15:30
    const SESSION_LEN = MARKET_CLOSE_MIN - MARKET_OPEN_MIN;

    // intraday_price 데이터를 날짜별로 그룹핑
    const intradayByDate = new Map<string, IntradayRow[]>();
    intradayData.forEach((r) => {
      const dateKey = (r.ts || "").slice(0, 10);
      if (!dateKey) return;
      if (!intradayByDate.has(dateKey)) intradayByDate.set(dateKey, []);
      intradayByDate.get(dateKey)!.push(r);
    });
    intradayByDate.forEach((arr) => arr.sort((a, b) => a.ts.localeCompare(b.ts)));

    // daily_data에 아직 없는(18:30 이전) "오늘" 같은 날짜가 intraday_price에 있으면 별도로 분리
    const lastSortedDate = sorted.length ? sorted[sorted.length - 1].d : null;
    const liveDates = Array.from(intradayByDate.keys())
      .filter((d) => !lastSortedDate || d > lastSortedDate)
      .sort();

    // 전체 5거래일 중, 라이브(오늘)로 채워질 날짜 수를 뺀 만큼만 과거 확정 데이터에서 가져옴
    const histCount = Math.max(WEEK_TRADING_DAYS - liveDates.length, 0);
    const histDays = sorted.slice(-histCount);

    // 하루 = x축에서 정확히 1칸을 차지하도록, "포인트 개수"가 아니라 "그날 몇 시였는지"로 x값을 계산
    const dayLabels: string[] = [];
    const points: { x: number; date: string; kind: string; v: number; dayColor: string; isStart: boolean; dayChg: number; dayChgPct: number }[] = [];

    const timeToFraction = (hhmm: string) => {
      const [h, m] = hhmm.split(":").map(Number);
      const mins = h * 60 + (m || 0);
      const clamped = Math.min(Math.max(mins, MARKET_OPEN_MIN), MARKET_CLOSE_MIN);
      return (clamped - MARKET_OPEN_MIN) / SESSION_LEN;
    };

    histDays.forEach((p, dayIdx) => {
      dayLabels.push(p.d);
      const up = p.chg >= 0;
      const dayColor = up ? "#f87171" : "#60a5fa";
      const intraForDay = intradayByDate.get(p.d);

      if (intraForDay && intraForDay.length > 1) {
        // 실제 장중 데이터가 있는 날: 촘촘한 실데이터, 실제 시각 기준으로 배치
        intraForDay.forEach((r, j) => {
          const timeLabel = r.ts.length >= 16 ? r.ts.slice(11, 16) : "09:00";
          const x = dayIdx + timeToFraction(timeLabel);
          points.push({ x, date: p.d + " " + timeLabel, kind: "체결", v: r.price, dayColor, isStart: j === 0, dayChg: p.chg, dayChgPct: p.chgPct });
        });
      } else {
        // 장중 데이터가 아직 없는 날: 시가(09:00)/저가/고가(장중 임의 시점)/종가(15:30)로 근사, 하루 폭은 동일하게 유지
        const seq = up
          ? [{ v: p.open, k: "시가", frac: 0 }, { v: p.low, k: "저가", frac: 1 / 3 }, { v: p.high, k: "고가", frac: 2 / 3 }, { v: p.close, k: "종가", frac: 1 }]
          : [{ v: p.open, k: "시가", frac: 0 }, { v: p.high, k: "고가", frac: 1 / 3 }, { v: p.low, k: "저가", frac: 2 / 3 }, { v: p.close, k: "종가", frac: 1 }];
        seq.forEach((s, j) => {
          points.push({ x: dayIdx + s.frac, date: p.d, kind: s.k, v: s.v, dayColor, isStart: j === 0, dayChg: p.chg, dayChgPct: p.chgPct });
        });
      }
    });

    // daily_data에 아직 오늘자 행이 없어도(18:30 이전), intraday_price에 오늘 데이터가 있으면 그래프에 이어붙임
    liveDates.forEach((dateKey, i) => {
      const dayIdx = histDays.length + i;
      dayLabels.push(dateKey);
      const intraForDay = intradayByDate.get(dateKey);
      if (!intraForDay || !intraForDay.length) return;
      const refPrevClose = sorted.length ? sorted[sorted.length - 1].close : intraForDay[0].price;
      const latestPrice = intraForDay[intraForDay.length - 1].price;
      const dayChg = latestPrice - refPrevClose;
      const dayChgPct = refPrevClose ? Math.round((dayChg / refPrevClose) * 10000) / 100 : 0;
      const dayColor = dayChg >= 0 ? "#f87171" : "#60a5fa";
      intraForDay.forEach((r, j) => {
        const timeLabel = r.ts.length >= 16 ? r.ts.slice(11, 16) : "09:00";
        const x = dayIdx + timeToFraction(timeLabel);
        points.push({ x, date: dateKey + " " + timeLabel, kind: "체결", v: r.price, dayColor, isStart: j === 0, dayChg, dayChgPct });
      });
    });

    // x값 기준으로 정렬 (같은 날 안에서, 그리고 날짜 간에도 시간 순서 보장)
    points.sort((a, b) => a.x - b.x);

    const rows: any[] = points.map((pt) => ({
      x: pt.x,
      date: pt.date, kind: pt.kind, dayChg: pt.dayChg, dayChgPct: pt.dayChgPct,
    }));
    const segs: { key: string; color: string }[] = [];
    for (let i = 1; i < points.length; i++) {
      const key = `seg${i}`;
      rows[i - 1][key] = points[i - 1].v;
      rows[i][key] = points[i].v;
      segs.push({ key, color: points[i].dayColor });
    }

    const tickPositions = dayLabels.map((_, i) => i);
    const tickFormatter = (v: number) => {
      const label = dayLabels[Math.round(v)];
      return label ? label.slice(5).replace("-", "/") : "";
    };

    return { rows, segs, tickPositions, tickFormatter, dayCount: dayLabels.length };
  }, [sorted, range, intradayData]);

  const maxPoint = useMemo(() => chartData.length ? chartData.reduce((a, b) => (b.close > a.close ? b : a), chartData[0]) : null, [chartData]);
  const minPoint = useMemo(() => chartData.length ? chartData.reduce((a, b) => (b.close < a.close ? b : a), chartData[0]) : null, [chartData]);

  function AreaTooltip({ active, payload }: any) {
    if (!active || !payload || !payload.length) return null;
    const row = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-xs shadow-xl">
        <div className="text-slate-400 mb-1 font-mono">{row.d}</div>
        <div className="text-slate-100 font-mono">종가 {fmtWon(row.close)}</div>
        <div className={row.chg >= 0 ? "text-red-400 font-mono" : "text-blue-400 font-mono"}>
          {row.chg >= 0 ? "+" : ""}{fmt(row.chg)} ({row.chgPct >= 0 ? "+" : ""}{row.chgPct.toFixed(2)}%)
        </div>
      </div>
    );
  }

  function WeekTooltip({ active, payload }: any) {
    if (!active || !payload || !payload.length) return null;
    const row = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-xs shadow-xl">
        <div className="text-slate-400 mb-1 font-mono">{row.date} · {row.kind}</div>
        <div className="text-slate-100 font-mono">{fmtWon(payload[0].value)}</div>
        <div className={row.dayChg >= 0 ? "text-red-400 font-mono" : "text-blue-400 font-mono"}>
          당일 {row.dayChg >= 0 ? "+" : ""}{fmt(row.dayChg)} ({row.dayChgPct >= 0 ? "+" : ""}{row.dayChgPct.toFixed(2)}%)
        </div>
      </div>
    );
  }

  const filteredTable = useMemo(() => {
    const rows = [...sorted].reverse();
    if (!query) return rows;
    return rows.filter((r) => r.d.includes(query));
  }, [sorted, query]);

  const visibleRows = tableOpen ? filteredTable : filteredTable.slice(0, 12);
  const visibleColumns = showDetail ? COLUMNS : COLUMNS.filter((c: any) => !c.sub);

  if (!latest || !live) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <p className="text-slate-400 text-sm">
          데이터를 아직 불러오지 못했습니다. 구글시트 게시 링크(DAILY_CSV_URL / INTRADAY_CSV_URL) 환경변수 설정을 확인해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8">

        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
              <Rocket size={20} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-50">이노스페이스 주가 및 매매 동향</h1>
              <p className="text-xs text-slate-500 font-mono">462350 · KOSDAQ</p>
            </div>
          </div>
          <HeaderClock />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10 items-stretch">

          <section className="h-full flex flex-col">
            <SectionHeader
              title="현재 시세"
              right={<span className="text-[10px] text-slate-600 border border-slate-800 rounded px-1.5 py-0.5">KIS API 연동 · 5분 간격</span>}
              meta={
                <>
                  <div className="inline-flex items-center gap-2">
                    <Circle size={8} className={marketOpen ? "fill-amber-400 text-amber-400 animate-pulse" : "fill-slate-600 text-slate-600"} />
                    <span>{marketOpen ? "장중" : "장마감"}</span>
                    <span className="text-slate-600">·</span>
                    <span>{formatNowKST(now)}</span>
                  </div>
                  <div>매 5분마다 업데이트</div>
                </>
              }
            />
            <div className="bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-700 rounded-xl p-5 flex-1 flex flex-col justify-between gap-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="current-price"><Won n={live.close} /></div>
                  <div className="mt-2"><ChangeTag value={live.chg} pct={live.chgPct} size="lg" /></div>
                </div>
                <div className="text-[13px] font-semibold text-slate-300 text-right">
                  <div>전일종가 <span className="metric-unit text-slate-200">{fmtWon(prevClose)}</span></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="시가" value={<Won n={live.open} />} />
                <StatCard label="거래량" value={<Shares n={live.vol} />} />
                <StatCard label="고가" value={<Won n={live.high} unitClassName="text-red-300" />} highlight="text-red-300" />
                <StatCard label="거래대금" value={<Eok n={live.amt} />} />
                <StatCard label="저가" value={<Won n={live.low} unitClassName="text-blue-300" />} highlight="text-blue-300" />
                <StatCard label="시가총액" value={<Eok n={live.mcap} />} />
              </div>
            </div>
          </section>

          <section className="h-full flex flex-col">
            <SectionHeader
              title="일별 주가 및 거래 현황"
              meta={
                <>
                  <div>{koreanDateLabel(latest.d)} · 한국거래소(KRX) 마감 기준</div>
                  <div>매일 18시 30분 업데이트</div>
                </>
              }
            />
            <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-5 flex-1 flex flex-col justify-between gap-3">
              <div className="grid grid-cols-2 gap-3">
                <StatCard variant="primary" label="종가" value={<Won n={latest.close} />} sub={<ChangeTag value={latest.chg} pct={latest.chgPct} />} />
                <StatCard label="총 거래량" value={<Shares n={latest.vol} />} />
                <StatCard label="시가총액" value={<Eok n={latest.mcap} />} />
                <StatCard label="거래대금" value={<Eok n={latest.amt} />} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard variant="investor" label="외국인 순매수" value={fmtSigned(latest.foreign)} highlight={flowColor(latest.foreign)} />
                <StatCard variant="investor" label="개인 순매수" value={fmtSigned(latest.indiv)} highlight={flowColor(latest.indiv)} />
                <StatCard variant="investor" label="기관 순매수" value={fmtSigned(latest.inst)} highlight={flowColor(latest.inst)} />
                <StatCard variant="investor" label="기타 순매수" value={fmtSigned(latest.etcTotal)} highlight={flowColor(latest.etcTotal)} />
              </div>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="section-title">주가 추이</h2>
          <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  range === r.key ? "bg-amber-400/20 text-amber-300" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 mb-10">
          <ResponsiveContainer width="100%" height={240}>
            {range === "1W" && weekChart ? (
              <ComposedChart data={weekChart.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={[0, weekChart.dayCount]}
                  ticks={weekChart.tickPositions}
                  tickFormatter={weekChart.tickFormatter}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={{ stroke: "#1e293b" }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} domain={["auto", "auto"]} tickFormatter={(v) => fmt(v)} axisLine={false} tickLine={false} width={56} />
                <Tooltip content={<WeekTooltip />} />
                {weekChart.segs.map((s) => (
                  <Line key={s.key} dataKey={s.key} stroke={s.color} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
                ))}
              </ComposedChart>
            ) : (
              <ComposedChart data={chartData} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4ade80" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => v.slice(5).replace("-", "/")} minTickGap={30} axisLine={{ stroke: "#1e293b" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} domain={["auto", "auto"]} tickFormatter={(v) => fmt(v)} axisLine={false} tickLine={false} width={56} />
                <Tooltip content={<AreaTooltip />} />
                <Area type="monotone" dataKey="close" stroke="#4ade80" strokeWidth={2} fill="url(#priceFill)" dot={false} isAnimationActive={false} />
                {maxPoint && (
                  <ReferenceDot
                    x={maxPoint.d} y={maxPoint.close} r={4} fill="#f87171" stroke="none"
                    label={{ value: `최고 ${fmt(maxPoint.close)} (${maxPoint.d.slice(5).replace("-", "/")})`, position: "top", fill: "#f87171", fontSize: 10 }}
                  />
                )}
                {minPoint && (
                  <ReferenceDot
                    x={minPoint.d} y={minPoint.close} r={4} fill="#60a5fa" stroke="none"
                    label={{ value: `최저 ${fmt(minPoint.close)} (${minPoint.d.slice(5).replace("-", "/")})`, position: "bottom", fill: "#60a5fa", fontSize: 10 }}
                  />
                )}
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="section-title">일별 주가 · 투자자별 순매수 상세</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDetail((v) => !v)}
              className={`px-3 py-1.5 text-xs rounded-md border font-medium transition-colors ${
                showDetail ? "bg-amber-400/20 border-amber-400/40 text-amber-300" : "border-slate-800 text-slate-500 hover:text-slate-300"
              }`}
            >
              {showDetail ? "기관 상세항목 숨기기" : "기관 상세항목 펼치기"}
            </button>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="날짜 검색 (예: 2026-05)"
              className="bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-amber-400/50 w-40"
            />
          </div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500">
                  {visibleColumns.map((c: any) => (
                    <th
                      key={c.key}
                      className={`text-right font-medium px-2.5 py-2 whitespace-nowrap ${c.sticky ? "text-left sticky left-0 bg-slate-900 z-10" : ""} ${c.sub ? "text-slate-600" : ""}`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.d} className="border-b border-slate-800/60 hover:bg-slate-800/30 font-mono">
                    {visibleColumns.map((c: any) => {
                      const v = (r as any)[c.key];
                      let content: React.ReactNode = fmt(v);
                      let cls = "text-slate-300";
                      if (c.key === "d") cls = "text-slate-400";
                      if (c.key === "close") cls = "text-slate-100";
                      if ((c as any).signed) { content = fmtSigned(v); cls = v >= 0 ? "text-red-400" : "text-blue-400"; }
                      if ((c as any).pct) { content = (v >= 0 ? "+" : "") + v + "%"; cls = v >= 0 ? "text-red-400" : "text-blue-400"; }
                      if ((c as any).flow) { content = fmtSigned(v); cls = flowColor(v); }
                      return (
                        <td
                          key={c.key}
                          className={`px-2.5 py-1.5 text-right whitespace-nowrap ${c.sticky ? "text-left sticky left-0 bg-slate-950" : ""} ${cls} ${(c as any).sub ? "opacity-70" : ""}`}
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredTable.length > 12 && (
            <button
              onClick={() => setTableOpen((v) => !v)}
              className="w-full py-2.5 text-xs text-slate-500 hover:text-amber-300 flex items-center justify-center gap-1 border-t border-slate-800"
            >
              {tableOpen ? "접기" : `전체 ${filteredTable.length}건 보기`}
              <ChevronDown size={12} className={tableOpen ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
          )}
        </div>

        <p className="text-[10px] text-slate-700 text-center pt-4">이노스페이스 IR팀 내부용 대시보드</p>
      </div>
    </div>
  );
}
