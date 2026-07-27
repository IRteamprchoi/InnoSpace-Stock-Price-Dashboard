import { Hammer } from "lucide-react";

// 주간/월간처럼 아직 데이터 연동이 없는 페이지에서 쓰는 빈 상태 안내 카드.
// 기존 대시보드 카드 톤(bg-slate-900/70, border-slate-700)과 맞춰서 튀지 않도록 구성.
export default function UnderConstruction({
  title,
  message,
  subMessage,
}: {
  title: string;
  message: string;
  subMessage: string;
}) {
  return (
    <div className="bg-slate-900/70 border border-slate-700 rounded-xl px-6 py-14 flex flex-col items-center text-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
        <Hammer size={18} className="text-slate-400" />
      </div>
      <h2 className="text-[18px] sm:text-[20px] font-bold text-slate-100" style={{ letterSpacing: "-0.02em" }}>
        {title}
      </h2>
      <p className="text-[14px] font-medium text-slate-300 max-w-sm">{message}</p>
      <p className="text-[13px] font-medium text-slate-500 max-w-sm">{subMessage}</p>
    </div>
  );
}
