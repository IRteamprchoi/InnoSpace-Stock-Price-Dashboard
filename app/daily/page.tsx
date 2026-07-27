import DailyDashboard from "@/components/Dashboard";
import AutoRefresh from "@/components/AutoRefresh";
import DashboardLayout from "@/components/DashboardLayout";
import { getDailyData, getIntradayData } from "@/lib/sheets";

// 접속할 때마다 매번 새로 렌더링 (캐시된 오래된 데이터를 보여주지 않도록)
export const dynamic = "force-dynamic";

export default async function DailyPage() {
  const [dailyData, intradayData] = await Promise.all([
    getDailyData(),
    getIntradayData(),
  ]);

  return (
    <DashboardLayout title="이노스페이스 일간 주가 및 매매 동향">
      <AutoRefresh intervalSeconds={60} />
      <DailyDashboard dailyData={dailyData} intradayData={intradayData} />
    </DashboardLayout>
  );
}
