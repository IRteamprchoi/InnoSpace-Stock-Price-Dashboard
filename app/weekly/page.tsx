import DashboardLayout from "@/components/DashboardLayout";
import WeeklyDashboard from "@/components/WeeklyDashboard";
import {
  getWeeklyPrices, getWeeklyNews, getIntradayData, getWeeklyIntradayPrice,
  latestReportOnly, dedupeBy,
} from "@/lib/sheets";
import { fetchUsdKrwRate } from "@/lib/fx";

// 접속할 때마다 최신 주간 데이터를 다시 가져옴
export const dynamic = "force-dynamic";

export default async function WeeklyPage() {
  const [allPrices, allNews, dailyIntraday, weeklyIntraday, fx] = await Promise.all([
    getWeeklyPrices(),
    getWeeklyNews(),
    getIntradayData(),        // 이노스페이스: 일간 대시보드가 5분마다 쌓아온 실제 장중 데이터 재사용
    getWeeklyIntradayPrice(), // 국내 14 + 해외 3: 15분마다 쌓이는 실제 장중 데이터
    fetchUsdKrwRate(),        // 해외 종목 시가총액 원화 환산용 (실제 환율, 고정값 아님)
  ]);

  // weekly_prices/weekly_news는 매주 계속 누적되므로, 가장 최근 리포트 한 주 분량만 표시.
  // 혹시 같은 날 여러 번 실행되어 중복 행이 남아있어도 종목코드/기사링크 기준으로 한 번씩만 남김
  const prices = dedupeBy(latestReportOnly(allPrices), (r) => `${r.category}:${r.code}`);
  const news = dedupeBy(latestReportOnly(allNews), (r) => `${r.name}:${r.link}`);

  const innospaceIntraday = [...dailyIntraday]
    .sort((a, b) => (a.ts < b.ts ? -1 : 1))
    .map((d) => ({ date: d.ts.slice(0, 10), time: d.ts.slice(11, 16), price: d.price }));

  return (
    <DashboardLayout title="이노스페이스 주간 주가 및 매매 동향">
      <WeeklyDashboard
        prices={prices}
        news={news}
        innospaceIntraday={innospaceIntraday}
        peerIntraday={weeklyIntraday}
        fx={fx}
      />
    </DashboardLayout>
  );
}
