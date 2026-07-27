import DashboardLayout from "@/components/DashboardLayout";
import WeeklyDashboard from "@/components/WeeklyDashboard";
import {
  getWeeklyPrices, getWeeklyNews, latestReportOnly, dedupeBy,
  getDailyData, getUsStockHistory,
} from "@/lib/sheets";
import { fetchUsdKrwRate } from "@/lib/fx";

// 접속할 때마다 최신 주간 데이터를 다시 가져옴
export const dynamic = "force-dynamic";

export default async function WeeklyPage() {
  const [allPrices, allNews, dailyData, usHistory, fx] = await Promise.all([
    getWeeklyPrices(),
    getWeeklyNews(),
    getDailyData(),       // 이노스페이스 미니 차트용 (이미 있는 일별 데이터 재사용)
    getUsStockHistory(),  // 해외 3종목 미니 차트용
    fetchUsdKrwRate(),    // 해외 종목 시가총액 원화 환산용 (실제 환율, 고정값 아님)
  ]);

  // weekly_prices/weekly_news는 매주 계속 누적되므로, 가장 최근 리포트 한 주 분량만 표시.
  // 혹시 같은 날 여러 번 실행되어 중복 행이 남아있어도 종목코드/기사링크 기준으로 한 번씩만 남김
  const prices = dedupeBy(latestReportOnly(allPrices), (r) => `${r.category}:${r.code}`);
  const news = dedupeBy(latestReportOnly(allNews), (r) => `${r.name}:${r.link}`);

  const innospaceHistory = [...dailyData]
    .sort((a, b) => (a.d < b.d ? -1 : 1))
    .map((d) => ({ date: d.d, close: d.close, volume: d.vol }));

  return (
    <DashboardLayout title="이노스페이스 주간 주가 및 매매 동향">
      <WeeklyDashboard prices={prices} news={news} innospaceHistory={innospaceHistory} usHistory={usHistory} fx={fx} />
    </DashboardLayout>
  );
}
