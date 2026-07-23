import Dashboard from "@/components/Dashboard";
import AutoRefresh from "@/components/AutoRefresh";
import { getDailyData, getIntradayData } from "@/lib/sheets";

// 접속할 때마다 매번 새로 렌더링 (캐시된 오래된 데이터를 보여주지 않도록)
export const dynamic = "force-dynamic";

export default async function Home() {
  const [dailyData, intradayData] = await Promise.all([
    getDailyData(),
    getIntradayData(),
  ]);

  return (
    <>
      <AutoRefresh intervalSeconds={60} />
      <Dashboard dailyData={dailyData} intradayData={intradayData} />
    </>
  );
}
