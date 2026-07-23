"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 화면을 열어둔 채로 있어도 주기적으로 서버에서 최신 데이터를 다시 가져오도록
 * (페이지 전체를 새로고침하지 않고, 스크롤 위치 등은 그대로 유지됩니다)
 */
export default function AutoRefresh({ intervalSeconds = 60 }: { intervalSeconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const t = setInterval(() => {
      router.refresh();
    }, intervalSeconds * 1000);
    return () => clearInterval(t);
  }, [router, intervalSeconds]);

  return null;
}
