import DashboardLayout from "@/components/DashboardLayout";
import MonthlyDashboard from "@/components/MonthlyDashboard";
import {
  getIndexDailyHistory,
  getMarketNewsMonthly,
  getWeeklyPrices,
  getWeeklyNews,
  getDomesticInvestorFlow,
} from "@/lib/sheets";

export default async function MonthlyPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const month = searchParams.month ?? new Date().toISOString().slice(0, 7);

  const [indexRows, marketNewsRows, priceRows, companyNewsRows, investorFlowRows] = await Promise.all([
    getIndexDailyHistory(),
    getMarketNewsMonthly(),
    getWeeklyPrices(),
    getWeeklyNews(),
    getDomesticInvestorFlow(),
  ]);

  return (
    <DashboardLayout title="이노스페이스 월간 주가 및 매매 동향">
      <MonthlyDashboard
        month={month}
        indexRows={indexRows}
        marketNewsRows={marketNewsRows}
        priceRows={priceRows}
        companyNewsRows={companyNewsRows}
        investorFlowRows={investorFlowRows}
      />
    </DashboardLayout>
  );
}
