import DashboardLayout from "@/components/DashboardLayout";
import WeeklyDashboard from "@/components/WeeklyDashboard";
import { getWeeklyPrices, getWeeklyNews, latestReportOnly } from "@/lib/sheets";

// 접속할 때마다 최신 주간 데이터를 다시 가져옴
export const dynamic = "force-dynamic";

export default async function WeeklyPage() {
  const [allPrices, allNews] = await Promise.all([
    getWeeklyPrices(),
    getWeeklyNews(),
  ]);

  // weekly_prices/weekly_news는 매주 계속 누적되므로, 가장 최근 리포트 한 주 분량만 표시
  const prices = latestReportOnly(allPrices);
  const news = latestReportOnly(allNews);

  return (
    <DashboardLayout title="이노스페이스 주간 주가 및 매매 동향">
      <WeeklyDashboard prices={prices} news={news} />
    </DashboardLayout>
  );
}
