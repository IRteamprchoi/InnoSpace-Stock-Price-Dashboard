import DashboardHeader from "./DashboardHeader";
import PeriodNavigation from "./PeriodNavigation";

// 일간/주간/월간 페이지가 공통으로 쓰는 뼈대: 헤더(제목·종목코드·장상태) + 페이지 이동 탭 + 본문 + 푸터.
// title만 페이지별로 다르게 넘기고, 나머지 레이아웃은 완전히 동일하게 유지됩니다.
export default function DashboardLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <DashboardHeader title={title} />
        <PeriodNavigation />
        {children}
        <p className="text-[10px] text-slate-700 text-center pt-4">이노스페이스 IR팀 내부용 대시보드</p>
      </div>
    </div>
  );
}
