"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  ComposedChart,
  Area,
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
  DomesticDailyRow,
  WeeklyChartPoint,
  UsStockHistoryRow,
  DailyRow,
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
  domesticDailyRows: DomesticDailyRow[];
  chartRows: WeeklyChartPoint[];
  usHistoryRows: UsStockHistoryRow[];
  dailyRows: DailyRow[];
  availableMonths: string[];
};

export default function MonthlyDashboard({
  month,
  indexRows,
  marketNewsRows,
  priceRows,
  companyNewsRows,
  investorFlowRows,
  domesticDailyRows,
  chartRows,
  usHistoryRows,
  dailyRows,
  availableMonths,
}: MonthlyDashboardProps) {
  const monthLabel = `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`;
  const isCurrentMonth = month === new Date().toISOString().slice(0, 7);
  const [newsFilter, setNewsFilter] = useState<"전체" | "이노스페이스" | "해외 피어그룹" | "국내 피어그룹">("전체");

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
        const weeklySnap = buildSnapshot(priceRows, c.name, month);
        const isUsCompany = c.group === "us";
        const dailyPoints = weeklySnap
          ? buildCompanyDailyPoints(chartRows, usHistoryRows, c.name, weeklySnap.code, isUsCompany, month)
          : [];
        // 실제 일별 데이터가 있으면 그걸로 월초/월말/최고/최저/등락률을 다시 계산 (더 정확함).
        // 주간 리포트 스냅샷은 marketCap/shares/거래량 등 일별 데이터에 없는 값만 보완적으로 사용.
        let snap =
          weeklySnap && dailyPoints.length >= 2
            ? {
                ...weeklySnap,
                openClose: dailyPoints[0].value,
                closeClose: dailyPoints[dailyPoints.length - 1].value,
                changePct:
                  dailyPoints[0].value !== 0
                    ? ((dailyPoints[dailyPoints.length - 1].value - dailyPoints[0].value) / dailyPoints[0].value) * 100
                    : null,
                monthHigh: Math.max(...dailyPoints.map((p) => p.value)),
                monthLow: Math.min(...dailyPoints.map((p) => p.value)),
              }
            : weeklySnap;

        // 발행주식수/시가총액 정확화:
        // 주간 리포트의 "월초" 행은 그 주의 금요일 값을 담고 있어 실제 월요일(월초)과 다를 수 있다.
        // 월 시작 이전의 마지막 주간 리포트가 실제 월초 발행주식수에 훨씬 더 가깝다(검증 완료).
        // 일간·주간 원본 데이터는 읽기만 하며 수정하지 않는다.
        if (snap) {
          const allRowsForCompany = priceRows
            .filter((r) => r.name === c.name)
            .sort((a, b) => a.refFriday.localeCompare(b.refFriday));
          const preMonthRow = [...allRowsForCompany]
            .filter((r) => r.refFriday < `${month}-01`)
            .pop();
          const inMonthRows = allRowsForCompany.filter((r) => r.refFriday.startsWith(month));
          const openSharesRow = preMonthRow ?? inMonthRows[0];
          const closeSharesRow = inMonthRows[inMonthRows.length - 1];

          // 당사(이노스페이스)는 daily_data(일간 페이지 원본, 읽기 전용)에 그날그날의 정확한
          // 시가총액이 있다. 시가총액 = 그날 상장주식수 × 그날 종가로 KIS가 이미 계산해 준 값이므로,          // 국내(당사·피어) 공통: domestic_daily_data(매일 KIS lstn_stcn 직접 수집, 신규)가 있으면
          // weekly_prices(주간 스냅샷 - 월초를 "이번 달 첫 금요일"로 오인하던 문제 있었음)보다 우선 사용한다.
          if (!isUsCompany && weeklySnap?.code) {
            const monthDomesticRows = domesticDailyRows
              .filter((r) => r.code === weeklySnap.code && r.date.startsWith(month) && r.shares != null)
              .sort((a, b) => a.date.localeCompare(b.date));
            if (monthDomesticRows.length > 0) {
              const firstD = monthDomesticRows[0];
              const lastD = monthDomesticRows[monthDomesticRows.length - 1];
              const openMcap3 = snap.openClose != null && firstD.shares != null ? snap.openClose * firstD.shares : null;
              const closeMcap3 = snap.closeClose != null && lastD.shares != null ? snap.closeClose * lastD.shares : null;
              snap = {
                ...snap,
                shares: lastD.shares ?? snap.shares,
                openMarketCap: openMcap3 ?? snap.openMarketCap,
                closeMarketCap: closeMcap3 ?? snap.closeMarketCap,
                marketCapChange:
                  openMcap3 != null && closeMcap3 != null ? closeMcap3 - openMcap3 : snap.marketCapChange,
              };
            }
          }

          // 국내(당사·피어) 공통: weekly_chart_data에 실제 일별 거래량이 있으면(신규 수집분)
          // 겹치는 주간 리포트를 재합산하는 대신 일별 거래량을 직접 합산한다(중복·재합산 방지).
          if (!isUsCompany && weeklySnap?.code) {
            const monthChartRows = chartRows.filter(
              (r) => r.code === weeklySnap.code && r.date.startsWith(month) && r.volume != null
            );
            if (monthChartRows.length > 0) {
              const seen = new Map<string, number>();
              monthChartRows.forEach((r) => seen.set(r.date, r.volume as number));
              const sumVol = Array.from(seen.values()).reduce((s, v) => s + v, 0);
              snap = { ...snap, monthVolume: sumVol };
            }
          }

          // 역으로 나누면 근사치가 아니라 그날 KIS가 실제로 사용한 정확한 상장주식수가 나온다.
          // (국내 피어그룹은 이런 일별 소스가 없어 주간 리포트 스냅샷을 계속 사용한다.)
          if (c.group === "self" && dailyPoints.length >= 2) {
            const openDate = dailyPoints[0].date;
            const closeDate = dailyPoints[dailyPoints.length - 1].date;
            const openDailyRow = dailyRows.find((r) => r.d === openDate);
            const closeDailyRow = dailyRows.find((r) => r.d === closeDate);
            if (openDailyRow?.shares != null && closeDailyRow?.shares != null) {
              const openMcap2 = snap.openClose != null ? snap.openClose * openDailyRow.shares : null;
              const closeMcap2 = snap.closeClose != null ? snap.closeClose * closeDailyRow.shares : null;
              snap = {
                ...snap,
                shares: closeDailyRow.shares,
                sharesOpen: openDailyRow.shares,
                sharesDataInsufficient: false,
                openMarketCap: openMcap2 ?? snap.openMarketCap,
                closeMarketCap: closeMcap2 ?? snap.closeMarketCap,
                marketCapChange:
                  openMcap2 != null && closeMcap2 != null ? closeMcap2 - openMcap2 : snap.marketCapChange,
              };
            } else {
              snap = { ...snap, sharesOpen: null, sharesDataInsufficient: true };
            }
} else if (
            openSharesRow?.shares != null &&
            closeSharesRow?.shares != null &&
            snap.openClose != null &&
            snap.closeClose != null
          ) {
            const isUsCompany2 = c.group === "us";
            const openMcap =
              isUsCompany2 && openSharesRow.fxRate != null
                ? snap.openClose * openSharesRow.shares * openSharesRow.fxRate
                : snap.openClose * openSharesRow.shares;
            const closeMcap =
              isUsCompany2 && closeSharesRow.fxRate != null
                ? snap.closeClose * closeSharesRow.shares * closeSharesRow.fxRate
                : snap.closeClose * closeSharesRow.shares;
            snap = {
              ...snap,
              shares: closeSharesRow.shares,
              openMarketCap: openMcap,
              closeMarketCap: closeMcap,
              marketCapChange: closeMcap - openMcap,
            };
          }

          // 당사(이노스페이스)는 daily_data(일간 페이지 원본)에 실제 일별 거래량이 있으므로
          // 주간 리포트 누적치 대신 일별 거래량을 직접 합산한다(중복·재합산 방지).
          if (c.group === "self") {
            const monthDailyRows = dailyRows.filter((r) => r.d && r.d.startsWith(month));
            if (monthDailyRows.length > 0) {
              const sumVol = monthDailyRows.reduce((s, r) => s + (r.vol ?? 0), 0);
              snap = { ...snap, monthVolume: sumVol };
            }
          }
        }
        const flow =
          c.group === "self"
            ? buildInnospaceFlowFromDaily(dailyRows, month)
            : c.group !== "us" && snap?.code
            ? buildFlowSummary(investorFlowRows, snap.code, month)
            : null;
        return { ...c, snap, flow };
      }),
    [priceRows, investorFlowRows, chartRows, usHistoryRows, dailyRows, month]
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

  // ---- 경영진 요약: A) 상대수익률 / B) 피어그룹 내 위치 / C) 기업가치 변화 / D) 수급·유동성 ----
  const kosdaqChangePct = useMemo(() => {
    if (kosdaqRows.length < 2) return null;
    const first = kosdaqRows[0].close;
    const last = kosdaqRows[kosdaqRows.length - 1].close;
    return first ? ((last - first) / first) * 100 : null;
  }, [kosdaqRows]);

  const selfChangePct = selfRow?.snap?.changePct ?? null;
  const excessVsKosdaq =
    selfChangePct != null && kosdaqChangePct != null ? selfChangePct - kosdaqChangePct : null;
  const excessVsPeerAvg = selfChangePct != null && peerAvg != null ? selfChangePct - peerAvg : null;

  const upCount = peerReturns.filter((p) => p.pct > 0).length;
  const downCount = peerReturns.filter((p) => p.pct < 0).length;
  const topPerformer = rankSorted[0];
  const gapToTop =
    topPerformer && selfChangePct != null && topPerformer.name !== "이노스페이스"
      ? topPerformer.pct - selfChangePct
      : 0;

  // 발행주식수 월초 대비 정확한 증감 수량
  const sharesDiff = (() => {
    // daily_data의 일별 상장주식수(shares, KIS lstn_stcn 1주 단위)만 신뢰한다.
    // weekly_prices(매주 금요일 스냅샷)는 실제 월초(첫 거래일)를 담지 못해
    // "이번 달 첫 금요일"을 월초로 오인하는 오류가 있었으므로 더 이상 사용하지 않는다.
    const rows = dailyRows
      .filter((r) => r.d.startsWith(month) && r.shares != null)
      .sort((a, b) => a.d.localeCompare(b.d));
    if (rows.length < 2) return null;
    const first = rows[0].shares as number;
    const last = rows[rows.length - 1].shares as number;
    return last - first;
  })();

  // 시가총액 기준 순위 (해외기업도 동일 기준일 환율로 원화 환산된 closeMarketCap 사용)
  const capRankSorted = tableRows
    .filter((r) => r.snap?.closeMarketCap != null)
    .sort((a, b) => (b.snap!.closeMarketCap as number) - (a.snap!.closeMarketCap as number));
  const selfCapRank = capRankSorted.findIndex((r) => r.name === "이노스페이스") + 1;
  const marketCapPctChange =
    selfRow?.snap?.openMarketCap != null &&
    selfRow.snap.openMarketCap !== 0 &&
    selfRow?.snap?.marketCapChange != null
      ? (selfRow.snap.marketCapChange / selfRow.snap.openMarketCap) * 100
      : null;

  const selfFlowD = selfRow?.flow;
  const flowEntries = selfFlowD
    ? [
        { label: "개인", value: selfFlowD.individual },
        { label: "외국인", value: selfFlowD.foreign },
        { label: "기관", value: selfFlowD.institution },
        { label: "기타", value: selfFlowD.otherTotal },
      ]
    : [];
  const biggestBuyer = flowEntries.length
    ? [...flowEntries].sort((a, b) => b.value - a.value)[0]
    : null;
  const biggestSeller = flowEntries.length
    ? [...flowEntries].sort((a, b) => a.value - b.value)[0]
    : null;
  const avgDailyVolume =
    selfRow?.snap?.monthVolume != null
      ? Math.round(selfRow.snap.monthVolume / Math.max(selfRow.snap.weeksCount * 5, 1))
      : null;
  const turnoverPct =
    selfRow?.snap?.monthVolume != null && selfRow?.snap?.shares
      ? (selfRow.snap.monthVolume / selfRow.snap.shares) * 100
      : null;

  const execSummaryLines = (() => {
    if (excessVsKosdaq == null || !selfRank) return null;
    const flowNote =
      flowEntries.length > 0
        ? flowEntries
            .map((f) => `${f.label}${(((f.label.charCodeAt(f.label.length-1)-0xAC00)%28===0)?"는":"은")} ${f.value > 0 ? "순매수" : f.value < 0 ? "순매도" : "보합"}`)
            .join(", ")
        : "";
    const line1 = `당사는 코스닥 대비 ${excessVsKosdaq >= 0 ? "+" : ""}${excessVsKosdaq.toFixed(
      1
    )}%p의 초과수익률을 기록했으며, 주가 상승폭 기준 피어그룹 ${rankSorted.length}개사 중 ${selfRank}위, 시가총액 기준 ${selfCapRank}위를 기록했습니다.`;
    const line2 = flowNote ? `${flowNote}를 보였습니다.` : null;
    return { line1, line2 };
  })();



    // 주차별 시장 시황: 제목만으로 이해 가능한 기사만 선별하고, 주차당 최대 2건(국내1+미국1)만 남긴다.
  // 주차 계산: 해당 월의 첫 영업일(월~금)이 포함된 일요일~토요일 구간을 1주차로 정의.
