"use client";

import React from "react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";

// 일간 대시보드의 "3개월/1년" 차트와 같은 톤(초록 그라데이션)을 재사용한 미니 추이 차트.
// 종목마다 표 아래 "종목별 주가 추이" 카드 안에 하나씩 들어감.
export default function MiniChart({
  data,
  height = 64,
}: {
  data: { date: string; close: number }[];
  height?: number;
}) {
  if (!data || data.length < 2) return null;

  const first = data[0].close;
  const last = data[data.length - 1].close;
  const up = last >= first;
  const color = up ? "#4ade80" : "#60a5fa"; // 상승=초록(일간 차트 톤 유지), 하락=파랑

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`miniFill-${up ? "up" : "down"}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis domain={["auto", "auto"]} hide />
        <Area
          type="monotone"
          dataKey="close"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#miniFill-${up ? "up" : "down"})`}
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
