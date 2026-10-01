import type { WeeklyChartPoint } from "@/lib/sheets";

// 휴장 사유 이름표. 기간 계산에는 쓰이지 않고(기간은 실제 거래 데이터로 계산),
// "09.24~25 추석 휴장"처럼 이름을 붙일 때만 사용. 목록에 없는 휴장일은 "10.09 휴장"처럼 날짜만 표기됨.
// 평일 휴장일만 적으면 됨. 매년 연말에 다음 해 목록을 추가해 주세요.
export const KRX_HOLIDAY_NAMES: Record<string, string> = {
  "2026-01-01": "신정",
  "2026-02-16": "설날", "2026-02-17": "설날", "2026-02-18": "설날",
  "2026-03-02": "삼일절 대체공휴일",
  "2026-05-05": "어린이날",
  "2026-05-25": "부처님오신날 대체공휴일",
  "2026-06-03": "지방선거",
  "2026-07-17": "제헌절",
  "2026-08-17": "광복절 대체공휴일",
  "2026-09-24": "추석", "2026-09-25": "추석",
  "2026-10-05": "개천절 대체공휴일",
  "2026-10-09": "한글날",
  "2026-12-25": "성탄절",
  "2026-12-31": "연말",
};

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

export type ClosedGroup = { dates: string[]; name: string | null };
export type MarketPeriod = {
  first: string;        // 첫 거래일 (YYYY-MM-DD)
  last: string;         // 마지막 거래일
  days: number;         // 거래일 수
  dates: string[];      // 거래일 목록 (오름차순)
  closed: ClosedGroup[]; // 기준주간 평일 중 휴장일 (연속된 같은 사유끼리 묶음)
};

// 날짜 문자열(YYYY-MM-DD)을 UTC 자정으로만 다룸 → 서버(Vercel, UTC)와 브라우저(KST) 어디서 실행해도 같은 결과
function toUtc(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function addDaysIso(s: string, n: number) {
  const d = toUtc(s);
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
export function weekdayIndex(s: string) {
  return toUtc(s).getUTCDay(); // 0=일 ... 6=토
}
export function isWeekendDate(s: string) {
  const w = weekdayIndex(s);
  return w === 0 || w === 6;
}

/**
 * 종목들의 일봉에서 "실제 거래일"만 모아 기간을 계산.
 * - 주말 행 제외
 * - 직전 행과 시가·고가·저가·종가가 완전히 같은 행 제외 (미국 이력의 휴장일 복사 행 대응,
 *   9/28 이전 리포트에 남아 있는 데이터용)
 * - 여러 종목 중 하나라도 거래한 날은 거래일로 봄 (한 종목의 거래정지·누락에 흔들리지 않도록)
 */
export function computeMarketPeriod(
  points: WeeklyChartPoint[],
  codes: string[],
  weekStart: string,
  weekEnd: string,
  holidayNames: Record<string, string> = {}
): MarketPeriod | null {
  if (!weekStart || !weekEnd || !codes.length) return null;
  const codeSet = new Set(codes);
  const byCode = new Map<string, WeeklyChartPoint[]>();
  points.forEach((p) => {
    if (!codeSet.has(p.code)) return;
    if (!byCode.has(p.code)) byCode.set(p.code, []);
    byCode.get(p.code)!.push(p);
  });

  const traded = new Set<string>();
  byCode.forEach((arr) => {
    const sorted = [...arr].sort((a, b) => (a.date < b.date ? -1 : 1));
    sorted.forEach((p, i) => {
      if (p.date < weekStart || p.date > weekEnd || isWeekendDate(p.date)) return;
      const prev = sorted[i - 1];
      if (prev && prev.open === p.open && prev.high === p.high && prev.low === p.low && prev.close === p.close) return;
      traded.add(p.date);
    });
  });
  if (!traded.size) return null;

  const dates = Array.from(traded).sort();
  const closedDates: string[] = [];
  for (let d = weekStart, guard = 0; d <= weekEnd && guard < 14; d = addDaysIso(d, 1), guard++) {
    if (!isWeekendDate(d) && !traded.has(d)) closedDates.push(d);
  }

  const closed: ClosedGroup[] = [];
  closedDates.forEach((d) => {
    const name = holidayNames[d] ?? null;
    const lastGroup = closed[closed.length - 1];
    const prevDate = lastGroup?.dates[lastGroup.dates.length - 1];
    if (lastGroup && lastGroup.name === name && prevDate && addDaysIso(prevDate, 1) === d) {
      lastGroup.dates.push(d);
    } else {
      closed.push({ dates: [d], name });
    }
  });

  return { first: dates[0], last: dates[dates.length - 1], days: dates.length, dates, closed };
}

export function krxPeriod(points: WeeklyChartPoint[], codes: string[], weekStart: string, weekEnd: string) {
  return computeMarketPeriod(points, codes, weekStart, weekEnd, KRX_HOLIDAY_NAMES);
}
export function usPeriod(points: WeeklyChartPoint[], codes: string[], weekStart: string, weekEnd: string) {
  return computeMarketPeriod(points, codes, weekStart, weekEnd);
}

/** "09.21(월)" */
export function mdDot(s: string) {
  if (!s) return "-";
  const [, m, d] = s.split("-");
  return `${m}.${d}(${WEEKDAY_KO[weekdayIndex(s)]})`;
}

/** "09.24~25 추석 휴장" / "10.09 휴장" */
export function closedLabel(g: ClosedGroup) {
  const first = g.dates[0];
  const last = g.dates[g.dates.length - 1];
  const [, m1, d1] = first.split("-");
  const [, m2, d2] = last.split("-");
  const range = g.dates.length === 1 ? `${m1}.${d1}` : m1 === m2 ? `${m1}.${d1}~${d2}` : `${m1}.${d1}~${m2}.${d2}`;
  return g.name ? `${range} ${g.name} 휴장` : `${range} 휴장`;
}

/** 두 시장의 거래기간이 완전히 같은지 (같으면 기존처럼 한 줄로 표기) */
export function samePeriod(a: MarketPeriod | null, b: MarketPeriod | null) {
  if (!a || !b) return true;
  return a.first === b.first && a.last === b.last && a.days === b.days;
}
