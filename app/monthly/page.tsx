import DashboardLayout from "@/components/DashboardLayout";
import UnderConstruction from "@/components/UnderConstruction";

export default function MonthlyPage() {
  return (
    <DashboardLayout title="이노스페이스 월간 주가 및 매매 동향">
      <UnderConstruction
        title="월간 주가 및 매매 동향"
        message="현재 월간 주가 및 매매 동향 페이지를 제작 중입니다."
        subMessage="데이터 집계 기준과 화면 구성이 완료되는 대로 제공할 예정입니다."
      />
    </DashboardLayout>
  );
}
