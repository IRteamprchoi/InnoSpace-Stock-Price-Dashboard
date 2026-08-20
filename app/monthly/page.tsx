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
  const availableMonths = Array.from(
    new Set(priceRows.map((r) => r.refFriday.slice(0, 7)))
  ).sort((a, b) => b.localeCompare(a));

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
