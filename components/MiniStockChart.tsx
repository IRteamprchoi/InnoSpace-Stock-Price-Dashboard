"use client";

import React, { useMemo } from "react";
import { ComposedChart, Line, XAxis, YAxis, ReferenceLine, Tooltip, ResponsiveContainer } from "recharts";
import { Clock } from "lucide-react";

export type IntradayPoint = { date: string; time: string; price: number };

const UP_COLOR = "#f87171";
const DOWN_COLOR = "#60a5fa";
const FLAT_COLOR = "#94a3b8";
const MIN_TRADING_DAYS = 5; // 5거래일치가 쌓이기 전까지는 "데이터 수집 중"으로 표시
const MIN_POINTS_PER_DAY = 3; // 하루에 포인트가 이 개수 미만이면 "그날은 제대로 수집 안 됨"으로 간주

function fmtPrice(n: number, isUs: boolean) {
  if (isUs) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return Math.round(n).toLocaleString("ko-KR");
}

function StockChartTooltip({ active, payload, isUs }: any) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-md px-2.5 py-2 text-[11px] shadow-xl">
      <div className="text-slate-400 mb-1 font-mono">{row.date} {row.time}</div>
      <div className="text-slate-100 font-mono text-right">{fmtPrice(row.value, isUs)}</div>
    </div>
  );
}

export function StockChartLoading({ height = 130, daysCollected = 0 }: { height?: number; daysCollected?: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-md" style={{ height }}>
      <Clock size={12} className="text-slate-700 animate-pulse" />
      <span className="text-[11px] text-slate-600">
        데이터 수집 중{daysCollected > 0 ? ` (${daysCollected}/${MIN_TRADING_DAYS}일 확보)` : ""}
      </span>
    </div>
  );
}

// 종목별 미니 증권 차트: 15분(이노스페이스는 5분) 간격으로 실제 수집된 장중 시세를 시간순으로
// 이어서 그립니다. 가짜로 만든 값이 아니라 실제 체결 시점의 데이터만 사용하며, 5거래일치가
// 쌓이기 전까지는 로딩 상태로 표시됩니다. 선분 하나하나가 직전 지점 대비 오르면 빨강, 내리면 파랑.
export default function MiniStockChart({
  points,
  isUs = false,
  prevClose,
  height = 140,
}: {
  points: IntradayPoint[];
  isUs?: boolean;
  prevClose?: number | null;
  height?: number;
}) {
  const sorted = useMemo(
    () => [...points].sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1)),
    [points]
  );

  const distinctDays = useMemo(() => Array.from(new Set(sorted.map((p) => p.date))), [sorted]);

  // "5거래일 확보" 판정을 단순히 날짜가 5개 있는지가 아니라, 각 날짜에 실제로 데이터가
  // 촘촘히(하루 최소 MIN_POINTS_PER_DAY개) 쌓였는지까지 확인 - API 오류 등으로 하루에
  // 포인트가 1~2개뿐이었던 날은 "제대로 수집된 날"로 치지 않음
  const qualifiedDays = useMemo(() => {
    const counts = new Map<string, number>();
    sorted.forEach((p) => counts.set(p.date, (counts.get(p.date) || 0) + 1));
    return distinctDays.filter((d) => (counts.get(d) || 0) >= MIN_POINTS_PER_DAY);
  }, [sorted, distinctDays]);

  const { rows, segs, dayTicks, yMin, yMax, priceTicks, refPrice } = useMemo(() => {
    // 날짜별로 묶어서, 하루 안에서는 실제 수집된 순서 그대로, 날짜 사이에는 x를 정수 단위로
    // 띄워서(야간 공백을 그대로 그리지 않고) 거래일마다 같은 폭을 갖도록 배치
    const byDay = new Map<string, IntradayPoint[]>();
    sorted.forEach((p) => {
      if (!byDay.has(p.date)) byDay.set(p.date, []);
      byDay.get(p.date)!.push(p);
    });

    const flatPoints: { x: number; date: string; time: string; value: number; isDayStart: boolean }[] = [];
    distinctDays.forEach((date, dayIdx) => {
      const dayPoints = byDay.get(date)!;
      dayPoints.forEach((p, j) => {
        const frac = dayPoints.length > 1 ? j / (dayPoints.length - 1) : 0;
        flatPoints.push({ x: dayIdx + frac, date: p.date, time: p.time, value: p.price, isDayStart: j === 0 });
      });
    });

    const rows: any[] = flatPoints.map((p) => ({ x: p.x, date: p.date, time: p.time, value: p.value }));
    const segs: { key: string; color: string }[] = [];
    for (let i = 1; i < flatPoints.length; i++) {
      const key = `seg${i}`;
      const up = flatPoints[i].value > flatPoints[i - 1].value;
      const flat = flatPoints[i].value === flatPoints[i - 1].value;
      rows[i - 1][key] = flatPoints[i - 1].value;
      rows[i][key] = flatPoints[i].value;
      segs.push({ key, color: flat ? FLAT_COLOR : up ? UP_COLOR : DOWN_COLOR });
    }

    const dayTicks = flatPoints.filter((p) => p.isDayStart).map((p) => ({ x: p.x, label: p.date.slice(5).replace("-", "/") }));

    const values = flatPoints.map((p) => p.value);
    const max = Math.max(...values, 0);
    const min = Math.min(...values, max);
    const pad = (max - min) * 0.08 || Math.max(max * 0.02, 1);

    const refPrice = prevClose != null ? prevClose : flatPoints[0]?.value ?? 0;

    return {
      rows, segs, dayTicks,
      yMin: min - pad, yMax: max + pad,
      priceTicks: [min, (min + max) / 2, max],
      refPrice,
    };
  }, [sorted, distinctDays, prevClose]);

  if (qualifiedDays.length < MIN_TRADING_DAYS) {
    return <StockChartLoading height={height} daysCollected={qualifiedDays.length} />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 4 }}>
        {/* 거래일 경계: 아주 옅은 세로 구분선 */}
        {dayTicks.slice(1).map((t) => (
          <ReferenceLine key={t.x} x={t.x} stroke="#1e293b" strokeWidth={1} />
        ))}

        <XAxis
          dataKey="x"
          type="number"
          domain={[0, dayTicks.length - 1 + 1]}
          ticks={dayTicks.map((t) => t.x)}
          tickFormatter={(v) => dayTicks.find((t) => t.x === v)?.label ?? ""}
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          axisLine={{ stroke: "#1e293b" }}
          tickLine={false}
          height={20}
        />
        <YAxis
          orientation="right"
          domain={[yMin, yMax]}
          ticks={priceTicks}
          tick={{ fontSize: 10, fill: "#94a3b8", textAnchor: "start" }}
          tickFormatter={(v) => fmtPrice(v, isUs)}
          axisLine={false}
          tickLine={false}
          width={44}
        />

        <ReferenceLine y={refPrice} stroke="#64748b" strokeDasharray="2 3" strokeOpacity={0.7} />

        {segs.map((s) => (
          <Line
            key={s.key}
            type="linear"
            dataKey={s.key}
            stroke={s.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            connectNulls={false}
            activeDot={{ r: 3, fill: s.color, stroke: "#0f172a", strokeWidth: 1 }}
            isAnimationActive={false}
          />
        ))}

        <Tooltip content={<StockChartTooltip isUs={isUs} />} cursor={{ stroke: "#334155", strokeWidth: 1 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
