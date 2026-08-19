"use client";

import { useMemo } from "react";
import type { IndexDailyRow, MarketNewsMonthlyRow } from "@/lib/sheets";

// ===== 이 파일은 새로 만드는 파일입니다: components/MonthlyDashboard.tsx =====
// app/monthly/page.tsx (서버 컴포넌트)에서 데이터를 fetch해서 이 컴포넌트에 props로 넘겨주는 구조입니다.
// (WeeklyDashboard.tsx가 app/weekly/page.tsx로부터 props를 받는 것과 동일한 패턴)

type MonthlyDashboardProps = {
  month: string; // "2026-08" 형식
  indexRows: IndexDailyRow[]; // getIndexDailyHistory() 결과 전체 (필터링은 이 컴포넌트 내부에서)
  newsRows: MarketNewsMonthlyRow[]; // getMarketNewsMonthly() 결과 전체
};

export default function MonthlyDashboard({ month, indexRows, newsRows }: MonthlyDashboardProps) {
  const monthLabel = `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`;

  // ---------- I장: 코스피/코스닥 월간 지수 변화 ----------
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

  // ---------- III장: 시황 뉴스 (report_date=주차 기준으로 그룹핑, 한 주에 KR->US 순서) ----------
  const newsByWeek = useMemo(() => {
    const monthNews = newsRows.filter((r) => weekBelongsToMonth(r, month));
    const grouped = new Map<string, MarketNewsMonthlyRow[]>();
    for (const row of monthNews) {
      const list = grouped.get(row.reportDate) ?? [];
      list.push(row);
      grouped.set(row.reportDate, list);
    }
    // 각 주차 안에서 KR -> US 순서 정렬, 주차 자체는 날짜순 정렬
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([reportDate, items]) => ({
        reportDate,
        items: items.sort((a, b) => (a.market === b.market ? 0 : a.market === "KR" ? -1 : 1)),
      }));
  }, [newsRows, month]);

  return (
    <div className="min-h-screen bg-[#0b1220] text-slate-100 px-6 py-8 space-y-10">
      <header>
        <h1 className="text-xl font-semibold">이노스페이스 {monthLabel} 주가 및 매매 동향</h1>
        <p className="text-sm text-slate-400 mt-1">462350 · KOSDAQ</p>
      </header>

      {/* ===== I장: 코스닥/코스피 월간 지수 변화 ===== */}
      <section>
        <SectionTitle>I. 코스닥/코스피 월간 지수 변화</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <IndexChartCard title="코스피 지수 변화" rows={kospiRows} />
          <IndexChartCard title="코스닥 지수 변화" rows={kosdaqRows} />
        </div>
        <div className="mt-4">
          <IndexCompareChart title="코스피/코스닥 월간 지수 변화 비교" kospi={kospiRows} kosdaq={kosdaqRows} />
        </div>
      </section>

      {/* ===== II장: 우주항공기업 종목별 월간 주가/매매현황 ===== */}
      <section>
        <SectionTitle>II. 우주항공기업 종목별 월간 주가/매매현황</SectionTitle>
        <PeerMonthlyTablePlaceholder month={month} />
      </section>

      {/* ===== III장: 월간 우주항공기업 주요 공시 및 관련 기사 ===== */}
      <section>
        <SectionTitle>III. {monthLabel} 우주항공기업 주요 공시 및 관련 기사</SectionTitle>
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-medium text-slate-300">1. {Number(month.slice(5, 7))}월 시황</h3>
          {newsByWeek.length === 0 && (
            <p className="text-sm text-slate-500">이번 달 발간된 시황 뉴스가 없습니다.</p>
          )}
          {newsByWeek.map(({ reportDate, items }) => (
            <div key={reportDate} className="space-y-2">
              {items.map((item) => (
                <NewsItem key={item.market + item.link} item={item} />
              ))}
            </div>
          ))}
        </div>
        {/* 종목별 뉴스(2~N번, 회사별)는 weekly_news 데이터를 월 단위로 집계하는 다음 단계에서 추가 예정 */}
      </section>
    </div>
  );
}

// ---------- 서브 컴포넌트 ----------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold border-l-4 border-blue-400 pl-3">{children}</h2>
  );
}

function NewsItem({ item }: { item: MarketNewsMonthlyRow }) {
  return (
    <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-3">
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
        <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
          {item.market === "KR" ? "한국" : "미국"}
        </span>
        <span>{item.source}</span>
        <span>·</span>
        <span>{formatPubDate(item.pubDate)}</span>
      </div>
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-slate-100 hover:underline"
      >
        {item.title}
      </a>
      {item.commentary && (
        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{item.commentary}</p>
      )}
    </div>
  );
}

