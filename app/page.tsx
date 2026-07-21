import Dashboard from "@/components/Dashboard";
import { getDailyData, getIntradayData } from "@/lib/sheets";

// 페이지 자체도 주기적으로 다시 생성 (구글시트 최신값 반영)
export const revalidate = 60;

export default async function Home() {
  const [dailyData, intradayData] = await Promise.all([
    getDailyData(),
    getIntradayData(),
  ]);

  return <Dashboard dailyData={dailyData} intradayData={intradayData} />;
}
