"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { WeeklyPriceRow } from "@/lib/sheets";
import type { FxRate } from "@/lib/fx";

// 평균 대신 중앙값을 쓰고 싶으면 이 값만 바꾸면 됩니다 (스펙 요청: 코드 구조로 전환 가능하게)
const SUMMARY_STAT: "avg" | "median" = "avg";

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
function dotDate(dateStr?: string) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  return `${y}.${m}.${d}`;
}
function addDaysStr(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00+09:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtPrice(n: number | null, isUs: boolean) {
  if (n == null) return "-";
  if (isUs) return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

// 1조원 이상은 "0.0조원", 미만은 "0,000억원" (소수점은 조원 단위에서만 1자리)
function fmtMarketCapKrw(krw: number | null) {
  if (krw == null) return "-";
  if (krw >= 1e12) return (krw / 1e12).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "조원";
  return Math.round(krw / 1e8).toLocaleString("ko-KR") + "억원";
}

function fmtLocalCap(n: number | null, isUs: boolean) {
  if (n == null) return null;
  if (isUs) return "$" + (n / 1e6).toLocaleString("ko-KR", { maximumFractionDigits: 0 }) + "M";
  return null; // 국내는 원화가 곧 원본 통화라 별도 보조표시 불필요
}

function rankSuffix(rank: number, total: number) {
  return `${rank}위 / ${total}개사`;
}

function RetPct({ v, size = "base" }: { v: number | null; size?: "base" | "lg" }) {
  if (v == null) return <span className="text-slate-600">-</span>;
  const up = v > 0;
  const flat = v === 0;
  const color = flat ? "text-slate-400" : up ? "text-red-400" : "text-blue-400";
  const arrow = flat ? "―" : up ? "▲" : "▼";
  const sizeClass = size === "lg" ? "text-[15px] sm:text-[16px]" : "text-[13px]";
  return (
    <span className={`inline-flex items-center gap-1 font-bold tabular-nums ${sizeClass} ${color}`}>
      <span>{arrow}</span>
      {Math.abs(v).toFixed(2)}%
    </span>
  );
}

function MiniBar({ v, maxAbs }: { v: number | null; maxAbs: number }) {
  if (v == null || maxAbs === 0) return null;
  const up = v >= 0;
  const widthPct = Math.min((Math.abs(v) / maxAbs) * 50, 50); // 셀 폭의 최대 50%
  return (
    <div className="h-1 w-full flex mt-1" dir={up ? "ltr" : "rtl"}>
      <div
        className={`h-full rounded-full ${up ? "bg-red-400/70" : "bg-blue-400/70"}`}
        style={{ width: `${widthPct}%` }}
      />
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: "own" | "domestic" | "us" }) {
  const cls =
    tone === "own"
      ? "bg-amber-400/15 text-amber-300"
      : "bg-slate-800 text-slate-300";
  return (
    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded ${cls}`}>
      {label}
    </span>
  );
}

const DETAIL_COLS = 4; // colSpan for the expanded detail row

export default function PeerComparisonTable({
  rows,
  fx,
}: {
  rows: WeeklyPriceRow[]; // 이노스페이스 + 국내피어 + 해외피어 (지수 제외), 순서는 아래에서 재정렬
  fx: FxRate | null;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const innospace = rows.find((r) => r.code === "462350") || null;
  const domesticPeers = rows.filter((r) => r.category === "domestic" && r.code !== "462350");
  const usPeers = rows.filter((r) => r.category === "us");
  const allPeers = [...domesticPeers, ...usPeers]; // 이노스페이스 제외한 비교 대상

  const ordered = innospace ? [innospace, ...domesticPeers, ...usPeers] : [...domesticPeers, ...usPeers];

  const refFriday = rows[0]?.refFriday || "";
  const weekStart = refFriday ? addDaysStr(refFriday, -4) : "";

  const maxAbsRet = useMemo(
    () => Math.max(0.01, ...ordered.map((r) => Math.abs(r.ret1w ?? 0))),
    [ordered]
  );

  const krwMarketCap = (r: WeeklyPriceRow) => {
    if (r.marketCap == null) return null;
    if (r.category === "us") return fx ? r.marketCap * fx.usdToKrw : null;
    return r.marketCap;
  };

  // --- 상단 요약 카드 계산 ---
  const peerRets = allPeers.map((r) => r.ret1w).filter((v): v is number => v != null);
  const peerAvg = peerRets.length ? peerRets.reduce((a, b) => a + b, 0) / peerRets.length : null;
  const peerMedian = (() => {
    if (!peerRets.length) return null;
    const sorted = [...peerRets].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  })();
  const peerSummaryStat = SUMMARY_STAT === "avg" ? peerAvg : peerMedian;
  const peerSummaryLabel = SUMMARY_STAT === "avg" ? "피어그룹 평균 등락률" : "피어그룹 중간값 등락률";

  const rankInfo = useMemo(() => {
    if (!innospace) return null;
    const sorted = [...ordered].sort((a, b) => (b.ret1w ?? -999) - (a.ret1w ?? -999));
    const idx = sorted.findIndex((r) => r.code === "462350");
    return idx === -1 ? null : { rank: idx + 1, total: sorted.length };
  }, [ordered, innospace]);

  const hasUs = usPeers.length > 0;

  return (
    <div>
      {/* 표 제목 */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-1">
          <span className="w-1 h-4 bg-amber-400 rounded-sm shrink-0" />
          <h2 className="section-title">이노스페이스 및 피어그룹 주간 주가 동향</h2>
        </div>
        <p className="text-[13px] text-slate-500 pl-3">
          주간 종가 변동 및 시가총액 비교 · 기준 기간: {dotDate(weekStart)} ~ {dotDate(refFriday)}
        </p>
      </div>

      {/* 상단 요약 카드 3개 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-3">
          <div className="metric-label mb-1">이노스페이스 주간 등락률</div>
          <RetPct v={innospace?.ret1w ?? null} size="lg" />
        </div>
        <div className="bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-3">
          <div className="metric-label mb-1">{peerSummaryLabel}</div>
          <RetPct v={peerSummaryStat} size="lg" />
        </div>
        <div className="bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-3">
          <div className="metric-label mb-1">피어그룹 내 순위</div>
          <span className="metric-value-primary text-slate-100">
            {rankInfo ? rankSuffix(rankInfo.rank, rankInfo.total) : "-"}
          </span>
        </div>
      </div>

      {/* 비교 표 */}
      <div className="bg-slate-900/70 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              {/* 그룹 헤더 (2단) */}
              <tr className="bg-slate-800/50 text-slate-500 text-[11px]">
                <th colSpan={2} className="text-center font-semibold py-1.5 border-b border-slate-700/60">기업 정보</th>
                <th colSpan={2} className="hidden sm:table-cell text-center font-semibold py-1.5 border-b border-slate-700/60">주가 현황</th>
                <th colSpan={2} className="text-center font-semibold py-1.5 border-b border-slate-700/60">주간 변동</th>
                <th className="text-center font-semibold py-1.5 border-b border-slate-700/60">기업 규모</th>
                <th className="hidden sm:table-cell border-b border-slate-700/60" />
              </tr>
              <tr className="text-slate-400 text-[12px] border-b border-slate-700">
                <th className="text-center font-semibold px-2 py-2.5 w-[52px]">구분</th>
                <th className="text-left font-semibold px-3 py-2.5 min-w-[128px]">기업명</th>
                <th className="hidden sm:table-cell text-right font-semibold px-3 py-2.5 w-[100px]">주초 종가</th>
                <th className="hidden sm:table-cell text-right font-semibold px-3 py-2.5 w-[100px]">주말 종가</th>
                <th className="hidden sm:table-cell text-right font-semibold px-3 py-2.5 w-[90px]">등락</th>
                <th className="text-right font-semibold px-3 py-2.5 w-[120px]">등락률</th>
                <th className="text-right font-semibold px-3 py-2.5 w-[140px]">시가총액</th>
                <th className="hidden sm:table-cell w-[36px]" />
              </tr>
            </thead>
            <tbody>
              {ordered.map((r, i) => {
                const isOwn = r.code === "462350";
                const isUs = r.category === "us";
                const isFirstUs = isUs && i > 0 && ordered[i - 1].category !== "us";
                const isOpen = expanded === r.code;
                const localCap = fmtLocalCap(r.marketCap, isUs);

                return (
                  <React.Fragment key={r.code}>
                    {isFirstUs && (
                      <tr>
                        <td colSpan={8} className="px-3 pt-3 pb-1 text-[11px] font-semibold text-slate-500 border-b border-slate-800/60">
                          해외 피어그룹
                        </td>
                      </tr>
                    )}
                    <tr
                      className={`border-b border-slate-800/50 transition-colors cursor-pointer ${
                        isOwn ? "bg-amber-400/10" : "hover:bg-slate-800/30"
                      }`}
                      style={{ height: 52 }}
                      onClick={() => setExpanded(isOpen ? null : r.code)}
                    >
                      <td className={`px-2 py-2 text-center ${isOwn ? "border-l-2 border-l-amber-400" : ""}`}>
                        <Badge label={isOwn ? "당사" : isUs ? "해외" : "국내"} tone={isOwn ? "own" : isUs ? "us" : "domestic"} />
                      </td>
                      <td className={`px-3 py-2 text-left whitespace-nowrap ${isOwn ? "text-amber-300 font-bold" : "text-slate-100 font-semibold"}`}>
                        {r.name}
                      </td>
                      <td className="hidden sm:table-cell px-3 py-2 text-right text-slate-400 tabular-nums" style={{ letterSpacing: "-0.02em" }}>
                        {fmtPrice(r.prevClose, isUs)}
                      </td>
                      <td className="hidden sm:table-cell px-3 py-2 text-right text-slate-100 tabular-nums" style={{ letterSpacing: "-0.02em" }}>
                        {fmtPrice(r.close, isUs)}
                      </td>
                      <td className="hidden sm:table-cell px-3 py-2 text-right text-slate-400 tabular-nums font-normal">
                        {r.close != null && r.prevClose != null
                          ? (r.close - r.prevClose >= 0 ? "+" : "") + fmtPrice(r.close - r.prevClose, isUs).replace(/^-/, "-")
                          : "-"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <RetPct v={r.ret1w} size="lg" />
                        <MiniBar v={r.ret1w} maxAbs={maxAbsRet} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="font-semibold text-slate-100 tabular-nums text-[13px]">{fmtMarketCapKrw(krwMarketCap(r))}</div>
                        {localCap && <div className="text-[11px] text-slate-500 mt-0.5">{localCap}</div>}
                      </td>
                      <td className="hidden sm:table-cell px-2 text-center">
                        <ChevronDown size={14} className={`text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-slate-950/40 border-b border-slate-800/50">
                        <td colSpan={8} className="px-6 py-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-[12px]">
                            <div><span className="text-slate-500">종목코드 </span><span className="text-slate-300 font-mono">{r.code}</span></div>
                            <div><span className="text-slate-500">거래소 </span><span className="text-slate-300">{isUs ? "NASDAQ" : "KOSDAQ"}</span></div>
                            <div><span className="text-slate-500">통화 </span><span className="text-slate-300">{isUs ? "USD" : "KRW"}</span></div>
                            <div><span className="text-slate-500">주간 최고/최저 </span><span className="text-slate-300 tabular-nums">{fmtPrice(r.weekHigh, isUs)} / {fmtPrice(r.weekLow, isUs)}</span></div>
                            <div><span className="text-slate-500">1개월 </span><RetPct v={r.ret1m} /></div>
                            <div><span className="text-slate-500">3개월 </span><RetPct v={r.ret3m} /></div>
                            <div><span className="text-slate-500">YTD </span><RetPct v={r.retYtd} /></div>
                            <div><span className="text-slate-500">상장주식수 </span><span className="text-slate-300 tabular-nums">{r.shares ? r.shares.toLocaleString("ko-KR") + "주" : "-"}</span></div>
                          </div>
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

      <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
        {hasUs && (
          <>
            ※ 해외 기업의 시가총액은 기준일 환율을 적용한 원화 환산 금액이며, 현지 통화 기준 금액을 함께 표기하였습니다.
            {fx ? ` 환율 적용 기준일: ${dotDate(fx.asOfDate)} (1달러 = ${Math.round(fx.usdToKrw).toLocaleString("ko-KR")}원)` : " (환율 조회 실패로 해외 시가총액 원화 환산이 표시되지 않을 수 있습니다)"}
            <br />
          </>
        )}
        * 해외 종목은 자체 수집 이력이 쌓이는 대로 1개월/3개월/YTD가 채워집니다. 신규 상장 종목은 상장 이전 기간의 값이 비어있을 수 있습니다.
      </p>
    </div>
  );
}
