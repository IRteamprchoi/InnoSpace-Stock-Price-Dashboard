"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import type { WeeklyPriceRow } from "@/lib/sheets";
import type { FxRate } from "@/lib/fx";

// 평균 대신 중앙값을 쓰고 싶으면 이 값만 바꾸면 됩니다
const SUMMARY_STAT: "avg" | "median" = "avg";

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
const PERIOD_COLOR = "#9FB0C7";

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
function dotDateWeekday(dateStr?: string) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  const wd = WEEKDAY_KO[new Date(dateStr + "T00:00:00+09:00").getDay()];
  return `${y}.${m}.${d}(${wd})`;
}
// "MM/DD(요일)" - 실제 종가 기준일 표시용 (예: 07/24(금))
function mmddWeekday(dateStr?: string) {
  if (!dateStr) return "-";
  const [, m, d] = dateStr.split("-");
  const wd = WEEKDAY_KO[new Date(dateStr + "T00:00:00+09:00").getDay()];
  return `${m}/${d}(${wd})`;
}

// 통화 기호를 숫자보다 작고 옅게, 숫자가 먼저 눈에 들어오도록 분리 렌더링
function PriceValue({ n, isUs }: { n: number | null; isUs: boolean }) {
  if (n == null) return <span className="text-slate-600">-</span>;
  const symbol = isUs ? "$" : "₩";
  const num = isUs
    ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(n).toLocaleString("ko-KR");
  return (
    <span className="tabular-nums text-[13.5px] font-bold text-slate-100">
      <span className="metric-unit mr-0.5 font-medium">{symbol}</span>
      {num}
    </span>
  );
}

