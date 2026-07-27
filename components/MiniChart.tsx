"use client";

import React, { useMemo } from "react";
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

const fmt = (n: number) => n.toLocaleString("ko-KR");

// 일간 대시보드의 "1주일" 차트와 같은 톤(요일별 빨강/파랑 구간)을 쓰되, 구간이 너무 많아지면
// (한 달~석 달치를 전부 색칠하면) 지저분해 보이므로 최근 N거래일로 창을 좁혀서 깔끔하게 유지.
const MAX_POINTS = 20;

export default function MiniChart({
  data,
  height = 88,
}: {
  data: { date: string; close: number }[];
  height?: number;
}) {
  const windowed = useMemo(() => data.slice(-MAX_POINTS), [data]);

  const { rows, segs } = useMemo(() => {
    const rows: any[] = windowed.map((d) => ({ date: d.date }));
    const segs: { key: string; color: string }[] = [];
    for (let i = 1; i < windowed.length; i++) {
      const key = `seg${i}`;
      const up = windowed[i].close >= windowed[i - 1].close;
      rows[i - 1][key] = windowed[i - 1].close;
      rows[i][key] = windowed[i].close;
      segs.push({ key, color: up ? "#f87171" : "#60a5fa" });
    }
    return { rows, segs };
  }, [windowed]);

  if (!windowed || windowed.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 4, right: 6, left: 6, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 9, fill: "#64748b" }}
          tickFormatter={(v) => v.slice(5).replace("-", "/")}
          axisLine={{ stroke: "#1e293b" }}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          domain={["auto", "auto"]}
          tick={{ fontSize: 9, fill: "#64748b" }}
          tickFormatter={fmt}
          axisLine={false}
          tickLine={false}
          width={40}
        />
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
