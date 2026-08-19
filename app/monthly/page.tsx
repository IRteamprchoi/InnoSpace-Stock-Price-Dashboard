// ===== app/monthly/page.tsx 전체 교체 =====

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
    <MonthlyDashboard
      month={month}
      indexRows={indexRows}
      marketNewsRows={marketNewsRows}
      priceRows={priceRows}
      companyNewsRows={companyNewsRows}
      investorFlowRows={investorFlowRows}
    />
  );
}