// 순수 캘린더 날짜 문자열 연산만 사용해 Asia/Seoul 기준 날짜가 UTC 변환으로 밀리지 않게 한다.
function getKoreanWeekNumber(dateStr: string, month: string): number | null {
  if (!dateStr) return null;
  // pubDate는 RSS 원본 형식(예: "Fri, 07 Aug 2026 02:35:00 GMT")일 수 있어
  // Date 파싱 후 KST(UTC+9)로 명시적으로 환산해 캘린더 날짜를 구한다(UTC 변환으로 날짜가 밀리지 않도록).
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  const kstTime = parsed.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstTime);
  const [y, m] = month.split("-").map(Number);
  let firstBizTime = Date.UTC(y, m - 1, 1);
  let dow = new Date(firstBizTime).getUTCDay();
  while (dow === 0 || dow === 6) {
    firstBizTime += 86400000;
    dow = new Date(firstBizTime).getUTCDay();
  }
  const weekStartSundayTime = firstBizTime - dow * 86400000;
  const targetTime = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
  const diffDays = Math.floor((targetTime - weekStartSundayTime) / 86400000);
  const result = Math.floor(diffDays / 7) + 1;
  return Number.isFinite(result) ? result : null;
}
const marketWeeklyGroups = useMemo(() => {
    const isGenericTitle = (title: string) =>
      /^\[오늘의증시\]|오늘의\s*코스피|오늘의\s*증시|^\d[\d.,\s]*$/.test(title.trim());
    const monthRows = marketNewsRows.filter((r) => r.reportDate.startsWith(month) && !isGenericTitle(r.title));
    const deduped = dedupeByLink(monthRows);

    const byWeek = new Map<number, typeof deduped>();
    deduped.forEach((r) => {
      const weekNum = getKoreanWeekNumber(r.pubDate, month);
      if (weekNum == null) return;
      byWeek.set(weekNum, [...(byWeek.get(weekNum) ?? []), r]);
    });

    return Array.from(byWeek.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekNum, items]) => {
        const kr = items.find((r) => r.market === "KR");
        const us = items.find((r) => r.market === "US");
        const picked = [kr, us].filter((x): x is NonNullable<typeof x> => !!x);
        return { weekNum, items: picked };
      })
      .filter((g) => g.items.length > 0);
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

  // 기업별 뉴스: 그 달의 주간 리포트에 실렸던 기사를 모아 중복 제거 + 중요도순 선별 (최대 4건)
  const companyArticleGroups = useMemo(
    () =>
      COMPANY_ORDER.map((c) => ({
        name: c.name,
        group: c.group,
        articles: selectTopArticles(newsInMonth(companyNewsRows, month).filter((r) => r.name === c.name)),
      })),
    [companyNewsRows, month]
  );

  // 시장별 기준일이 다를 수 있으므로 억지로 통일하지 않고 각각 명확히 표시
  const latestDomesticDate = kospiRows.length ? kospiRows[kospiRows.length - 1].date : null;
  const latestUsDate = useMemo(() => {
    const dates = usHistoryRows.filter((r) => r.date.startsWith(month)).map((r) => r.date);
    return dates.length ? dates.sort().reverse()[0] : null;
  }, [usHistoryRows, month]);

  // 국내/미국 각 시장의 월초·월말 실제 거래일 (데이터 날짜 기준, 시장별 독립 계산)
  const domesticDates = useMemo(
    () =>
      Array.from(
        new Set(
          chartRows
            .filter((r) => /^\d/.test(String(r.code)) && r.date && r.date.startsWith(month))
            .map((r) => r.date)
        )
      ).sort(),
    [chartRows, month]
  );
  const usDates = useMemo(
    () => usHistoryRows.map((r) => r.date).filter((d) => d.startsWith(month)).sort(),
    [usHistoryRows, month]
  );
  const domesticStartDate = domesticDates.length ? domesticDates[0] : null;
  const domesticEndDate = domesticDates.length ? domesticDates[domesticDates.length - 1] : null;
  const usStartDate = usDates.length ? usDates[0] : null;
  const usEndDate = usDates.length ? usDates[usDates.length - 1] : null;

  const latestFx = tableRows
    .filter((r) => r.group === "us" && r.snap?.fxRate != null)
    .map((r) => r.snap!)
    .sort((a, b) => (b.fxDate ?? "").localeCompare(a.fxDate ?? ""))[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-slate-400">
          {monthLabel}
          {isCurrentMonth && (
            <span className="ml-2 text-[11px] px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 align-middle">
              진행 중 · 최신 거래일 기준
            </span>
          )}
          <span className="ml-2 text-[11px] text-slate-500 inline-flex flex-col gap-0.5 align-top">
            <span>
              국내 월초 기준일 {domesticStartDate ?? "-"} · 월말 기준일 {domesticEndDate ?? "-"}
            </span>
            <span>
              미국 월초 기준일 {usStartDate ?? "-"} · 월말 기준일 {usEndDate ?? "-"}
            </span>
          </span>
        </p>
        <MonthSelector month={month} availableMonths={availableMonths} />
      </div>

      {/* B. 경영진 요약: 상대수익률 / 피어그룹 위치 / 기업가치 / 수급·유동성 */}
      <section className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <SummaryPanel title="월초 대비 주가 등락률">
            <div className="flex items-center justify-between gap-3">
              <p className={`text-xl font-semibold tabular-nums ${toneColor(toneOf(selfChangePct))}`}>
                당사 {pctText(selfChangePct)}
              </p>
              <div className="space-y-0.5 text-right">
                <p className="text-[11px] text-slate-400 whitespace-nowrap">
                  코스닥 대비 <span className="tabular-nums">{pctPointText(excessVsKosdaq)}</span>
                </p>
                <p className="text-[11px] text-slate-400 whitespace-nowrap">
                  피어그룹 평균 대비 <span className="tabular-nums">{pctPointText(excessVsPeerAvg)}</span>
                </p>
              </div>
            </div>
          </SummaryPanel>

          <SummaryPanel title="피어그룹 내 순위">
            <div className="space-y-1">
              <p className="text-[13px] text-slate-200">
                주가 상승폭 순위{" "}
                <span className="text-[15px] font-semibold tabular-nums text-slate-100">
                  {selfRank || "-"}위 / {rankSorted.length}개사
                </span>
              </p>
              <p className="text-[13px] text-slate-200">
                월말 시가총액 순위{" "}
                <span className="text-[15px] font-semibold tabular-nums text-slate-100">
                  {selfCapRank || "-"}위 / {capRankSorted.length}개사
                </span>
              </p>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              상승 {upCount}개사 · 하락 {downCount}개사
            </p>
          </SummaryPanel>

          <SummaryPanel title="시가총액 변화">
            <p className="text-[13px] text-slate-200 tabular-nums whitespace-nowrap">
              {fmtMarketCapKrw(selfRow?.snap?.openMarketCap ?? null)} →{" "}
              {fmtMarketCapKrw(selfRow?.snap?.closeMarketCap ?? null)}
            </p>
            <p className={`text-[14px] font-semibold tabular-nums mt-0.5 ${toneColor(toneOf(selfRow?.snap?.marketCapChange ?? null))}`}>
              {selfRow?.snap?.marketCapChange != null
                ? `${selfRow.snap.marketCapChange >= 0 ? "+" : "-"}${fmtMarketCapKrw(
                    Math.abs(selfRow.snap.marketCapChange)
                  )} ${selfRow.snap.marketCapChange >= 0 ? "증가" : "감소"}`
                : "-"}
              {marketCapPctChange != null && (
                <span className="text-[11px] font-normal ml-1">
                  ({marketCapPctChange >= 0 ? "+" : ""}
                  {marketCapPctChange.toFixed(2)}%)
                </span>
              )}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {sharesDiff == null
                ? "발행주식수 데이터 없음"
                : sharesDiff === 0
                ? "발행주식수 변동 없음"
                : `발행주식수 월초 대비 ${sharesDiff > 0 ? "+" : ""}${sharesDiff.toLocaleString("ko-KR")}주`}
            </p>
          </SummaryPanel>

          <SummaryPanel title="수급 및 유동성">
            {flowEntries.length === 0 ? (
              <p className="text-[13px] text-slate-500">데이터 집계 중</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                <div>
                  <p className="text-[10px] text-slate-300 font-semibold">최대 순매수</p>
                  <p className="text-[13px] font-medium text-red-400 tabular-nums">
                    {biggestBuyer?.label} {fmtFlow(biggestBuyer?.value)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-300 font-semibold">최대 순매도</p>
                  <p className="text-[13px] font-medium text-blue-400 tabular-nums">
                    {biggestSeller?.label} {fmtFlow(biggestSeller?.value)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-300 font-semibold">월간 총거래량</p>
                  <p className="text-[13px] font-semibold text-slate-100 tabular-nums">
                    {fmtVolume(selfRow?.snap?.monthVolume ?? null)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-300 font-semibold">일평균 거래량</p>
                  <p className="text-[13px] font-semibold text-slate-100 tabular-nums">
                    {avgDailyVolume != null ? avgDailyVolume.toLocaleString("ko-KR") + "주" : "-"}
                  </p>
                </div>
              </div>
            )}
          </SummaryPanel>
        </div>
        {execSummaryLines && (
          <div
            className="text-[12px] text-slate-400 bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-2 space-y-0.5"
            style={{ wordBreak: "keep-all", overflowWrap: "break-word" }}
          >
            <p>{execSummaryLines.line1}</p>
            {execSummaryLines.line2 && <p>{execSummaryLines.line2}</p>}
          </div>
        )}
      </section>

      {/* C. 시장지수 월간 동향 */}
      <section className="space-y-3">
        <SectionTitle>I. 코스피·코스닥 월간 지수 동향</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <IndexCard title="코스피" rows={kospiRows} />
          <IndexCard title="코스닥" rows={kosdaqRows} />
          <DailyCompareChart
            kospi={kospiRows.map((r) => ({ date: r.date, value: r.close }))}
            kosdaq={kosdaqRows.map((r) => ({ date: r.date, value: r.close }))}
          />
        </div>
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
          <p className="text-[10px] text-slate-300 font-semibold">
            해외 종목 원화 환산 적용 환율: 1 USD = {Math.round(latestFx.fxRate as number).toLocaleString("ko-KR")}원
            ({latestFx.fxDate} 기준)
          </p>
        )}
      </section>

      {/* ===== III장: 우주항공기업 관련 기사 ===== */}
      <section className="space-y-4">
        <SectionTitle>III. {monthLabel} 우주항공기업 관련 기사</SectionTitle>

        {/* A. 월간 시장 시황 */}
        <div>
          <h3 className="text-[13px] font-medium text-slate-300 mb-2">월간 시장 시황</h3>
          {marketWeeklyGroups.length === 0 ? (
            <EmptyNews />
          ) : (
            <div className="rounded-xl border border-slate-700 bg-slate-900/50 divide-y divide-slate-800">
              {marketWeeklyGroups.map((g) => (
                <div key={g.weekNum}>
                  {g.items.map((n, i) => (
                    <NewsRow key={n.link} item={n} weekLabel={i === 0 ? `${monthLabel} ${g.weekNum}주차` : undefined} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* B. 기업별 주요 뉴스 */}
        <div>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h3 className="text-[13px] font-medium text-slate-300">기업별 주요 뉴스</h3>
            <div className="flex gap-1.5 flex-wrap">
              {(["전체", "이노스페이스", "해외 피어그룹", "국내 피어그룹"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setNewsFilter(f)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                    newsFilter === f
                      ? "bg-amber-400/15 border-amber-400/40 text-amber-300"
                      : "border-slate-700 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {companyArticleGroups
              .filter((g) => {
                if (newsFilter === "전체") return true;
                if (newsFilter === "이노스페이스") return g.group === "self";
                if (newsFilter === "해외 피어그룹") return g.group === "us";
                return g.group === "domestic";
              })
              .map((g) => (
                <CompanyNewsCard key={g.name} group={g} tableRows={tableRows} />
              ))}
          </div>
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
  sharesOpen?: number | null;
  sharesDataInsufficient?: boolean;
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

// 이노스페이스(당사)는 domestic_investor_flow에 없고 daily_data(일간 페이지 소스)에 있음 - 종목코드가 아닌
// 전용 시트라 별도 함수로 처리. 일간 페이지와 동일한 필드(indiv/foreign/inst/etcTotal)를 월 단위로 합산.
function buildInnospaceFlowFromDaily(rows: DailyRow[], month: string): FlowSummary | null {
  // daily_data의 일자 필드는 "2026-08-19"처럼 대시 포함 형식(월간 month와 동일 포맷)
  const monthRows = rows.filter((r) => r.d && r.d.startsWith(month));
  if (monthRows.length === 0) return null;
  return {
    individual: monthRows.reduce((s, r) => s + (r.indiv ?? 0), 0),
    foreign: monthRows.reduce((s, r) => s + (r.foreign ?? 0), 0),
    institution: monthRows.reduce((s, r) => s + (r.inst ?? 0), 0),
    otherTotal: monthRows.reduce((s, r) => s + (r.etcTotal ?? 0), 0),
  };
}

function buildFlowSummary(rows: DomesticInvestorFlowRow[], code: string, month: string): FlowSummary | null {
  const companyRows = rows.filter((r) => String(r.code).replace(/^0+/, "") === String(code).replace(/^0+/, "") && r.date.startsWith(month));
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
  return sign + Math.round(n).toLocaleString("ko-KR") + "주";
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

function SummaryPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3">
      <p className="text-[13px] text-slate-200 font-semibold mb-1.5">{title}</p>
      {children}
    </div>
  );
}

function toneColor(tone: "up" | "down" | "flat" | undefined): string {
  return tone === "up" ? "text-red-400" : tone === "down" ? "text-blue-400" : "text-slate-400";
}

function pctPointText(v: number | null): string {
  if (v == null) return "-";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%p`;
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

function MonthSelector({ month, availableMonths }: { month: string; availableMonths: string[] }) {
  const router = useRouter();
  // 실제 데이터가 존재하는 달만 목록에 표시한다 (기계적인 최근 N개월 생성 금지).
  // 현재 선택된 달이 목록에 없는 경우(예: URL 직접 입력)에도 항상 포함시켜 목록에서 사라지지 않게 한다.
  const options = availableMonths.includes(month)
    ? availableMonths
    : [month, ...availableMonths].sort((a, b) => b.localeCompare(a));

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
    <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-[13px] font-semibold text-slate-200">{title}</h3>
        <RetPct v={changePct} />
      </div>
      <div className="grid grid-cols-4 gap-2 text-[11px] mb-2">
        <div>
          <p className="text-slate-300 font-semibold">월초 지수</p>
          <p className="tabular-nums text-slate-100 font-bold">{first.close.toLocaleString("ko-KR")}</p>
        </div>
        <div>
          <p className="text-slate-300 font-semibold">월말 지수</p>
          <p className="tabular-nums text-slate-100 font-bold">{last.close.toLocaleString("ko-KR")}</p>
        </div>
        <div>
          <p className="text-slate-300 font-semibold">최고</p>
          <p className="tabular-nums text-slate-100 font-bold">{high?.toLocaleString("ko-KR")}</p>
        </div>
        <div>
          <p className="text-slate-300 font-semibold">최저</p>
          <p className="tabular-nums text-slate-100 font-bold">{low?.toLocaleString("ko-KR")}</p>
        </div>
      </div>
      <DailyPriceChart
        points={sorted.map((r) => ({ date: r.date, value: r.close, high: r.high, low: r.low }))}
        isUs={false}
        showHeader={false}
        height={140}
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
      <p className="text-[10px] text-slate-300 font-semibold mt-1">월초 종가를 0%로 정규화한 누적 등락률 기준</p>
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
                        className="px-3 pt-3 pb-1 text-[10px] text-slate-300 font-semibold bg-slate-900/40"
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
                        <span className="block text-[10px] text-slate-300 font-semibold">{fmtLocalCap(localCap, true)}</span>
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
    <div className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
      <p className="text-[10px] text-slate-300 font-semibold shrink-0">{label}</p>
      <p className="text-[14px] font-semibold text-slate-200 tabular-nums text-right">{value}</p>
    </div>
  );
}

function FlowStatCard({ label, value }: { label: string; value: number }) {
  const color = value > 0 ? "text-red-400" : value < 0 ? "text-blue-400" : "text-slate-400";
  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
      <p className="text-[10px] text-slate-300 font-semibold shrink-0">{label}</p>
      <p className={`text-[14px] font-semibold tabular-nums text-right ${color}`}>{fmtFlow(value)}</p>
    </div>
  );
}

function DetailItem({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" | "flat" }) {
  const color = tone === "up" ? "text-red-400" : tone === "down" ? "text-blue-400" : tone === "flat" ? "text-slate-400" : "text-slate-200";
  return (
    <div>
      <p className="text-[10px] text-slate-300 font-semibold">{label}</p>
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
    <div className="flex flex-col lg:flex-row gap-4">
      {/* 왼쪽: 2x2 정보 카드 (~38-40%) */}
      <div className="lg:w-[38%] space-y-3 shrink-0">
        <div className="grid grid-cols-2 gap-2">
          <MiniStatCard
            label="발행주식수"
            value={snap.shares != null ? Math.round(snap.shares).toLocaleString("ko-KR") + "주" : "-"}
          />
          <MiniStatCard label="월중 최고가" value={fmtPrice(snap.monthHigh, isUs)} />
          <MiniStatCard label="월중 최저가" value={fmtPrice(snap.monthLow, isUs)} />
          <div className="bg-slate-900/60 border border-slate-700 rounded-lg px-2.5 py-2">
            <p className="text-[10px] text-slate-300 font-semibold">시가총액 변화</p>
            <p className="text-[12px] font-medium text-slate-200 tabular-nums leading-tight mt-0.5 whitespace-nowrap">
              {fmtMarketCapKrw(snap.openMarketCap)} → {fmtMarketCapKrw(snap.closeMarketCap)}
            </p>
            <p className={`text-[11px] font-semibold tabular-nums mt-0.5 ${toneColor(toneOf(snap.marketCapChange))}`}>
              {snap.marketCapChange != null
                ? `${snap.marketCapChange >= 0 ? "+" : "-"}${fmtMarketCapKrw(Math.abs(snap.marketCapChange))}`
                : "-"}
              {marketCapPctChange != null && (
                <span className="font-normal">
                  ({marketCapPctChange >= 0 ? "+" : ""}
                  {marketCapPctChange.toFixed(1)}%)
                </span>
              )}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] text-slate-300 font-semibold mb-1">투자자별 누적 순매수</p>
          {isUs || !flow ? (
            <p className="text-[11px] text-slate-500 bg-slate-900/60 border border-slate-700 rounded-lg px-2.5 py-1.5">
              해당 종목은 투자자별 매매동향 데이터가 제공되지 않습니다.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <FlowStatCard label="개인" value={flow.individual} />
              <FlowStatCard label="외국인" value={flow.foreign} />
              <FlowStatCard label="기관" value={flow.institution} />
              <FlowStatCard label="기타" value={flow.otherTotal} />
            </div>
          )}
        </div>
      </div>

      {/* 오른쪽: 월간 주가 추이 차트 (~60-62%) */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-300 font-semibold mb-1">
          월간 주가 추이
          {dailyPoints.length > 0 && (
            <span className="ml-1 text-slate-600">
              ({dailyPoints[0].date} ~ {dailyPoints[dailyPoints.length - 1].date})
            </span>
          )}
        </p>
        <DailyPriceChart points={dailyPoints} isUs={isUs} height={180} />
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

function NewsRow({ item, weekLabel }: { item: NewsItemLike; weekLabel?: string }) {
  return (
    <div className="px-4 py-2.5">
      {weekLabel && (
        <p className="text-[10px] font-semibold text-amber-400/80 mb-1">{weekLabel}</p>
      )}
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

type ChartPoint = { date: string; value: number; high?: number; low?: number };

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
    const byDateUs = new Map<string, number>();
    usHistoryRows
      .filter((r) => r.symbol === symbol && r.date.startsWith(month))
      .forEach((r) => byDateUs.set(r.date, r.close));
    return Array.from(byDateUs.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value }));
  }
  // 동일 날짜가 여러 report_date에 중복 저장될 수 있어(재실행 등), 날짜별로 1건만 사용
  const byDate = new Map<string, { close: number; high: number; low: number }>();
  chartRows
    .filter((r) => String(r.code).replace(/^0+/, "") === String(code).replace(/^0+/, "") && r.date.startsWith(month))
    .forEach((r) => byDate.set(r.date, { close: r.close, high: r.high, low: r.low }));
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, value: v.close, high: v.high, low: v.low }));
}

function buildSegments(points: ChartPoint[]) {
  const rows: Record<string, number | string | number[]>[] = points.map((p, i) => ({
    x: i,
    date: p.date,
    ...(p.high != null && p.low != null ? { range: [p.low, p.high] } : {}),
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
      <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-3.5 text-[12px] text-slate-500">
        비교할 데이터가 충분하지 않습니다.
      </div>
    );
  }

  const lastIdx = merged.length - 1;
  const kospiEnd = merged[lastIdx].kospi ?? 0;
  const kosdaqEnd = merged[lastIdx].kosdaq ?? 0;
  // 두 라벨이 너무 가까우면(값 차이가 작으면) 겹치지 않도록 상하로 밀어준다
  const closeLabels = Math.abs(kospiEnd - kosdaqEnd) < (Math.max(...merged.map(m => Math.max(m.kospi ?? 0, m.kosdaq ?? 0))) - Math.min(...merged.map(m => Math.min(m.kospi ?? 0, m.kosdaq ?? 0)))) * 0.06;
  const kospiDy = closeLabels ? (kospiEnd >= kosdaqEnd ? -8 : 8) : 0;
  const kosdaqDy = closeLabels ? (kosdaqEnd > kospiEnd ? -8 : 8) : 0;

  const tickCount = Math.min(6, merged.length);
  const step = Math.max(1, Math.floor((merged.length - 1) / Math.max(tickCount - 1, 1)));
  const dayTicks = merged.filter((_, i) => i % step === 0 || i === merged.length - 1).map((r) => r.date);

  const EndLabel = (props: any) => {
    const { cx, cy, index, dataKey } = props;
    if (index !== lastIdx || cx == null || cy == null) return null;
    const val = dataKey === "kospi" ? kospiEnd : kosdaqEnd;
    const color = dataKey === "kospi" ? "#f87171" : "#60a5fa";
    const dy = dataKey === "kospi" ? kospiDy : kosdaqDy;
    const label = `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`;
    const boxW = 54;
    const boxH = 18;
    const bx = cx + 8;
    const by = cy + dy - boxH / 2;
    return (
      <g>
        <rect x={bx} y={by} width={boxW} height={boxH} rx={4} fill={color} />
        <text x={bx + boxW / 2} y={by + boxH / 2} dy={4} fontSize={11} fontWeight={700} fill="#ffffff" textAnchor="middle">
          {label}
        </text>
      </g>
    );
  };;;

  return (
    <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-[13px] font-semibold text-slate-200">코스피/코스닥 누적 등락률</h3>
        <div className="flex gap-2.5 text-[10px]">
          <span className="text-red-400">● 코스피</span>
          <span className="text-blue-400">● 코스닥</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <ComposedChart data={merged} margin={{ top: 4, right: 72, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="date"
            ticks={dayTicks}
            tickFormatter={(d: string) => d.slice(5).replace("-", "/")}
            tick={{ fontSize: 9, fill: "#64748b" }}
            axisLine={{ stroke: "#334155" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "#64748b" }}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
          <Tooltip content={<CompareTooltip />} />
          <Line
            type="linear"
            dataKey="kospi"
            stroke="#f87171"
            strokeWidth={2}
            dot={<EndLabel />}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="kosdaq"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={<EndLabel />}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
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

// ---------- 기업별 뉴스 선별 (중복 제거 + 중요도 스코어링) ----------

const HIGH_PRIORITY_KEYWORDS = ["수주", "계약", "발사", "시험", "실적", "투자", "증자", "IPO", "공모"];
const MID_PRIORITY_KEYWORDS = ["사업", "전략", "협력", "파트너십", "MOU", "양해각서"];
const RELIABLE_SOURCES = ["연합뉴스", "한국경제", "매일경제", "머니투데이", "이데일리", "전자신문", "조선비즈", "서울경제"];

function normalizeTitle(title: string): string {
  return title
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^가-힣a-zA-Z0-9]/g, "")
    .slice(0, 22);
}

function scoreArticle(a: WeeklyNewsRow): number {
  let score = 0;
  if (HIGH_PRIORITY_KEYWORDS.some((k) => a.title.includes(k))) score += 30;
  if (MID_PRIORITY_KEYWORDS.some((k) => a.title.includes(k))) score += 15;
  if (RELIABLE_SOURCES.some((s) => a.source.includes(s))) score += 5;
  score += Math.min(a.outletCount ?? 0, 5);
  return score;
}

function selectTopArticles(articles: WeeklyNewsRow[]): WeeklyNewsRow[] {
  // 1) 포토뉴스·영상뉴스 등 내용 없는 기사, 단순 시황("주가 올랐다" 류) 기사 제외
  const isLowQuality = (title: string) =>
    /\[?(포토|사진|현장사진|시험장면|영상)\]?/.test(title) ||
    /^\[포토\]|\(사진\)|\(현장사진\)|\(영상\)/.test(title) ||
    /주가.{0,4}(올랐다|상승했다|급등했다)\.?$/.test(title.trim());
  const qualityFiltered = articles.filter((a) => !isLowQuality(a.title));

  // 2) URL 동일 제거
  const byLink = dedupeByLink(qualityFiltered);
  // 3) 제목이 사실상 동일한 기사 제거 (정규화 후 동일하면 대표 1건만)
  const seenTitles = new Set<string>();
  const deduped: WeeklyNewsRow[] = [];
  for (const a of byLink) {
    const key = normalizeTitle(a.title);
    if (key && seenTitles.has(key)) continue;
    if (key) seenTitles.add(key);
    deduped.push(a);
  }

  // 4) 중요도 -> 최신순 정렬
  const sorted = deduped.sort(
    (a, b) => scoreArticle(b) - scoreArticle(a) || b.pubDate.localeCompare(a.pubDate)
  );

  // 5) 동일 주차(같은 report_date) 기사는 최대 2건까지만, 전체 최대 4건
  const weekCounts = new Map<string, number>();
  const result: WeeklyNewsRow[] = [];
  for (const a of sorted) {
    if (result.length >= 4) break;
    const count = weekCounts.get(a.reportDate) ?? 0;
    if (count >= 2) continue;
    weekCounts.set(a.reportDate, count + 1);
    result.push(a);
  }
  return result;
}

function CompanyNewsCard({
  group,
  tableRows,
}: {
  group: { name: string; group: Group; articles: WeeklyNewsRow[] };
  tableRows: TableRowData[];
}) {
  const row = tableRows.find((r) => r.name === group.name);
  const changePct = row?.snap?.changePct ?? null;
  const isSelf = group.group === "self";
  const isUsGroup = group.group === "us";

  return (
    <div
      className={`rounded-xl border bg-slate-900/50 p-3 flex flex-col ${
        isSelf ? "border-amber-400/50" : "border-slate-700"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${badgeStyle(group.group)}`}>
            {isSelf ? "당사" : isUsGroup ? "해외" : "국내"}
          </span>
          <span className="text-[13px] font-medium text-slate-100">{group.name}</span>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-slate-500 leading-none mb-0.5">월초 대비</p>
          <RetPct v={changePct} />
        </div>
      </div>
      {group.articles.length === 0 ? (
        <p className="text-[11px] text-slate-500 py-3 text-center flex-1">
          이번 달 별도 보고할 주요 기사가 없습니다.
        </p>
      ) : (
        <div className="space-y-2 flex-1">
          {group.articles.map((a) => (
            <a
              key={a.link}
              href={a.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <p className="text-[11px] text-slate-500 mb-0.5">
                {formatDate(a.pubDate)} · {a.source}
              </p>
              <p className="text-[12.5px] text-slate-200 leading-snug line-clamp-2 group-hover:text-amber-300">
                {a.title}
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
