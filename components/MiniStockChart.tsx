"use client";

import React, { useMemo } from "react";
import { ComposedChart, Line, Bar, XAxis, YAxis, ReferenceLine, Tooltip, ResponsiveContainer } from "recharts";
import { Clock } from "lucide-react";

export type ChartPoint = { date: string; close: number; volume?: number };

const UP_COLOR = "#f87171";
const DOWN_COLOR = "#60a5fa";
const FLAT_COLOR = "#94a3b8";

function fmtPrice(n: number, isUs: boolean) {
  if (isUs) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return Math.round(n).toLocaleString("ko-KR");
}

function StockChartTooltip({ active, payload, isUs }: any) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  const up = row.dayChgPct >= 0;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-md px-2.5 py-2 text-[11px] shadow-xl">
      <div className="text-slate-400 mb-1 font-mono">{row.date}</div>
      <div className="text-slate-100 font-mono text-right">{fmtPrice(row.close, isUs)}</div>
      {row.dayChgPct != null && (
        <div className={`font-mono text-right ${up ? "text-red-400" : "text-blue-400"}`}>
          {up ? "+" : ""}{row.dayChgPct.toFixed(2)}%
        </div>
      )}
      {row.volume != null && row.volume > 0 && (
        <div className="text-slate-500 font-mono text-right">{row.volume.toLocaleString("ko-KR")}주</div>
      )}
    </div>
  );
}

export function StockChartLoading({ height = 130 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 rounded-md" style={{ height }}>
      <Clock size={12} className="text-slate-700 animate-pulse" />
      <span className="text-[11px] text-slate-600">데이터 수집 중</span>
    </div>
  );
}

// 종목별 미니 증권 차트: 주가(상단 ~80%) + 거래량(하단 ~20%), 같은 날짜축 공유.
// 모든 종목 카드가 이 컴포넌트 하나를 공통으로 재사용합니다.
export default function MiniStockChart({
  data,
  isUs = false,
  height = 130,
}: {
  data: ChartPoint[];
  isUs?: boolean;
  height?: number;
}) {
  const prepared = useMemo(() => {
    return data.map((d, i) => ({
      date: d.date,
      close: d.close,
      volume: d.volume ?? null,
      dayChgPct: i > 0 && data[i - 1].close ? ((d.close - data[i - 1].close) / data[i - 1].close) * 100 : null,
    }));
  }, [data]);

  const { yMin, yMax, lineColor, refPrice, hasVolume, volMax, ticks } = useMemo(() => {
    const closes = prepared.map((d) => d.close);
    const max = Math.max(...closes);
    const min = Math.min(...closes);
    const pad = (max - min) * 0.08 || Math.max(max * 0.02, 1); // 고가=저가인 경우 대비 최소 범위 확보
    const first = prepared[0]?.close ?? 0;
    const last = prepared[prepared.length - 1]?.close ?? 0;
    const up = last > first;
    const flat = last === first;

    const vols = prepared.map((d) => d.volume || 0);
    const volMax = Math.max(...vols, 0);

    return {
      yMin: min - pad,
      yMax: max + pad,
      lineColor: flat ? FLAT_COLOR : up ? UP_COLOR : DOWN_COLOR,
      refPrice: first, // 우선순위 1: 직전 거래일 종가 = 이 구간 시작 전날 종가가 없으므로 구간 첫 값을 기준으로 사용
      hasVolume: volMax > 0,
      volMax,
      ticks: [min, (min + max) / 2, max],
    };
  }, [prepared]);

  if (!data || data.length < 2) return <StockChartLoading height={height} />;

  const priceHeightRatio = hasVolume ? 0.8 : 1;
  const volDomainMax = hasVolume ? volMax / 0.2 : 1;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={prepared} margin={{ top: 8, right: 4, left: 0, bottom: 4 }}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          tickFormatter={(v) => v.slice(5).replace("-", "/")}
          axisLine={{ stroke: "#1e293b" }}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={28}
          height={20}
        />
        {/* 가격 축: 우측, 고가/중간/저가 3개만 */}
        <YAxis
          yAxisId="price"
          orientation="right"
          domain={[yMin, yMax]}
          ticks={ticks}
          tick={{ fontSize: 10, fill: "#94a3b8", textAnchor: "start" }}
          tickFormatter={(v) => fmtPrice(v, isUs)}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        {/* 거래량 축: 숨김, 값의 범위를 늘려서 차트 하단 20%만 차지하도록 함 */}
        {hasVolume && (
          <YAxis yAxisId="vol" domain={[0, volDomainMax]} hide />
        )}

        <ReferenceLine
          yAxisId="price"
          y={refPrice}
          stroke="#64748b"
          strokeDasharray="2 3"
          strokeOpacity={0.7}
        />

        {hasVolume && (
          <Bar yAxisId="vol" dataKey="volume" fill="#64748b" fillOpacity={0.45} radius={[1, 1, 0, 0]} isAnimationActive={false} />
        )}

        <Line
          yAxisId="price"
          type="linear"
          dataKey="close"
          stroke={lineColor}
          strokeWidth={1.8}
          dot={false}
          activeDot={{ r: 3, fill: lineColor, stroke: "#0f172a", strokeWidth: 1 }}
          isAnimationActive={false}
        />

        <Tooltip content={<StockChartTooltip isUs={isUs} />} cursor={{ stroke: "#334155", strokeWidth: 1 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
