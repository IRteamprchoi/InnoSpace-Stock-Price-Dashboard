// 구글시트("파일 > 공유 > 웹에 게시"로 얻은 CSV 링크)에서 데이터를 읽어오는 함수
// .env(Vercel 환경변수)에 아래 두 개를 등록해야 합니다:
//   DAILY_CSV_URL     - "daily_data" 시트를 CSV로 게시한 링크
//   INTRADAY_CSV_URL  - "intraday_price" 시트를 CSV로 게시한 링크

export type DailyRow = {
  d: string;
  close: number;
  chg: number;
  chgPct: number;
  open: number;
  high: number;
  low: number;
  vol: number;
  amt: number;
  mcap: number;
  indiv: number;
  foreign: number;
  inst: number;
  fin: number;
  ins: number;
  tr: number;
  bank: number;
  etcFin: number;
  pen: number;
  pe: number;
  etcCorp: number;
  etcForeign: number;
  etcTotal: number;
};

export type IntradayRow = {
  ts: string;
  price: number;
  chg: number;
  chgPct: number;
  open: number;
  high: number;
  low: number;
  vol: number;
  amt: number;
  mcap: number;
};

// 간단한 CSV 파서 (따옴표로 감싼 셀도 처리)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const num = (v: string | undefined) => {
  if (v === undefined || v === null || v === "") return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const numOrNull = (v: string | undefined) => {
  if (v === undefined || v === null || v.trim() === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

// fetch 응답을 항상 UTF-8로 명시적으로 디코딩 (브라우저/서버가 인코딩을 잘못 추측해서
// 한글이 깨지는 문제를 원천 차단하기 위함 - 구글시트 게시 CSV는 UTF-8이 맞지만
// Content-Type에 charset이 안 붙어있으면 자동판별이 틀릴 수 있음)
async function fetchCsvText(url: string): Promise<string | null> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  return new TextDecoder("utf-8").decode(buf);
}

export async function getDailyData(): Promise<DailyRow[]> {
  const url = process.env.DAILY_CSV_URL;
  if (!url) {
    console.warn("DAILY_CSV_URL 환경변수가 설정되지 않았습니다.");
    return [];
  }

  const text = await fetchCsvText(url);
  if (text === null) {
    console.error("일별 데이터 조회 실패");
    return [];
  }
  const rows = parseCsv(text);
  const [, ...dataRows] = rows; // 첫 행은 헤더

  return dataRows.map((r) => ({
    d: r[0],
    close: num(r[1]),
    chg: num(r[2]),
    chgPct: num(r[3]),
    open: num(r[4]),
    high: num(r[5]),
    low: num(r[6]),
    vol: num(r[7]),
    amt: num(r[8]),
    mcap: num(r[9]),
    indiv: num(r[10]),
    foreign: num(r[11]),
    inst: num(r[12]),
    fin: num(r[13]),
    ins: num(r[14]),
    tr: num(r[15]),
    bank: num(r[16]),
    etcFin: num(r[17]),
    pen: num(r[18]),
    pe: num(r[19]),
    etcCorp: num(r[20]),
    etcForeign: num(r[21]),
    etcTotal: num(r[22]),
  }));
}

export async function getIntradayData(): Promise<IntradayRow[]> {
  const url = process.env.INTRADAY_CSV_URL;
  if (!url) {
    console.warn("INTRADAY_CSV_URL 환경변수가 설정되지 않았습니다.");
    return [];
  }

  const text = await fetchCsvText(url);
  if (text === null) {
    console.error("장중 시세 조회 실패");
    return [];
  }
  const rows = parseCsv(text);
  const [, ...dataRows] = rows;

  return dataRows.map((r) => ({
    ts: r[0],
    price: num(r[1]),
    chg: num(r[2]),
    chgPct: num(r[3]),
    open: num(r[4]),
    high: num(r[5]),
    low: num(r[6]),
    vol: num(r[7]),
    amt: num(r[8]),
    mcap: num(r[9]),
  }));
}

// --- 주간 주가동향 (weekly.gs가 매주 월요일에 채워주는 데이터) ---

export type WeeklyPriceRow = {
  reportDate: string;
  refFriday: string;
  prevFriday: string;
  category: "index" | "domestic" | "us" | string;
  name: string;
  code: string;
  close: number | null;
  prevClose: number | null;
  weekHigh: number | null;
  weekLow: number | null;
  ret1w: number | null;
  ret1m: number | null;
  ret3m: number | null;
  retYtd: number | null;
  ref1mClose: number | null;
  ref3mClose: number | null;
  refYtdClose: number | null;
  marketCap: number | null;
  shares: number | null;
  weekVolume: number | null;
  fxRate: number | null;
  fxDate: string | null;
  weekOpenClose: number | null;
  weekOpenDate: string | null;
};

export type WeeklyNewsRow = {
  reportDate: string;
  name: string;
  title: string;
  titleOriginal: string;
  source: string;
  pubDate: string;
  link: string;
  outletCount: number;
};

export async function getWeeklyPrices(): Promise<WeeklyPriceRow[]> {
  const url = process.env.WEEKLY_PRICES_CSV_URL;
  if (!url) {
    console.warn("WEEKLY_PRICES_CSV_URL 환경변수가 설정되지 않았습니다.");
    return [];
  }

  const text = await fetchCsvText(url);
  if (text === null) {
    console.error("주간 시세 조회 실패");
    return [];
  }
  const rows = parseCsv(text);
  const [, ...dataRows] = rows;

  return dataRows.map((r) => ({
    reportDate: r[0],
    refFriday: r[1],
    prevFriday: r[2],
    category: r[3],
    name: r[4],
    code: r[5],
    close: numOrNull(r[6]),
    prevClose: numOrNull(r[7]),
    weekHigh: numOrNull(r[8]),
    weekLow: numOrNull(r[9]),
    ret1w: numOrNull(r[10]),
    ret1m: numOrNull(r[11]),
    ret3m: numOrNull(r[12]),
    retYtd: numOrNull(r[13]),
    ref1mClose: numOrNull(r[14]),
    ref3mClose: numOrNull(r[15]),
    refYtdClose: numOrNull(r[16]),
    marketCap: numOrNull(r[17]),
    shares: numOrNull(r[18]),
    weekVolume: numOrNull(r[19]),
    weekOpenClose: numOrNull(r[20]),
    weekOpenDate: r[21] || null,
    fxRate: numOrNull(r[22]),
    fxDate: r[23] || null,
  }));
}

export async function getWeeklyNews(): Promise<WeeklyNewsRow[]> {
  const url = process.env.WEEKLY_NEWS_CSV_URL;
  if (!url) {
    console.warn("WEEKLY_NEWS_CSV_URL 환경변수가 설정되지 않았습니다.");
    return [];
  }

  const text = await fetchCsvText(url);
  if (text === null) {
    console.error("주간 뉴스 조회 실패");
    return [];
  }
  const rows = parseCsv(text);
  const [, ...dataRows] = rows;

  return dataRows.map((r) => ({
    reportDate: r[0],
    name: r[1],
    title: r[2],
    titleOriginal: r[3],
    source: r[4],
    pubDate: r[5],
    link: r[6],
    outletCount: num(r[7]),
  }));
}

export type UsStockHistoryRow = {
  symbol: string;
  date: string;
  close: number;
  volume: number;
};

export async function getUsStockHistory(): Promise<UsStockHistoryRow[]> {
  const url = process.env.US_STOCK_HISTORY_CSV_URL;
  if (!url) {
    console.warn("US_STOCK_HISTORY_CSV_URL 환경변수가 설정되지 않았습니다.");
    return [];
  }

  const text = await fetchCsvText(url);
  if (text === null) {
    console.error("해외 종목 이력 조회 실패");
    return [];
  }
  const rows = parseCsv(text);
  const [, ...dataRows] = rows;

  return dataRows.map((r) => ({
    symbol: r[0],
    date: r[1],
    close: num(r[5]),
    volume: num(r[6]),
  }));
}

export type WeeklyChartPoint = {
  reportDate: string;
  code: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export async function getWeeklyChartData(): Promise<WeeklyChartPoint[]> {
  const url = process.env.WEEKLY_CHART_CSV_URL;
  if (!url) {
    console.warn("WEEKLY_CHART_CSV_URL 환경변수가 설정되지 않았습니다.");
    return [];
  }

  const text = await fetchCsvText(url);
  if (text === null) {
    console.error("종목별 주가 추이 데이터 조회 실패");
    return [];
  }
  const rows = parseCsv(text);
  const [, ...dataRows] = rows;

  return dataRows.map((r) => ({
    reportDate: r[0],
    code: r[1],
    date: r[2],
    open: num(r[3]),
    high: num(r[4]),
    low: num(r[5]),
    close: num(r[6]),
  }));
}

export type WeeklyIntradayRow = {
  tradeDate: string;
  time: string;
  fullTimestamp: string;
  code: string;
  name: string;
  market: string;
  price: number;
};

export async function getWeeklyIntradayPrice(): Promise<WeeklyIntradayRow[]> {
  const url = process.env.WEEKLY_INTRADAY_CSV_URL;
  if (!url) {
    console.warn("WEEKLY_INTRADAY_CSV_URL 환경변수가 설정되지 않았습니다.");
    return [];
  }

  const text = await fetchCsvText(url);
  if (text === null) {
    console.error("주간 장중 시세 조회 실패");
    return [];
  }
  const rows = parseCsv(text);
  const [, ...dataRows] = rows;

  // 컬럼 순서: 거래일, 측정시각, 전체_timestamp, 종목코드, 기업명, 시장, 현지시간, 한국시간, 주가, 통화, 출처, 수집시각, 간격
  return dataRows.map((r) => ({
    tradeDate: r[0],
    time: r[1],
    fullTimestamp: r[2],
    code: r[3],
    name: r[4],
    market: r[5],
    price: num(r[8]),
  }));
}

// 가장 최근 report_date 하나만 남기기 (weekly_prices/weekly_news는 매주 계속 누적되므로,
// 화면에는 최신 리포트 한 주 분량만 보여줌)
export function latestReportOnly<T extends { reportDate: string }>(rows: T[]): T[] {
  if (!rows.length) return [];
  const latest = rows.reduce((a, b) => (b.reportDate > a.reportDate ? b : a), rows[0]).reportDate;
  return rows.filter((r) => r.reportDate === latest);
}

// 특정 report_date(과거 리포트) 하나만 남기기 - "지난 리포트 보기" 기능용.
// targetReportDate가 없거나 해당 리포트가 없으면 latestReportOnly와 동일하게 최신으로 대체
export function selectReportOnly<T extends { reportDate: string }>(rows: T[], targetReportDate?: string | null): T[] {
  if (!rows.length) return [];
  if (targetReportDate && rows.some((r) => r.reportDate === targetReportDate)) {
    return rows.filter((r) => r.reportDate === targetReportDate);
  }
  return latestReportOnly(rows);
}

// 지금까지 쌓인 리포트의 report_date 목록을 최신순으로 나열 (드롭다운용)
export function listAvailableReports<T extends { reportDate: string }>(rows: T[]): string[] {
  const set = new Set(rows.map((r) => r.reportDate));
  return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
}

// 안전장치: 같은 날짜에 스크립트가 여러 번 실행되어 시트에 중복 행이 남아있어도,
// 화면에는 종목/기사당 하나씩만 보이도록 방어적으로 중복 제거
export function dedupeBy<T>(rows: T[], keyFn: (r: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  rows.forEach((r) => {
    const key = keyFn(r);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  });
  return out;
}
