"use client";

import React, { useMemo } from "react";
import { ComposedChart, Line, ResponsiveContainer } from "recharts";

// 일간 대시보드의 "1주일" 차트와 같은 스타일: 전일 대비 상승한 날은 빨간색, 하락한 날은
// 파란색 선분으로 구간마다 색을 다르게 표시 (하나의 색으로만 밋밋하게 보이지 않도록).
export default function MiniChart({
  data,
  height = 64,
}: {
  data: { date: string; close: number }[];
  height?: number;
}) {
  const { rows, segs } = useMemo(() => {
    const rows: any[] = data.map((d, i) => ({ idx: i }));
    const segs: { key: string; color: string }[] = [];
    for (let i = 1; i < data.length; i++) {
      const key = `seg${i}`;
      const up = data[i].close >= data[i - 1].close;
      rows[i - 1][key] = data[i - 1].close;
      rows[i][key] = data[i].close;
      segs.push({ key, color: up ? "#f87171" : "#60a5fa" });
    }
    return { rows, segs };
  }, [data]);

  if (!data || data.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
        {segs.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            stroke={s.color}
            strokeWidth={1.5}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