function PeerMonthlyTablePlaceholder({ month }: { month: string }) {
  // TODO(다음 단계): 발행주식수 / 시가총액(월초·월말·증감) / 종가(월초·월말·증감%) /
  // 거래량(월간누적) / 개인·외국인·기관계·기타 순매수(월간누적)
  // 데이터 소스: weekly_prices(월초·월말 스냅샷), weekly_chart_data(월간 누적 거래량),
  // domestic_investor_flow(월간 합산 매매동향, 해외 3종목은 "-")
  return (
    <div className="mt-4 rounded-lg border border-dashed border-slate-600 p-6 text-center text-sm text-slate-500">
      {month} 18개사 표는 다음 단계에서 채웁니다 (발행주식수 / 시가총액 / 종가 / 거래량 / 매매동향)
    </div>
  );
}

function IndexChartCard({ title, rows }: { title: string; rows: IndexDailyRow[] }) {
  return (
    <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4">
      <h3 className="text-sm font-medium text-slate-300 mb-2">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">데이터가 없습니다.</p>
      ) : (
        <SimpleLineChart rows={rows} />
      )}
    </div>
  );
}

function IndexCompareChart({
  title,
  kospi,
  kosdaq,
}: {
  title: string;
  kospi: IndexDailyRow[];
  kosdaq: IndexDailyRow[];
}) {
  return (
    <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4">
      <h3 className="text-sm font-medium text-slate-300 mb-2">{title}</h3>
      {kospi.length === 0 && kosdaq.length === 0 ? (
        <p className="text-xs text-slate-500">데이터가 없습니다.</p>
      ) : (
        <SimpleDualLineChart seriesA={kospi} seriesB={kosdaq} labelA="코스피" labelB="코스닥" />
      )}
    </div>
  );
}

// 가벼운 자체 SVG 라인차트 (외부 차트 라이브러리 의존성 없음, MiniStockChart.tsx와 동일한 접근)
function SimpleLineChart({ rows }: { rows: IndexDailyRow[] }) {
  const width = 480;
  const height = 160;
  const pad = 24;

  const closes = rows.map((r) => r.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  const points = rows.map((r, i) => {
    const x = pad + (i / Math.max(rows.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((r.close - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  });

  const first = rows[0];
  const last = rows[rows.length - 1];
  const changePct = first ? ((last.close - first.close) / first.close) * 100 : 0;
  const isUp = changePct >= 0;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={isUp ? "#f87171" : "#60a5fa"}
          strokeWidth={2}
        />
      </svg>
      <div className="flex justify-between text-xs text-slate-400 mt-1">
        <span>{first?.date}</span>
        <span className={isUp ? "text-red-400" : "text-blue-400"}>
          {isUp ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
        </span>
        <span>{last?.date}</span>
      </div>
    </div>
  );
}

function SimpleDualLineChart({
  seriesA,
  seriesB,
  labelA,
  labelB,
}: {
  seriesA: IndexDailyRow[];
  seriesB: IndexDailyRow[];
  labelA: string;
  labelB: string;
}) {
  const width = 480;
  const height = 180;
  const pad = 24;

  const normalize = (rows: IndexDailyRow[]): { x: number; pct: number }[] => {
    if (rows.length === 0) return [];
    const base = rows[0].close;
    return rows.map((r, i) => {
      const x = pad + (i / Math.max(rows.length - 1, 1)) * (width - pad * 2);
      const pct = (r.close - base) / base; // 월초 대비 등락률로 정규화해서 두 지수를 같은 축에 비교
      return { x, pct };
    });
  };

  const a = normalize(seriesA);
  const b = normalize(seriesB);
  const allPct = [...a, ...b].map((p) => p.pct);
  const min = Math.min(0, ...allPct);
  const max = Math.max(0, ...allPct);
  const range = max - min || 1;

  const toPoints = (pts: { x: number; pct: number }[]) =>
    pts.map((p) => `${p.x},${height - pad - ((p.pct - min) / range) * (height - pad * 2)}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <polyline points={toPoints(a)} fill="none" stroke="#f87171" strokeWidth={2} />
        <polyline points={toPoints(b)} fill="none" stroke="#60a5fa" strokeWidth={2} />
      </svg>
      <div className="flex gap-4 text-xs text-slate-400 mt-1">
        <span className="text-red-400">● {labelA}</span>
        <span className="text-blue-400">● {labelB}</span>
        <span className="text-slate-500">(월초 대비 등락률 기준)</span>
      </div>
    </div>
  );
}

// ---------- 유틸 ----------

function formatPubDate(pubDate: string): string {
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return pubDate;
  return d.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

// market_news_weekly의 report_date(주차 기준일)가 해당 월에 속하는지 판단.
// 리포트가 그 주의 월요일 날짜로 찍히는 게 정상이지만, 수동 실행 시 실행일 기준으로 찍힐 수 있어
// pub_date(실제 기사 발행일)도 함께 확인해서 더 정확하게 판단합니다.
function weekBelongsToMonth(row: MarketNewsMonthlyRow, month: string): boolean {
  if (row.reportDate.startsWith(month)) return true;
  const pd = new Date(row.pubDate);
  if (isNaN(pd.getTime())) return false;
  const pdMonth = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, "0")}`;
  return pdMonth === month;
}