function fmtPriceText(n: number | null, isUs: boolean) {
  if (n == null) return "-";
  if (isUs) return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

// 1조원 이상은 "0.0조원", 미만은 "0,000억원"
function fmtMarketCapKrw(krw: number | null) {
  if (krw == null) return "-";
  if (krw >= 1e12) return (krw / 1e12).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "조원";
  return Math.round(krw / 1e8).toLocaleString("ko-KR") + "억원";
}

function fmtLocalCap(n: number | null, isUs: boolean) {
  if (n == null || !isUs) return null;
  return "$" + (n / 1e6).toLocaleString("ko-KR", { maximumFractionDigits: 0 }) + "M";
}

function RetPct({ v, size = "base" }: { v: number | null; size?: "base" | "sm" | "lg" | "xl" }) {
  if (v == null) return <span className="text-slate-600">-</span>;
  const up = v > 0;
  const flat = v === 0;
  const color = flat ? "text-slate-400" : up ? "text-red-400" : "text-blue-400";
  const arrow = flat ? "―" : up ? "▲" : "▼";
  const sizeClass =
    size === "xl" ? "text-[22px] sm:text-[26px] font-extrabold" :
    size === "lg" ? "text-[16px] sm:text-[17px] font-extrabold" :
    size === "sm" ? "text-[12.5px] font-semibold" :
    "text-[14px] font-bold";
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${sizeClass} ${color}`}>
      <span>{arrow}</span>
      {Math.abs(v).toFixed(2)}%
    </span>
  );
}

function MiniBar({ v, maxAbs }: { v: number | null; maxAbs: number }) {
  if (v == null || maxAbs === 0) return null;
  const up = v >= 0;
  const widthPct = Math.min((Math.abs(v) / maxAbs) * 50, 50);
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
  const cls = tone === "own" ? "bg-amber-400/15 text-amber-300" : "bg-slate-800 text-slate-300";
  return (
    <span className={`inline-block whitespace-nowrap text-[11px] font-semibold px-2 py-0.5 rounded ${cls}`}>
      {label}
    </span>
  );
}

// 데스크톱 권장 열 너비
const COL_W = {
  badge: "70px",
  name: "200px",
  price: "120px",
  ret: "115px",
  mid: "105px",
  cap: "135px",
  chevron: "40px",
};

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

  // 이노스페이스 -> 해외 피어그룹 -> 국내 피어그룹 순 (발사체 기업 특성상 해외 비교가 더 중요)
  const ordered = innospace ? [innospace, ...usPeers, ...domesticPeers] : [...usPeers, ...domesticPeers];

  const refFriday = rows[0]?.refFriday || "";
  const weekStart = refFriday ? addDaysStr(refFriday, -4) : "";
  const startLabel = mmddWeekday(weekStart);
  const endLabel = mmddWeekday(refFriday);

  const maxAbsRet = useMemo(
    () => Math.max(0.01, ...ordered.map((r) => Math.abs(r.ret1w ?? 0))),
    [ordered]
  );

  const krwMarketCap = (r: WeeklyPriceRow) => {
    if (r.marketCap == null) return null;
    if (r.category === "us") return fx ? r.marketCap * fx.usdToKrw : null;
    return r.marketCap;
  };

  // --- 상단 요약 카드 계산 (이노스페이스 포함 전체 비교대상 기준) ---
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

  const domesticRets = domesticPeers.map((r) => r.ret1w).filter((v): v is number => v != null);
  const domesticAvg = domesticRets.length ? domesticRets.reduce((a, b) => a + b, 0) / domesticRets.length : null;
  const usRets = usPeers.map((r) => r.ret1w).filter((v): v is number => v != null);
  const usAvg = usRets.length ? usRets.reduce((a, b) => a + b, 0) / usRets.length : null;
  const upCount = peerRets.filter((v) => v > 0).length;
  const downCount = peerRets.filter((v) => v < 0).length;
  const flatCount = peerRets.filter((v) => v === 0).length;

  const rankInfo = useMemo(() => {
    if (!innospace) return null;
    const sorted = [...ordered].sort((a, b) => (b.ret1w ?? -999) - (a.ret1w ?? -999));
    const idx = sorted.findIndex((r) => r.code === "462350");
    return idx === -1 ? null : { rank: idx + 1, total: sorted.length };
  }, [ordered, innospace]);

  // 종목별 주간 등락률 순위 / 시가총액 순위 (펼침영역에서 사용)
  const retRankMap = useMemo(() => {
    const sorted = [...ordered].sort((a, b) => (b.ret1w ?? -999) - (a.ret1w ?? -999));
    const map = new Map<string, number>();
    sorted.forEach((r, i) => map.set(r.code, i + 1));
    return map;
  }, [ordered]);

  const capRankMap = useMemo(() => {
    const withCap = ordered.map((r) => ({ code: r.code, cap: krwMarketCap(r) ?? -1 }));
    const sorted = [...withCap].sort((a, b) => b.cap - a.cap);
    const map = new Map<string, number>();
    sorted.forEach((r, i) => map.set(r.code, i + 1));
    return map;
  }, [ordered, fx]);

  // 피어그룹 주간 성과 범위 (당사 포함 전체 분포 기준)
  const distStats = useMemo(() => {
    const withRet = ordered.filter((r) => r.ret1w != null);
    if (!withRet.length) return null;
    const best = withRet.reduce((a, b) => (b.ret1w! > a.ret1w! ? b : a));
    const worst = withRet.reduce((a, b) => (b.ret1w! < a.ret1w! ? b : a));
    const sorted = [...withRet].sort((a, b) => a.ret1w! - b.ret1w!);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid].ret1w! : (sorted[mid - 1].ret1w! + sorted[mid].ret1w!) / 2;
    return { best, worst, median };
  }, [ordered]);

  const hasUs = usPeers.length > 0;

  return (
    <div>
      {/* 표 제목 */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-1">
          <span className="w-1 h-4 bg-amber-400 rounded-sm shrink-0" />
          <h2 className="section-title">이노스페이스 및 피어그룹 주간 주가 동향</h2>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-3">
          <p className="text-[13px] text-slate-500">주간 종가 변동 및 시가총액 비교</p>
          <p className="text-[13px] sm:text-[14px] font-medium" style={{ color: PERIOD_COLOR }}>
            <span className="font-semibold">기준기간</span> {dotDateWeekday(weekStart)} ~ {dotDateWeekday(refFriday)}
          </p>
        </div>
      </div>

      {/* 상단 요약 카드 3개 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-slate-900/70 border border-slate-700 rounded-lg px-4 sm:px-5 py-3.5">
          <div className="text-[15px] sm:text-[16px] font-bold text-slate-200 mb-1.5">이노스페이스 주간 등락률</div>
          <div className="grid grid-cols-2 gap-3">
            <RetPct v={innospace?.ret1w ?? null} size="xl" />
            <div className="flex flex-col justify-center gap-1 pl-3 border-l border-slate-800 text-[11px] sm:text-[12px] font-medium" style={{ color: "#8495AD" }}>
              {innospace?.ret1w != null && peerSummaryStat != null && (
                <span>평균 대비 {(innospace.ret1w - peerSummaryStat >= 0 ? "+" : "")}{(innospace.ret1w - peerSummaryStat).toFixed(2)}%p</span>
              )}
              {rankInfo && <span>{rankInfo.total}개사 중 {rankInfo.rank}위</span>}
              {innospace?.ret1m != null && (
                <span className="inline-flex items-center gap-1">1개월 <RetPct v={innospace.ret1m} /></span>
              )}
            </div>
          </div>
        </div>
        <div className="bg-slate-900/70 border border-slate-700 rounded-lg px-4 sm:px-5 py-3.5">
          <div className="text-[15px] sm:text-[16px] font-bold text-slate-200 mb-1.5">{peerSummaryLabel}</div>
          <div className="grid grid-cols-2 gap-3">
            <RetPct v={peerSummaryStat} size="xl" />
            <div className="flex flex-col justify-center gap-1 pl-3 border-l border-slate-800 text-[11px] sm:text-[12px] font-medium" style={{ color: "#8495AD" }}>
              <span className="inline-flex items-center gap-1">해외 평균 <RetPct v={usAvg} /></span>
              <span className="inline-flex items-center gap-1">국내 평균 <RetPct v={domesticAvg} /></span>
              <span>상승 <span className="text-red-400 font-semibold">{upCount}</span> · 하락 <span className="text-blue-400 font-semibold">{downCount}개사</span></span>
            </div>
          </div>
        </div>
        <div className="bg-slate-900/70 border border-slate-700 rounded-lg px-4 sm:px-5 py-3.5">
          <div className="text-[15px] sm:text-[16px] font-bold text-slate-200 mb-1.5">피어그룹 주간 등락 요약</div>
          {distStats ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 min-w-0">
                  <span className="inline-block whitespace-nowrap text-[11px] font-bold px-2 py-0.5 rounded bg-red-400/15 text-red-300">최고 상승</span>
                  <span className="text-[14px] sm:text-[15px] font-semibold text-slate-200 truncate">{distStats.best.name}</span>
                </span>
                <RetPct v={distStats.best.ret1w} size="lg" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 min-w-0">
                  <span className="inline-block whitespace-nowrap text-[11px] font-bold px-2 py-0.5 rounded bg-blue-400/15 text-blue-300">최대 하락</span>
                  <span className="text-[14px] sm:text-[15px] font-semibold text-slate-200 truncate">{distStats.worst.name}</span>
                </span>
                <RetPct v={distStats.worst.ret1w} size="lg" />
              </div>
              <div className="text-[11px] sm:text-[12px] font-medium pt-1 border-t border-slate-800" style={{ color: "#8495AD" }}>
                상승 {upCount}개사 · 하락 {downCount}개사{flatCount > 0 ? ` · 보합 ${flatCount}개사` : ""}
              </div>
            </div>
          ) : (
            <span className="text-slate-600 text-[13px]">-</span>
          )}
        </div>
      </div>

      {/* 클릭 안내 바 */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 mb-2">
        <Info size={13} style={{ color: PERIOD_COLOR }} />
        <span className="text-[13px] font-medium" style={{ color: PERIOD_COLOR }}>
          각 기업 행을 클릭하면 기간별 수익률, 주간 거래량 및 피어그룹 내 주간 등락률 순위를 확인할 수 있습니다.
        </span>
      </div>

      {/* 비교 표 */}
      <div className="bg-slate-900/70 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <colgroup>
              <col style={{ width: COL_W.badge }} />
              <col style={{ width: COL_W.name }} />
              <col style={{ width: COL_W.price }} />
              <col style={{ width: COL_W.price }} />
              <col style={{ width: COL_W.ret }} />
              <col style={{ width: COL_W.mid }} />
              <col style={{ width: COL_W.mid }} />
              <col style={{ width: COL_W.cap }} />
              <col style={{ width: COL_W.chevron }} />
            </colgroup>
            <thead className="sticky top-0 z-20 bg-slate-900">
              <tr className="text-slate-400 text-[12px] border-b border-slate-700">
                <th className="text-center font-semibold px-2 py-2.5">구분</th>
                <th className="text-left font-semibold pl-3 pr-2 py-2.5">기업명</th>
                <th className="hidden sm:table-cell text-right font-semibold px-2 py-2.5 whitespace-nowrap">{startLabel} 종가</th>
                <th className="text-right font-semibold px-2 py-2.5 whitespace-nowrap">{endLabel} 종가</th>
                <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">주간 등락률</th>
                <th className="hidden sm:table-cell text-right font-semibold px-2 py-2.5 whitespace-nowrap">주간 최고</th>
                <th className="text-right font-semibold px-2 py-2.5 whitespace-nowrap">주간 최저</th>
                <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">시가총액</th>
                <th className="w-[40px]" />
              </tr>
            </thead>
            <tbody>
              {ordered.map((r, i) => {
                const isOwn = r.code === "462350";
                const isUs = r.category === "us";
                const isFirstUs = isUs && !(i > 0 && ordered[i - 1].category === "us");
                const isFirstDomestic = !isUs && !isOwn && !(i > 0 && ordered[i - 1].category === "domestic" && ordered[i - 1].code !== "462350");
                const isOpen = expanded === r.code;
                const localCap = fmtLocalCap(r.marketCap, isUs);

                return (
                  <React.Fragment key={r.code}>
                    {isFirstUs && (
                      <tr>
                        <td colSpan={9} className="px-3 py-1.5 text-[12px] font-semibold text-slate-400 bg-slate-800/40 border-b border-slate-800/60" style={{ height: 32 }}>
                          해외 피어그룹
                        </td>
                      </tr>
                    )}
                    {isFirstDomestic && (
                      <tr>
                        <td colSpan={9} className="px-3 py-1.5 text-[12px] font-semibold text-slate-400 bg-slate-800/40 border-b border-slate-800/60" style={{ height: 32 }}>
                          국내 피어그룹
                        </td>
                      </tr>
                    )}
                    <tr
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                      style={{ height: 54 }}
                      onClick={() => setExpanded(isOpen ? null : r.code)}
                    >
                      <td className="px-2 py-2 text-center">
                        <Badge label={isOwn ? "당사" : isUs ? "해외" : "국내"} tone={isOwn ? "own" : isUs ? "us" : "domestic"} />
                      </td>
                      <td className="pl-3 pr-2 py-2 text-left" title={r.name}>
                        <span className={`inline-flex items-center gap-1.5 max-w-full ${isOwn ? "font-bold text-slate-50" : "font-semibold text-slate-100"}`}>
                          {isOwn && <span className="w-0.5 h-3.5 bg-amber-400 rounded-sm shrink-0" />}
                          <span className="truncate">{r.name}</span>
                        </span>
                      </td>
                      <td className="hidden sm:table-cell px-2 py-2 text-right text-slate-400">
                        <PriceValue n={r.prevClose} isUs={isUs} />
                      </td>
                      <td className="px-2 py-2 text-right text-slate-100">
                        <PriceValue n={r.close} isUs={isUs} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <RetPct v={r.ret1w} size="lg" />
                      </td>
                      <td className="hidden sm:table-cell px-2 py-2 text-right text-slate-400">
                        <PriceValue n={r.weekHigh} isUs={isUs} />
                      </td>
                      <td className="px-2 py-2 text-right text-slate-400">
                        <PriceValue n={r.weekLow} isUs={isUs} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="font-bold text-slate-100 tabular-nums text-[13.5px]">{fmtMarketCapKrw(krwMarketCap(r))}</div>
                        {localCap && <div className="text-[11px] font-medium text-slate-500 mt-0.5">{localCap}</div>}
                      </td>
                      <td className="px-2 text-center">
                        <ChevronDown size={15} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-slate-950/40 border-b border-slate-800/50">
                        <td colSpan={9} className="px-6 py-3">
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-6 gap-y-2 text-[12px]">
                            <div className="sm:hidden"><span className="text-slate-500">구분 </span><span className="text-slate-300">{isOwn ? "당사" : isUs ? "해외" : "국내"}</span></div>
                            <div className="sm:hidden"><span className="text-slate-500">{startLabel} 종가 </span><span className="text-slate-300 tabular-nums">{fmtPriceText(r.prevClose, isUs)}</span></div>
                            <div><span className="text-slate-500">1개월 </span><RetPct v={r.ret1m} /></div>
                            <div><span className="text-slate-500">3개월 </span><RetPct v={r.ret3m} /></div>
                            <div><span className="text-slate-500">YTD </span><RetPct v={r.retYtd} /></div>
                            <div><span className="text-slate-500">1주일간 거래량 </span><span className="text-slate-300 tabular-nums">{r.weekVolume != null ? r.weekVolume.toLocaleString("ko-KR") + "주" : "-"}</span></div>
                            <div><span className="text-slate-500">등락률 순위 </span><span className="text-slate-300 tabular-nums">{retRankMap.get(r.code)}위 / {ordered.length}개사</span></div>
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
