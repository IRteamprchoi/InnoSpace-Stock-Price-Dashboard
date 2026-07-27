import { RefreshCw } from "lucide-react";

// 섹션 제목 옆/아래에 붙는 "매 5분마다 업데이트" 같은 보조 안내 배지. 제목보다 강조되지 않도록
// 작은 크기(12~13px)와 차분한 색으로 통일. 여러 섹션(주가 추이, 상세 표 등)에서 재사용.
export default function UpdateInfo({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] sm:text-[13px] font-medium text-slate-400 whitespace-nowrap">
      <RefreshCw size={11} />
      {text}
    </span>
  );
}
