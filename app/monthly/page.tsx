// ===== 이 파일은 새로 만드는 파일입니다: app/monthly/page.tsx =====
// app/weekly/page.tsx와 동일한 패턴 (서버 컴포넌트에서 데이터 fetch -> 클라이언트 컴포넌트에 props 전달)

import MonthlyDashboard from "@/components/MonthlyDashboard";
import { getIndexDailyHistory, getMarketNewsMonthly } from "@/lib/sheets";

export default async function MonthlyPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  // 기본값: 이번 달. 예: /monthly?month=2026-08 로 과거 달 조회 가능(추후 월 선택 UI 추가 시 활용)
  const month = searchParams.month ?? new Date().toISOString().slice(0, 7);

  const [indexRows, newsRows] = await Promise.all([
    getIndexDailyHistory(),
    getMarketNewsMonthly(),
  ]);

  return <MonthlyDashboard month={month} indexRows={indexRows} newsRows={newsRows} />;
}
