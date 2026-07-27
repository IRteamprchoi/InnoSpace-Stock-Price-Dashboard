import { redirect } from "next/navigation";

// 최초 접속 시 일간 페이지가 기본으로 표시되도록 리다이렉트
export default function Home() {
  redirect("/daily");
}
