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

export async function getDailyData(): Promise<DailyRow[]> {
  const url = process.env.DAILY_CSV_URL;
  if (!url) {
    console.warn("DAILY_CSV_URL 환경변수가 설정되지 않았습니다.");
    return [];
  }

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    console.error("일별 데이터 조회 실패:", res.status);
    return [];
  }
  const text = await res.text();
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

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    console.error("장중 시세 조회 실패:", res.status);
    return [];
  }
  const text = await res.text();
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
