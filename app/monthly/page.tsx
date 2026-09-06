import { redirect } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import MonthlyDashboard from "@/components/MonthlyDashboard";
import {
  getIndexDailyHistory,
  getMarketNewsMonthly,
  getWeeklyPrices,
  getWeeklyNews,
  getDomesticInvestorFlow,
  getDomesticDailyData,
  getWeeklyChartData,
  getUsStockHistory,
  getDailyData,
} from "@/lib/sheets";

export default async function MonthlyPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const [
    indexRows,
    marketNewsRows,
    priceRows,
    companyNewsRows,
    investorFlowRows,
    domesticDailyRows,
    chartRows,
    usHistoryRows,
    dailyRows,
  ] = await Promise.all([
    getIndexDailyHistory(),
    getMarketNewsMonthly(),
    getWeeklyPrices(),
    getWeeklyNews(),
    getDomesticInvestorFlow(),
    getDomesticDailyData(),
    getWeeklyChartData(),
    getUsStockHistory(),
    getDailyData(),
  ]);

  // 실제 주간 리포트 데이터가 존재하는 달만 "사용 가능한 월"로 인정한다.
  // (현재 날짜 기준 최근 N개월을 기계적으로 생성하지 않음 - 8월 실드데이터 인전 6/7월이 노출되던 버그 수정)
  // 정식 월간 보고는 2026년 8월부터 시작. 그 이전 주(7월 테스트 수집분 등)는
  // weekly_prices에 데이터가 있어도 "정식 보고서"가 아니므로 목록에서 제외한다.
const REPORTING_START_MONTH = "2026-08";

// ── 공개 가능한 최신 달 계산 (MonthlyDashboard.tsx의 클라이언트 게이팅과 동일한 규칙) ──
// 다음 달 첫 영업일 09:00 KST 전까지는 그 달을 목록/기본화면에 노출하지 않는다.
const HOLIDAYS = new Set<string>([
  "2026-01-01","2026-02-16","2026-02-17","2026-02-18","2026-03-01","2026-03-02",
  "2026-05-05","2026-05-24","2026-05-25","2026-06-06","2026-08-15","2026-08-17",
  "2026-09-24","2026-09-25","2026-09-26","2026-10-03","2026-10-05","2026-10-09",
  "2026-12-25",
]);
const firstBusinessDay = (ym: string): string => {
  for (let d = 1; d <= 15; d++) {
    const dd = String(d).padStart(2, "0");
    const dateStr = `${ym}-${dd}`;
    const dow = new Date(`${dateStr}T00:00:00+09:00`).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    if (HOLIDAYS.has(dateStr)) continue;
    return dateStr;
  }
  return `${ym}-01`;
};
const prevYm = (ym: string): string => {
  let [y, m] = ym.split("-").map(Number);
  m -= 1; if (m === 0) { m = 12; y -= 1; }
  return `${y}-${String(m).padStart(2, "0")}`;
};
const nowKst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
const curYm = `${nowKst.getFullYear()}-${String(nowKst.getMonth() + 1).padStart(2, "0")}`;
const gateMs = new Date(`${firstBusinessDay(curYm)}T09:00:00+09:00`).getTime();
const publishedCap = Date.now() >= gateMs ? prevYm(curYm) : prevYm(prevYm(curYm));

const availableMonths = Array.from(
  new Set(priceRows.map((r) => r.refFriday.slice(0, 7)))
)
  .filter((m) => m >= REPORTING_START_MONTH && m <= publishedCap)
  .sort((a, b) => b.localeCompare(a));

  const latestMonth = availableMonths[0] ?? new Date().toISOString().slice(0, 7);
  const requestedMonth = searchParams.month;

  // 존재하지 않는(보고서가 없는) 달이 요청되면 최신 사용 가능한 달로 리다이렉트
  if (requestedMonth && !availableMonths.includes(requestedMonth)) {
    redirect(`/monthly?month=${latestMonth}`);
  }

  const month = requestedMonth ?? latestMonth;

  return (
    <DashboardLayout title="이노스페이스 월간 주가 및 매매 동향">
      <MonthlyDashboard
        month={month}
        availableMonths={availableMonths}
        indexRows={indexRows}
        marketNewsRows={marketNewsRows}
        priceRows={priceRows}
        companyNewsRows={companyNewsRows}
        investorFlowRows={investorFlowRows}
        domesticDailyRows={domesticDailyRows}
        chartRows={chartRows}
        usHistoryRows={usHistoryRows}
        dailyRows={dailyRows}
      />
    </DashboardLayout>
  );
}
