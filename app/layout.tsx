import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "이노스페이스 주가 및 매매 동향",
  description: "이노스페이스(462350) IR 내부 대시보드",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
