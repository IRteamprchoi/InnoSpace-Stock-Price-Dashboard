import DashboardLayout from "@/components/DashboardLayout";
import WeeklyDashboard from "@/components/WeeklyDashboard";
import {
  getWeeklyPrices, getWeeklyNews, getIntradayData, getWeeklyIntradayPrice, getWeeklyChartData,
  latestReportOnly, selectReportOnly, listAvailableReports, dedupeBy,
} from "@/lib/sheets";

// 접속할 때마다 최신 주간 데이터를 다시 가져옴
export const dynamic = "force-dynamic";

export default async function WeeklyPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week: selectedWeek } = await searchParams;

  const [allPrices, allNews, dailyIntraday, weeklyIntraday, allChartData] = await Promise.all([
    getWeeklyPrices(),
    getWeeklyNews(),
    getIntradayData(),        // 이노스페이스: 일간 대시보드가 5분마다 쌓아온 실제 장중 데이터 재사용
    getWeeklyIntradayPrice(), // 국내 14 + 해외 3: 15분마다 쌓이는 실제 장중 데이터
    getWeeklyChartData(),     // 종목별 그 주 실제 거래일별 시가/고가/저가/종가 (공휴일은 애초에 데이터가 없음)
  ]);

  // weekly_prices/weekly_news는 매주 계속 누적되므로, 기본은 최신 리포트를 보여주되
  // ?week=2026-07-24 같은 쿼리로 지난 리포트를 선택해서 볼 수 있음 ("지난 리포트 보기")
  const prices = dedupeBy(selectReportOnly(allPrices, selectedWeek), (r) => `${r.category}:${r.code}`);
  const news = dedupeBy(selectReportOnly(allNews, selectedWeek), (r) => `${r.name}:${r.link}`);
  const chartData = dedupeBy(selectReportOnly(allChartData, selectedWeek), (r) => `${r.code}:${r.date}`);
  const availableWeeks = listAvailableReports(allPrices);

  // 환율은 "지금 조회한 값"이 아니라, 이 리포트가 생성될 때(그 주 월요일) 스크립트가 같이
  // 저장해둔 값을 그대로 사용 - 몇 주 지난 리포트를 봐도 그때 당시 환율이 그대로 표시되도록
  const fxRow = prices.find((r) => r.fxRate != null);
  const fx = fxRow ? { usdToKrw: fxRow.fxRate!, asOfDate: fxRow.fxDate || fxRow.reportDate } : null;

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
        weekChartData={chartData}
        fx={fx}
        availableWeeks={availableWeeks}
        selectedWeek={prices[0]?.reportDate || null}
      />
    </DashboardLayout>
  );
}
