import { redirect } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import MonthlyDashboard from "@/components/MonthlyDashboard";
import {
  getIndexDailyHistory,
  getMarketNewsMonthly,
  getWeeklyPrices,
  getWeeklyNews,
  getDomesticInvestorFlow,
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
    chartRows,
    usHistoryRows,
    dailyRows,
  ] = await Promise.all([
    getIndexDailyHistory(),
    getMarketNewsMonthly(),
    getWeeklyPrices(),
    getWeeklyNews(),
    getDomesticInvestorFlow(),
    getWeeklyChartData(),
    getUsStockHistory(),
    getDailyData(),
  ]);

  // 실제 주간 리포트 데이터가 존재하는 달만 "사용 가능한 월"로 인정한다.
  // (현재 날짜 기준 최근 N개월을 기계적으로 생성하지 않음 - 8월 실드데이터 인전 6/7월이 노출되던 버그 수정)
  // 정식 월간 보고는 2026년 8월부터 시작. 그 이전 주(7월 테스트 수집분 등)는
  // weekly_prices에 데이터가 있어도 "정식 보고서"가 아니므로 목록에서 제외한다.
  const REPORTING_START_MONTH = "2026-08";
  const availableMonths = Array.from(
    new Set(priceRows.map((r) => r.refFriday.slice(0, 7)))
  )
    .filter((m) => m >= REPORTING_START_MONTH)
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
        chartRows={chartRows}
        usHistoryRows={usHistoryRows}
        dailyRows={dailyRows}
      />
    </DashboardLayout>
  );
}
