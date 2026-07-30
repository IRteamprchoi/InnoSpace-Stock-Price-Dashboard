/**
 * 주간 주가동향 자동 수집 스크립트
 * ------------------------------------------------------------
 * 이 파일은 daily/intraday 스크립트와 "같은 Apps Script 프로젝트" 안에 별도 파일로 추가하세요.
 * (왼쪽 파일 목록에서 "+" > 스크립트 > 파일명 예: weekly.gs)
 * KIS_APP_KEY / KIS_APP_SECRET, getAccessToken() 등은 기존 daily 스크립트의 것을 그대로 재사용합니다.
 *
 * 설치 방법:
 * 1. 구글시트에 새 탭 3개 생성: weekly_prices, weekly_news, us_stock_history
 *    (us_stock_history는 이미 만드셨죠 - symbol, date, open, high, low, close, volume)
 * 2. 스크립트 속성에 FINNHUB_API_KEY 추가로 등록
 * 3. 이 파일 전체를 새 스크립트 파일로 추가
 * 4. createWeeklyTrigger 함수를 한 번 실행 (최초 1회, 권한 승인)
 *    -> 이후 매주 월요일 07:00(KST) 근처에 updateWeeklyReport()가 자동 실행됩니다
 * 5. 테스트: updateWeeklyReport()를 직접 실행해서 weekly_prices / weekly_news 탭에 데이터가 채워지는지 확인
 */

const WEEKLY_PRICES_SHEET = "weekly_prices";
const WEEKLY_NEWS_SHEET = "weekly_news";
const WEEKLY_CHART_SHEET = "weekly_chart_data";
const WEEKLY_INTRADAY_SHEET = "weekly_intraday_price";
const US_HISTORY_SHEET = "us_stock_history";

const DOMESTIC_COMPANIES = [
  { name: "이노스페이스", code: "462350" },
  { name: "한화에어로스페이스", code: "012450" },
  { name: "한화시스템", code: "272210" },
  { name: "한국항공우주", code: "047810" },
  { name: "LIG D&A", code: "079550" },
  { name: "현대로템", code: "064350" },
  { name: "인텔리안테크", code: "189300" },
  { name: "쎄트렉아이", code: "099320" },
  { name: "컨텍", code: "139480", newsQuery: "컨텍 위성" },
  { name: "켄코아에어로스페이스", code: "274090" },
  { name: "AP위성", code: "211270" },
  { name: "제노코", code: "361390" },
  { name: "루미르", code: "474170" },
  { name: "비츠로넥스텍", code: "488900" },
  { name: "나라스페이스테크놀로지", code: "478340" },
];

const INDICES = [
  { name: "코스피 지수", code: "0001" },
  { name: "코스닥 지수", code: "1001" },
];

const US_COMPANIES = [
  { name: "Space X", symbol: "SPCX" },
  { name: "Rocket Lab", symbol: "RKLB" },
  { name: "Firefly Aerospace", symbol: "FLY" },
];

/** 최초 1회만 실행: 매주 월요일 07:00 근처 자동 트리거 등록 */
// 2026년 한국 공휴일 (음력 기반 날짜는 검색으로 확인한 정보라, 정부 공식자료(data.go.kr)로
// 한 번 대조 확인해주시는 걸 권장합니다. 제헌절(7/17)은 이 작성 시점에 "공휴일 지정 논의 중"으로
// 확정 전이라 제외했습니다 - 확정되면 이 배열에 "2026-07-17"을 추가해주세요.
const KOREAN_HOLIDAYS_2026 = [
  "2026-01-01", // 신정
  "2026-02-16", "2026-02-17", "2026-02-18", // 설날 연휴
  "2026-03-01", "2026-03-02", // 삼일절 + 대체공휴일
  "2026-05-05", // 어린이날
  "2026-05-24", "2026-05-25", // 부처님오신날 + 대체공휴일
  "2026-06-06", // 현충일
  "2026-08-15", "2026-08-17", // 광복절 + 대체공휴일
  "2026-09-24", "2026-09-25", "2026-09-26", // 추석 연휴
  "2026-10-03", "2026-10-05", // 개천절 + 대체공휴일
  "2026-10-09", // 한글날
  "2026-12-25", // 성탄절
];

function isKoreanHoliday(dateStr) {
  return KOREAN_HOLIDAYS_2026.indexOf(dateStr) !== -1;
}

/**
 * 오늘이 "이번 주 리포트를 실행해야 하는 날"인지 판단.
 * 월요일이 공휴일이면 화요일로, 화요일도 공휴일이면 수요일로... 하는 식으로
 * 이번 주 들어 처음 만나는 평일(공휴일 아닌 날)에 딱 한 번만 실행되도록 함.
 */
function isScheduledRunDay() {
  const today = new Date();
  const todayStr = fmtDate(today);
  if (isKoreanHoliday(todayStr)) return false;

  const dow = Number(Utilities.formatDate(today, "Asia/Seoul", "u")); // 1=월 ... 7=일
  if (dow < 1 || dow > 5) return false; // 주말 제외

  // 이번 주 월요일부터 어제까지, 그 사이에 "공휴일이 아닌 평일"이 있었다면
  // 그날 이미 실행됐어야 하므로 오늘은 건너뜀 (같은 주에 중복 실행 방지)
  for (let back = 1; back < dow; back++) {
    const d = addDays(today, -back);
    if (!isKoreanHoliday(fmtDate(d))) return false;
  }
  return true;
}

/** 최초 1회만 실행: 평일 매일 07시 근처 실행되는 트리거 등록 (공휴일 스킵은 함수 내부에서 처리) */
function createWeeklyTrigger() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === "updateWeeklyReportScheduled") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("updateWeeklyReportScheduled")
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();
  Logger.log("주간 트리거 등록 완료: 매일 07시 근처 실행 (실제로는 월요일 또는 월요일이 공휴일이면 그 주 첫 평일에만 기록됨)");
}

/** 매일 07시에 호출되는 함수 - 오늘이 "이번 주 실행일"일 때만 실제로 리포트를 만듦 */
function updateWeeklyReportScheduled() {
  if (!isScheduledRunDay()) {
    Logger.log("오늘은 예정된 실행일이 아니므로 건너뜁니다 (" + fmtDate(new Date()) + ")");
    return;
  }
  updateWeeklyReport();
}

/** 날짜 유틸 */
function fmtDate(d) {
  return Utilities.formatDate(d, "Asia/Seoul", "yyyy-MM-dd");
}
function fmtDate8(d) {
  return Utilities.formatDate(d, "Asia/Seoul", "yyyyMMdd");
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function addMonths(d, n) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

/** 이번 리포트의 기준일(지난 금요일)과 전주 금요일, 1M/3M/YTD 기준일 계산 */
function getReportDates(assumeMonday) {
  const now = new Date();
  const kstDow = Number(Utilities.formatDate(now, "Asia/Seoul", "u")); // 1=월 ... 7=일
  // "가장 최근 지난 금요일"을 요일 계산으로 정확히 찾음 (오늘이 무슨 요일이든 항상 정확함).
  // assumeMonday 파라미터는 더 이상 별도 계산을 쓰지 않음 - 예전에 "3일 전 고정"으로
  // 처리했던 게 실제로는 버그였고, 아래 수식이 어떤 요일에 실행해도 이미 정확한 금요일을 찾아줌.
  const daysSinceFriday = ((kstDow - 5) + 7) % 7 || 7;
  const refFriday = addDays(now, -daysSinceFriday);
  const prevFriday = addDays(refFriday, -7);
  const monthAgo = addMonths(refFriday, -1);
  const threeMonthAgo = addMonths(refFriday, -3);
  const ytdRef = new Date(refFriday.getFullYear(), 0, 2); // 그 해 1월 2일

  return {
    reportDate: fmtDate(now),
    refFriday, refFridayStr: fmtDate(refFriday),
    prevFriday, prevFridayStr: fmtDate(prevFriday),
    monthAgo, threeMonthAgo, ytdRef,
  };
}

/** KIS 종목 기간별 시세 조회 (D:최근 30거래일 / W:최근 30주 / M:최근 30개월) */
function fetchStockPeriod(code, periodDivCode) {
  const token = getAccessToken();
  const props = PropertiesService.getScriptProperties();
  const appKey = props.getProperty("KIS_APP_KEY");
  const appSecret = props.getProperty("KIS_APP_SECRET");

  const url =
    KIS_DOMAIN + "/uapi/domestic-stock/v1/quotations/inquire-daily-price" +
    "?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=" + code +
    "&FID_PERIOD_DIV_CODE=" + periodDivCode + "&FID_ORG_ADJ_PRC=0";

  const resp = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      "content-type": "application/json; charset=utf-8",
      authorization: "Bearer " + token,
      appkey: appKey, appsecret: appSecret,
      tr_id: "FHKST01010400", custtype: "P",
    },
    muteHttpExceptions: true,
  });
  const data = JSON.parse(resp.getContentText());
  if (data.rt_cd !== "0" || !data.output) return [];
  return data.output.map((r) => ({
    date: r.stck_bsop_date, close: Number(r.stck_clpr), open: Number(r.stck_oprc),
    high: Number(r.stck_hgpr), low: Number(r.stck_lwpr), vol: Number(r.acml_vol),
  }));
}

/** KIS 업종(지수) 기간별 시세 조회 */
function fetchIndexPeriod(code, periodDivCode) {
  const token = getAccessToken();
  const props = PropertiesService.getScriptProperties();
  const appKey = props.getProperty("KIS_APP_KEY");
  const appSecret = props.getProperty("KIS_APP_SECRET");

  const url =
    KIS_DOMAIN + "/uapi/domestic-stock/v1/quotations/inquire-index-daily-price" +
    "?FID_COND_MRKT_DIV_CODE=U&FID_INPUT_ISCD=" + code +
    "&FID_INPUT_DATE_1=" + fmtDate8(new Date()) + "&FID_PERIOD_DIV_CODE=" + periodDivCode;

  const resp = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      "content-type": "application/json; charset=utf-8",
      authorization: "Bearer " + token,
      appkey: appKey, appsecret: appSecret,
      tr_id: "FHPUP02120000", custtype: "P",
    },
    muteHttpExceptions: true,
  });
  const data = JSON.parse(resp.getContentText());
  if (data.rt_cd !== "0" || !data.output2) return [];
  return data.output2.map((r) => ({
    date: r.stck_bsop_date, close: Number(r.bstp_nmix_prpr),
    high: Number(r.bstp_nmix_hgpr), low: Number(r.bstp_nmix_lwpr),
  }));
}

/** (선택) 검증용: 지수 기간별 시세 원본 응답을 그대로 로그로 확인 (코스닥=1001) */
function testIndexPeriodRaw() {
  const dSeries = fetchIndexPeriod("1001", "D");
  Logger.log("파싱된 결과 앞 10개: " + JSON.stringify(dSeries.slice(0, 10)));
}

/** series(날짜 내림차순 배열)에서 targetDateStr(YYYY-MM-DD) 이전 또는 같은 날 중 가장 가까운 종가 찾기 */
function findClosestClose(series, targetDateStr) {
  const target = targetDateStr.replace(/-/g, "");
  let best = null;
  series.forEach((r) => {
    if (r.date <= target && (!best || r.date > best.date)) best = r;
  });
  return best ? best.close : null;
}

function ret(curr, base) {
  if (curr == null || base == null || base === 0) return null;
  return Math.round(((curr - base) / base) * 10000) / 100; // %, 소수점 2자리
}

/** daily_data 시트에서 이노스페이스의 정확한 일별 이력을 로드 (462350 전용, 근사치 대신 정확한 값 사용) */
function loadInnospaceHistory() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME); // 기존 daily 스크립트의 daily_data
  const values = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const d = values[i][0]; // 일자
    const close = values[i][1]; // 종가
    const open = values[i][4]; // 시가
    const high = values[i][5]; // 고가
    const low = values[i][6]; // 저가
    const vol = values[i][7]; // 거래량
    if (!d) continue;
    const dateStr = String(d).replace(/-/g, "");
    rows.push({ date: dateStr, close: Number(close), open: Number(open), high: Number(high), low: Number(low), vol: Number(vol) });
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : -1)); // 내림차순
  return rows;
}

/** 국내 종목 1건 처리 */
/** 국내 종목의 시가총액(원)·상장주식수 조회 (지수는 해당 없음) - 일별 스크립트가 쓰는 것과 같은 API 재사용 */
function fetchMarketCapShares(code) {
  const token = getAccessToken();
  const props = PropertiesService.getScriptProperties();
  const appKey = props.getProperty("KIS_APP_KEY");
  const appSecret = props.getProperty("KIS_APP_SECRET");

  const url = KIS_DOMAIN + "/uapi/domestic-stock/v1/quotations/inquire-price" +
    "?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=" + code;

  const resp = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      "content-type": "application/json; charset=utf-8",
      authorization: "Bearer " + token,
      appkey: appKey, appsecret: appSecret,
      tr_id: "FHKST01010100", custtype: "P",
    },
    muteHttpExceptions: true,
  });
  const data = JSON.parse(resp.getContentText());
  if (data.rt_cd !== "0" || !data.output) return { marketCap: null, shares: null };

  const marketCap = Number(data.output.hts_avls || 0) * 100000000; // 억원 -> 원
  const close = Number(data.output.stck_prpr || 0);
  const shares = close ? Math.round(marketCap / close) : null;
  return { marketCap, shares };
}

function toIsoDate(yyyymmdd) {
  return yyyymmdd.length === 8 ? yyyymmdd.slice(0, 4) + "-" + yyyymmdd.slice(4, 6) + "-" + yyyymmdd.slice(6, 8) : yyyymmdd;
}

function buildDomesticRow(company, dates, isIndex) {
  const capInfo = isIndex ? { marketCap: null, shares: null } : fetchMarketCapShares(company.code);

  // 이노스페이스는 저희가 이미 정확한 일별 데이터를 갖고 있으니 KIS 근사치 대신 그걸 직접 사용
  if (company.code === STOCK_CODE && !isIndex) {
    const hist = loadInnospaceHistory();
    const close = findClosestClose(hist, dates.refFridayStr);
    const prevClose = findClosestClose(hist, dates.prevFridayStr);
    const ref1m = findClosestClose(hist, fmtDate(dates.monthAgo));
    const ref3m = findClosestClose(hist, fmtDate(dates.threeMonthAgo));
    const refYtd = findClosestClose(hist, fmtDate(dates.ytdRef));
    const weekRows = hist.filter((r) => r.date > dates.prevFridayStr.replace(/-/g, "") && r.date <= dates.refFridayStr.replace(/-/g, ""));
    const weekHigh = weekRows.length ? Math.max(...weekRows.map((r) => r.high)) : close;
    const weekLow = weekRows.length ? Math.min(...weekRows.map((r) => r.low)) : close;
    const weekVolume = weekRows.reduce((sum, r) => sum + (r.vol || 0), 0);
    return {
      category: "domestic", name: company.name, code: company.code,
      close, prevClose, weekHigh, weekLow, weekVolume,
      ret1w: ret(close, prevClose), ret1m: ret(close, ref1m),
      ret3m: ret(close, ref3m), retYtd: ret(close, refYtd),
      ref1m, ref3m, refYtd,
      marketCap: capInfo.marketCap, shares: capInfo.shares,
      dailyOhlc: weekRows.map((r) => ({ date: toIsoDate(r.date), open: r.open, high: r.high, low: r.low, close: r.close })),
    };
  }

  const fetchPeriod = isIndex ? fetchIndexPeriod : fetchStockPeriod;
  const dSeries = fetchPeriod(company.code, "D");
  const wSeries = fetchPeriod(company.code, "W");
  const mSeries = fetchPeriod(company.code, "M");

  const close = findClosestClose(dSeries, dates.refFridayStr);
  const prevClose = findClosestClose(dSeries, dates.prevFridayStr);
  const ref1m = findClosestClose(wSeries, fmtDate(dates.monthAgo));
  const ref3m = findClosestClose(wSeries, fmtDate(dates.threeMonthAgo));
  const refYtd = findClosestClose(mSeries, fmtDate(dates.ytdRef));

  // 주간 최고/최저: 전주 금요일 다음날 ~ 기준 금요일 사이 거래일
  const weekRows = dSeries.filter((r) => r.date > dates.prevFridayStr.replace(/-/g, "") && r.date <= dates.refFridayStr.replace(/-/g, ""));
  const weekHigh = weekRows.length ? Math.max(...weekRows.map((r) => r.high)) : close;
  const weekLow = weekRows.length ? Math.min(...weekRows.map((r) => r.low)) : close;
  const weekVolume = weekRows.reduce((sum, r) => sum + (r.vol || 0), 0);

  return {
    category: isIndex ? "index" : "domestic",
    name: company.name, code: company.code,
    close, prevClose, weekHigh, weekLow, weekVolume,
    ret1w: ret(close, prevClose), ret1m: ret(close, ref1m),
    ret3m: ret(close, ref3m), retYtd: ret(close, refYtd),
    ref1m, ref3m, refYtd,
    marketCap: capInfo.marketCap, shares: capInfo.shares,
    dailyOhlc: isIndex ? [] : weekRows.map((r) => ({ date: toIsoDate(r.date), open: r.open, high: r.high, low: r.low, close: r.close })),
  };
}

/** Finnhub 현재가 조회 */
function fetchFinnhubQuote(symbol) {
  const key = PropertiesService.getScriptProperties().getProperty("FINNHUB_API_KEY");
  const url = "https://finnhub.io/api/v1/quote?symbol=" + symbol + "&token=" + key;
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const data = JSON.parse(resp.getContentText());
  return data; // { c: 현재가, pc: 전일종가, o, h, l }
}

/** Finnhub 기업개요 조회 - 시가총액(백만달러)·상장주식수(백만주) */
function fetchFinnhubProfile(symbol) {
  const key = PropertiesService.getScriptProperties().getProperty("FINNHUB_API_KEY");
  const url = "https://finnhub.io/api/v1/stock/profile2?symbol=" + symbol + "&token=" + key;
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const data = JSON.parse(resp.getContentText());
  const marketCap = data.marketCapitalization ? data.marketCapitalization * 1000000 : null; // 백만달러 -> 달러
  const shares = data.shareOutstanding ? Math.round(data.shareOutstanding * 1000000) : null; // 백만주 -> 주
  return { marketCap, shares };
}

/** us_stock_history 시트에서 해당 심볼의 시세 이력을 날짜 내림차순 배열로 로드 */
function loadUsHistory(symbol) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(US_HISTORY_SHEET);
  const values = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const [sym, date, open, high, low, close, volume] = values[i];
    if (sym !== symbol) continue;
    const dateStr = date instanceof Date ? Utilities.formatDate(date, "Asia/Seoul", "yyyyMMdd") : String(date).replace(/-/g, "");
    rows.push({ date: dateStr, close: Number(close), open: Number(open) || Number(close), high: Number(high) || Number(close), low: Number(low) || Number(close), vol: Number(volume) || 0 });
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : -1)); // 내림차순
  return rows;
}

/** 이번 주 금요일 종가를 us_stock_history에 추가 (Finnhub 현재가를 그 주 금요일 종가로 기록) */
/** 셀 값(Date 객체든 문자열이든)을 "yyyy-MM-dd" 문자열로 통일 */
function cellToDateStr(v) {
  if (v instanceof Date) return Utilities.formatDate(v, "Asia/Seoul", "yyyy-MM-dd");
  return String(v).slice(0, 10);
}

function appendUsWeeklyClose(symbol, quote, refFridayStr) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(US_HISTORY_SHEET);
  const values = sheet.getDataRange().getValues();
  const already = values.some((r) => r[0] === symbol && cellToDateStr(r[1]) === refFridayStr);
  if (already) return;
  sheet.appendRow([symbol, refFridayStr, quote.o, quote.h, quote.l, quote.c, ""]);
}

/**
 * (선택) 일회성 정리용: us_stock_history에 그동안 반복 테스트로 쌓인
 * (symbol, date) 중복 행을 찾아서 각 조합당 첫 번째 행만 남기고 나머지를 삭제.
 * Apps Script 편집기에서 이 함수를 딱 한 번 실행해주세요.
 */
function dedupeUsStockHistory() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(US_HISTORY_SHEET);
  const values = sheet.getDataRange().getValues();
  const seen = new Set();
  const rowsToDelete = [];

  for (let i = 1; i < values.length; i++) {
    const symbol = values[i][0];
    const dateStr = cellToDateStr(values[i][1]);
    const key = symbol + "|" + dateStr;
    if (seen.has(key)) {
      rowsToDelete.push(i + 1); // 시트 행 번호 (헤더가 1행)
    } else {
      seen.add(key);
    }
  }

  // 아래에서 위로 삭제해야 행 번호가 안 꼬임
  rowsToDelete.sort((a, b) => b - a).forEach((rowNum) => sheet.deleteRow(rowNum));
  Logger.log("중복 " + rowsToDelete.length + "개 행 삭제 완료");
}

/** 해외 종목 1건 처리 */
function buildUsRow(company, dates) {
  const quote = fetchFinnhubQuote(company.symbol);
  const profile = fetchFinnhubProfile(company.symbol);
  appendUsWeeklyClose(company.symbol, quote, dates.refFridayStr);

  const history = loadUsHistory(company.symbol);
  const close = quote.c;
  const prevClose = findClosestClose(history, dates.prevFridayStr) || quote.pc;
  const ref1m = findClosestClose(history, fmtDate(dates.monthAgo));
  const ref3m = findClosestClose(history, fmtDate(dates.threeMonthAgo));
  const refYtd = findClosestClose(history, fmtDate(dates.ytdRef));

  // 그 주 안의 일별 데이터가 있으면(과거 데이터 구간) 진짜 주간 고가/저가를 계산,
  // 없으면(이번 주처럼 아직 금요일 스냅샷 하나뿐인 미래 주) 금요일 하루치 고가/저가로 근사
  const weekRows = history.filter((r) => r.date > dates.prevFridayStr.replace(/-/g, "") && r.date <= dates.refFridayStr.replace(/-/g, ""));
  const weekHigh = weekRows.length > 1 ? Math.max(...weekRows.map((r) => r.high)) : quote.h;
  const weekLow = weekRows.length > 1 ? Math.min(...weekRows.map((r) => r.low)) : quote.l;
  const weekVolume = weekRows.reduce((sum, r) => sum + (r.vol || 0), 0);

  return {
    category: "us", name: company.name, code: company.symbol,
    close, prevClose, weekHigh, weekLow, weekVolume,
    ret1w: ret(close, prevClose), ret1m: ret(close, ref1m),
    ret3m: ret(close, ref3m), retYtd: ret(close, refYtd),
    ref1m, ref3m, refYtd,
    marketCap: profile.marketCap, shares: profile.shares,
    dailyOhlc: weekRows.map((r) => ({ date: toIsoDate(r.date), open: r.open, high: r.high, low: r.low, close: r.close })),
  };
}

/** Google 뉴스 RSS에서 기업명으로 검색해 최대 N건 가져오기 (날짜 필터는 검색어가 아니라 pubDate로 직접 판단) */
function fetchNewsForCompany(searchQuery, isUs, dates) {
  const q = encodeURIComponent(searchQuery);
  const url = isUs
    ? `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`
    : `https://news.google.com/rss/search?q=${q}&hl=ko&gl=KR&ceid=KR:ko`;

  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) return [];
  const xml = resp.getContentText();
  const doc = XmlService.parse(xml);
  const items = doc.getRootElement().getChild("channel").getChildren("item");

  // 그 주 월요일 00:00 ~ 금요일 24:00(=토요일 00:00) 사이에 발행된 기사만 남김
  const weekStart = addDays(dates.refFriday, -4);
  const weekEnd = addDays(dates.refFriday, 1);

  const all = items.slice(0, 100).map((item) => ({
    title: item.getChildText("title"),
    link: item.getChildText("link"),
    pubDate: item.getChildText("pubDate"),
    source: item.getChild("source") ? item.getChild("source").getText() : "",
  }));

  // 진단용: 이 회사에 대해 구글이 실제로 준 기사들의 날짜 분포를 로그로 남김 (문제 생기면 여기서 원인 확인)
  Logger.log(
    "  [" + searchQuery + "] 검색범위 " + fmtDate(weekStart) + " ~ " + fmtDate(dates.refFriday) +
    " / 원본 " + all.length + "건, 발행일 샘플: " +
    all.slice(0, 5).map((n) => n.pubDate).join(" | ")
  );

  const dateFiltered = all.filter((n) => {
    const pd = new Date(n.pubDate);
    if (isNaN(pd.getTime())) return true; // 날짜 파싱 실패 시 일단 포함 (과도한 누락 방지)
    return pd >= weekStart && pd < weekEnd;
  });
  Logger.log("    날짜필터 후 " + dateFiltered.length + "건");
  return dateFiltered;
}

// 우주항공/방산/기업 활동 관련 키워드 - 이 중 하나도 포함 안 하면 "회사명이 언급만 된" 무관한 기사로 간주
const RELEVANCE_KEYWORDS = [
  "발사", "로켓", "우주", "위성", "항공", "방산", "국방", "수주", "계약", "실적",
  "주가", "상장", "IPO", "스페이스", "발사체", "인공위성", "궤도", "우주선",
  "군사", "미사일", "드론", "무인기", "전투기", "잠수함", "레이더", "정찰",
  "space", "rocket", "satellite", "launch", "orbit", "aerospace", "defense", "nasa",
];

// 진짜 뉴스가 아닌 자동생성/단순 소식성 콘텐츠로 보이는 출처 (계속 발견되면 여기에 추가)
const LOW_QUALITY_SOURCES = ["주달", "MarketBeat", "Benzinga", "Motley Fool", "모틀리 풀", "fool.com", "Seeking Alpha", "시킹알파", "24/7 Wall St", "24/7 월스트리트"];

/** 사진 캡션성 기사, 광고/자동생성 콘텐츠, 회사명이 실제로 없는 기사, 단순 행사공지를 판별 (사유 포함) */
function classifyArticle(title, source, companyName) {
  const t = title || "";

  if (companyName) {
    const normTitle = t.replace(/\s+/g, "").toLowerCase();
    const normName = companyName.replace(/\s+/g, "").toLowerCase();
    const idx = normTitle.indexOf(normName);
    if (idx === -1) return { ok: false, reason: "회사명 미포함" };
    // "한국항공우주" vs "한국항공우주연구원"처럼, 회사명 뒤에 "연구원/대학교/협회" 등이 붙어
    // 완전히 다른 기관을 가리키는 경우를 구분
    const after = normTitle.slice(idx + normName.length, idx + normName.length + 4);
    if (/^(연구원|대학교|대학|협회|재단)/.test(after)) {
      return { ok: false, reason: "동명 기관 혼동(" + after.slice(0, 3) + ")" };
    }
  }

  if (source && LOW_QUALITY_SOURCES.some((s) => source.includes(s))) {
    return { ok: false, reason: "저품질 출처(" + source + ")" };
  }

  if (/[〈<[(]\s*.*(사진|제공)\s*[〉>\])]/.test(t)) return { ok: false, reason: "사진캡션 패턴" };
  if (/제공\)?\s*$/.test(t)) return { ok: false, reason: "사진캡션(제공 종결)" };
  if (/\(사진\)|\[사진\]/.test(t)) return { ok: false, reason: "사진캡션 표기" };

  if (/투자\s*분석\s*20\d{2}[.\-]/.test(t)) return { ok: false, reason: "자동생성 투자분석" };

  // "N min요약", "AI요약"처럼 옛날 기사를 다시 요약해 최신 날짜로 재발행하는 상품형 콘텐츠
  // (실제 사건은 오래됐는데 발행일만 최신으로 찍히는 문제의 주 원인)
  // 주의: "핵심 요약"/"이슈 요약"처럼 일반적인 편집 표현은 정상 기사이므로 제외 대상이 아님 -
  // 반드시 "min요약"/"AI요약"처럼 구체적인 상품명 패턴만 걸러냄
  if (/\|\s*\d+\s*min\s*요약/i.test(t) || /\|\s*AI\s*요약/i.test(t)) {
    return { ok: false, reason: "AI 요약 재발행 콘텐츠(날짜 신뢰 불가)" };
  }

  const isEventOnly = /세미나|설명회|박람회|컨퍼런스|간담회/.test(t);
  const hasDealKeyword = /계약|수주|공급|양해각서|MOU|제휴|투자유치|인수/.test(t);
  if (isEventOnly && !hasDealKeyword) return { ok: false, reason: "단순 행사공지" };

  // 임원/최대주주/기관 지분·보유량 변동 등 정기 공시성 알림
  if (/지분율|보유\s*비율|소유\s*주식\s*수량|주식\s*보유량|보유량\s*확대|지분\s*확대/.test(t)) {
    return { ok: false, reason: "지분 공시 알림" };
  }

  // 주가 시황/수급/공매도 등 단순 시세 언급 기사 (특징주, %상승/하락, 화살표 표기, 공매도 등)
  if (/\[특징주\]/.test(t)) return { ok: false, reason: "주가 시황 기사" };
  if (/순매수|순매도|장중수급|공매도/.test(t)) return { ok: false, reason: "주가 시황 기사" };
  if (/[↑↓]/.test(t) && /\d+(\.\d+)?%/.test(t)) return { ok: false, reason: "주가 시황 기사" };
  if (/주가/.test(t) && /(상승|하락|급등|급락|마감|보합|전망)/.test(t)) return { ok: false, reason: "주가 시황 기사" };

  // 한글 주가/투자판단 중심 기사 (사업 뉴스가 아니라 매수·매도 판단이 중심인 기사)
  const koInvestKeywords = /목표주가|저평가|고평가|투자\s*추천|상승\s*여력|하락\s*가능성|적정\s*가치|밸류에이션|증권사\s*전망|애널리스트\s*의견|투자\s*적기|포트폴리오|종목\s*추천|매수\s*(의견|추천|시점)|매도\s*(의견|추천|시점)/;
  if (koInvestKeywords.test(t)) return { ok: false, reason: "한글 주가/투자판단 기사" };

  // 영문 시황/기관 보유 관련 자동생성성 기사 (예: "Stock Up 5.1%", "Boosts Stake in Rocket Lab")
  const lowerT = t.toLowerCase();
  const enPriceMove = /\bstock\s*(is\s*|has\s*)?(up|down)\b|\d+%\s*(down|lower|off)?\s*from\s*(its\s*)?(high|peak|all-time)|share\s*price|price\s*target|target\s*price|\bstake\b|\bholdings?\b|13f|hedge\s*fund|short\s*(interest|position|seller)|institutional\s*investor|after-?\s*hours|pre-?\s*market|post-?\s*market|should\s*you\s*buy|\bbuy\b|\bsell\b|strong\s*buy|hold\s*rating|analyst\s*rating|analyst\s*(research\s*)?calls?|top\s*wall\s*street|undervalued|overvalued|\bvaluation\b|\bupside\b|\bdownside\b|market\s*cap\s*analysis|\bp\/e\b|\bp\/s\b|price-to-sales|price-to-fc|fair\s*value|investor\s*recommendation|\bportfolio\b|\bisa\b|\betf\b|best\s*stock|growth\s*stock|stock\s*forecast|still\s*buying/;
  if (enPriceMove.test(lowerT)) return { ok: false, reason: "영문 주가/투자판단 기사" };

  // 막연한 투자자 대상 낚시성 제목 (예: "Huge News for Rocket Lab Investors")
  if (/investors?/.test(lowerT) && /\b(huge|massive|big)\s*(news|deal|move)\b/.test(lowerT)) {
    return { ok: false, reason: "막연한 투자자 대상 낚시성 기사" };
  }

  // 영문 급등락 표현("surges 12%", "Rocket Lab...soar" 등) - 등락 동사와 퍼센트 수치가 함께 나오면 시황 기사로 간주
  const enMoveVerb = /\b(surge|surges|surged|soar|soars|soared|jump|jumps|jumped|plunge|plunges|plunged|tumble|tumbles|tumbled|rally|rallies|rallied|rise|rises|rose|fall|falls|fell|climb|climbs|climbed|drop|drops|dropped|slide|slides|slid|gain|gains|gained)\b/;
  if (enMoveVerb.test(lowerT) && /\d+(\.\d+)?%/.test(t)) return { ok: false, reason: "영문 급등락 시황 기사" };

  // 인물 선정/수상성 기사 (예: "OOO 대표, 세계 위성산업 40인 리더 선정…")
  const hasTitleWord = /대표|사장|CEO|회장|이사/.test(t);
  const hasAwardWord = /선정|수상/.test(t);
  if (hasTitleWord && hasAwardWord) return { ok: false, reason: "인물 선정/수상 기사" };

  // 제목이 지나치게 짧고 약어 위주라 내용을 유추하기 힘든 경우 (예: "MRV-MEP 임무 - SpaceX")
  const coreTitle = t.replace(/\s*-\s*[^-]+$/, "").trim();
  const words = coreTitle.split(/\s+/).filter(Boolean);
  const hasAcronym = /^[A-Z0-9]{2,}(-[A-Z0-9]+)*$/.test(words[0] || "");
  if (words.length <= 3 && hasAcronym) return { ok: false, reason: "제목이 너무 간결해 내용 유추 어려움" };

  if (t.replace(/\s/g, "").length < 8) return { ok: false, reason: "제목 너무 짧음" };

  const lower = t.toLowerCase();
  const hasKeyword = RELEVANCE_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
  if (!hasKeyword) return { ok: false, reason: "관련 키워드 없음" };

  return { ok: true, reason: "" };
}

function isQualityArticle(title, source, companyName) {
  return classifyArticle(title, source, companyName).ok;
}

/** 영문 제목을 한국어로 번역 (Apps Script 내장 번역 기능, 별도 API 키 불필요) */
function translateIfNeeded(title, isUs) {
  if (!isUs) return title;
  try {
    return LanguageApp.translate(title, "en", "ko");
  } catch (e) {
    return title; // 번역 실패 시 원문 그대로
  }
}

/** 제목을 비교 가능한 토큰 집합으로 변환 (조사/특수문자 제거, 짧은 토큰 제외) */
function titleTokens(title) {
  const cleaned = title
    .replace(/[\[\]()|"'"“”‘’·,.:\-–—]/g, " ")
    .toLowerCase();
  return new Set(cleaned.split(/\s+/).filter((t) => t.length >= 2));
}

// 두 제목이 같은 소식을 다루는지 판단: 겹치는 단어 수를 "더 짧은 쪽" 제목 기준으로 계산
// (Jaccard는 제목 길이가 서로 크게 다르면 실제로 같은 얘기라도 점수가 낮게 나오는 약점이 있어 overlap coefficient 사용)
function overlapCoefficient(setA, setB) {
  let inter = 0;
  setA.forEach((t) => { if (setB.has(t)) inter++; });
  const minSize = Math.min(setA.size, setB.size);
  return minSize === 0 ? 0 : inter / minSize;
}

/**
 * 같은 소식을 다룬 기사들끼리 묶어서(제목 유사도 기준), 언론사 수가 많은 순으로 정렬한
 * 상위 topN개 "주제"를 반환. 각 주제는 대표 기사 1건 + 몇 건이 묶였는지(count)를 가짐.
 * isUs가 true면 대표 제목을 한국어로 번역해서 반환.
 */
function clusterNews(items, topN, isUs, companyName) {
  const filtered = items.filter((item) => isQualityArticle(item.title, item.source, companyName));

  // 같은 소식(동일 URL, 사실상 동일한 제목, 재배포본)만 하나로 묶고, 서로 다른 소식은 절대 합치지 않도록
  // 임계값을 엄격하게(0.72) 잡음 - 예전 0.5는 실제로 다른 기사 3개 중 2개가 잘못 하나로 합쳐지는 문제가 있었음
  const SIMILARITY_THRESHOLD = 0.72;
  const clusters = []; // { tokens, items: [...] }

  filtered.forEach((item) => {
    // 완전히 같은 URL이면 무조건 같은 소식 (언론사 재배포 등)
    const sameUrl = clusters.find((c) => c.items.some((x) => x.link === item.link));
    if (sameUrl) { sameUrl.items.push(item); return; }

    const tokens = titleTokens(item.title);
    let matched = null;
    for (const c of clusters) {
      if (overlapCoefficient(tokens, c.tokens) >= SIMILARITY_THRESHOLD) { matched = c; break; }
    }
    if (matched) {
      matched.items.push(item);
    } else {
      clusters.push({ tokens, items: [item] });
    }
  });

  // 언론사 수(관련도 proxy) 내림차순, 동률이면 최신순
  clusters.sort((a, b) => {
    if (b.items.length !== a.items.length) return b.items.length - a.items.length;
    return new Date(b.items[0].pubDate) - new Date(a.items[0].pubDate);
  });

  Logger.log(
    "    관련성필터 후 " + filtered.length + "건 → 중복제거(같은 소식 묶기) 후 " + clusters.length + "개 주제 → 최종 " +
    Math.min(topN, clusters.length) + "개 표시"
  );

  return clusters.slice(0, topN).map((c) => ({
    title: translateIfNeeded(c.items[0].title, isUs),
    titleOriginal: c.items[0].title,
    link: c.items[0].link,
    pubDate: c.items[0].pubDate,
    source: c.items[0].source,
    outletCount: c.items.length,
  }));
}

/** 시트 준비 (없으면 생성, 있어도 비어있으면 헤더 추가) */
function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  return sheet;
}

/** A열(report_date)이 targetDate와 일치하는 행을 전부 삭제 (같은 날 재실행해도 중복이 안 쌓이게) */
function removeRowsForDate(sheet, targetDate) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  // 아래에서 위로 지워야 행 번호가 안 꼬임
  for (let i = values.length - 1; i >= 0; i--) {
    const cellDate = values[i][0] instanceof Date
      ? Utilities.formatDate(values[i][0], "Asia/Seoul", "yyyy-MM-dd")
      : String(values[i][0]);
    if (cellDate === targetDate) {
      sheet.deleteRow(i + 2); // 헤더가 1행이므로 +2
    }
  }
}

/** 메인 함수: 매주 월요일 자동 실행 (수동 테스트 시엔 assumeMonday=true로 호출하면 요일 무관하게 정확한 주간 범위로 테스트 가능) */
/** 실제 환율(USD->KRW)을 무료 API(Frankfurter, 유럽중앙은행 기준)에서 조회. 실패 시 null 반환 */
function fetchUsdKrwRateForReport() {
  try {
    const resp = UrlFetchApp.fetch("https://api.frankfurter.app/latest?from=USD&to=KRW", { muteHttpExceptions: true });
    const data = JSON.parse(resp.getContentText());
    if (!data.rates || !data.rates.KRW) return { rate: null, date: null };
    return { rate: Number(data.rates.KRW), date: data.date };
  } catch (e) {
    Logger.log("환율 조회 실패: " + e);
    return { rate: null, date: null };
  }
}

function updateWeeklyReport(assumeMonday) {
  const dates = getReportDates(assumeMonday);

  const pricesSheet = getOrCreateSheet(WEEKLY_PRICES_SHEET, [
    "report_date", "ref_friday", "prev_friday", "category", "name", "code",
    "close", "prev_close", "week_high", "week_low",
    "ret_1w", "ret_1m", "ret_3m", "ret_ytd", "ref_1m_close", "ref_3m_close", "ref_ytd_close",
    "market_cap", "shares", "week_volume", "fx_usdkrw", "fx_date",
  ]);
  const newsSheet = getOrCreateSheet(WEEKLY_NEWS_SHEET, [
    "report_date", "name", "title", "title_original", "source", "pub_date", "link", "outlet_count",
  ]);
  const chartSheet = getOrCreateSheet(WEEKLY_CHART_SHEET, [
    "report_date", "code", "date", "open", "high", "low", "close",
  ]);

  // 같은 report_date로 여러 번 실행해도 중복이 쌓이지 않도록, 새로 쓰기 전에 오늘자 기존 행을 먼저 삭제
  removeRowsForDate(pricesSheet, dates.reportDate);
  removeRowsForDate(newsSheet, dates.reportDate);
  removeRowsForDate(chartSheet, dates.reportDate);

  // 환율은 "조회 시점"이 아니라 "이 리포트를 생성한 시점"에 딱 한 번 가져와서 모든 행에 동일하게 저장
  // (그래야 화면에서 몇 주 지난 리포트를 봐도 그때 당시 환율이 그대로 표시됨)
  const fx = fetchUsdKrwRateForReport();

  const rows = [];

  INDICES.forEach((idx) => {
    rows.push(buildDomesticRow(idx, dates, true));
    Utilities.sleep(150);
  });

  DOMESTIC_COMPANIES.forEach((c) => {
    rows.push(buildDomesticRow(c, dates, false));
    Utilities.sleep(150);
  });

  US_COMPANIES.forEach((c) => {
    rows.push(buildUsRow(c, dates));
    Utilities.sleep(150);
  });

  rows.forEach((r) => {
    pricesSheet.appendRow([
      dates.reportDate, dates.refFridayStr, dates.prevFridayStr, r.category, r.name, r.code,
      r.close, r.prevClose, r.weekHigh, r.weekLow,
      r.ret1w, r.ret1m, r.ret3m, r.retYtd, r.ref1m, r.ref3m, r.refYtd,
      r.marketCap, r.shares, r.weekVolume, fx.rate, fx.date,
    ]);
    (r.dailyOhlc || []).forEach((d) => {
      chartSheet.appendRow([dates.reportDate, r.code, d.date, d.open, d.high, d.low, d.close]);
    });
  });

  // 뉴스: 지수를 제외한 18개 기업, 그 주 전체에서 최대 30건 수집 후 주제별로 묶어 상위 3개만 저장
  const newsTargets = [...DOMESTIC_COMPANIES, ...US_COMPANIES];
  newsTargets.forEach((c) => {
    const isUs = !!c.symbol;
    const rawItems = fetchNewsForCompany(c.newsQuery || c.name, isUs, dates);
    const qualityItems = rawItems.filter((item) => isQualityArticle(item.title, item.source, c.name));
    const topTopics = clusterNews(rawItems, 3, isUs, c.name);
    Logger.log(
      c.name + ": 이번주 발행 " + rawItems.length + "건 → 품질필터 통과 " + qualityItems.length +
      "건 → 주제 " + topTopics.length + "개로 압축"
    );
    topTopics.forEach((n) => {
      newsSheet.appendRow([dates.reportDate, c.name, n.title, n.titleOriginal, n.source, n.pubDate, n.link, n.outletCount]);
    });
    Utilities.sleep(150);
  });

  Logger.log("주간 리포트 업데이트 완료: " + dates.reportDate + " (기준 금요일 " + dates.refFridayStr + ")");
}

/** (선택) 검증용: 국내 종목 하나만 테스트 (월요일이라고 가정하고 계산) */
function testDomestic() {
  const dates = getReportDates(true);
  Logger.log(JSON.stringify(dates));
  Logger.log(JSON.stringify(buildDomesticRow(DOMESTIC_COMPANIES[0], dates, false)));
}

/** (선택) 검증용: 해외 종목 하나만 테스트 (월요일이라고 가정하고 계산) */
function testUs() {
  const dates = getReportDates(true);
  Logger.log(JSON.stringify(buildUsRow(US_COMPANIES[0], dates)));
}

/**
 * (선택) 검증용: 특정 회사 하나의 뉴스 필터링 과정을 전부 로그로 확인
 * 예: testNewsDebug("이노스페이스", false) 또는 testNewsDebug("컨텍", false, "컨텍 위성")
 * searchQuery를 생략하면 name으로 검색합니다.
 */
function testNewsDebug(name, isUs, searchQuery) {
  const dates = getReportDates(true);
  Logger.log("검색범위: " + fmtDate(addDays(dates.refFriday, -4)) + " ~ " + dates.refFridayStr);

  const raw = fetchNewsForCompany(searchQuery || name, isUs, dates);
  Logger.log("이번주 발행 " + raw.length + "건");

  raw.forEach((item, i) => {
    const result = classifyArticle(item.title, item.source, name);
    Logger.log(
      (i + 1) + ". [" + (result.ok ? "통과" : "제외:" + result.reason) + "] " +
      item.title + " (" + item.source + ", " + item.pubDate + ")"
    );
  });

  const topTopics = clusterNews(raw, 3, isUs, name);
  Logger.log("최종 주제 " + topTopics.length + "개: " + JSON.stringify(topTopics));
}

/** (선택) 수동 테스트용: 오늘이 무슨 요일이든 "오늘이 월요일"이라 가정하고 실제로 시트까지 채워서 확인 */
function testUpdateWeeklyReport() {
  updateWeeklyReport(true);
}

/** (선택) 검증용: 컨텍 뉴스 필터링 테스트 (검색어는 "컨텍 위성", 필터링은 "컨텍" 이름으로) */
function debugKontec() {
  testNewsDebug("컨텍", false, "컨텍 위성");
}

/* ============================================================
 * 국내 14종목 + 해외 3종목 15분 간격 장중 시세 수집
 * (이노스페이스는 daily 스크립트가 이미 5분 간격으로 별도 수집 중이라 여기선 제외)
 * ============================================================ */

/** 최초 1회만 실행: 15분마다 실행되는 트리거 등록 */
function createWeeklyIntradayTrigger() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === "updateWeeklyIntraday") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("updateWeeklyIntraday")
    .timeBased()
    .everyMinutes(15)
    .create();
  Logger.log("주간 장중수집 트리거 등록 완료: 15분마다 실행 (국내/해외 정규장 시간에만 실제 기록됨)");
}

/** 지금이 국내 정규장 시간(평일 09:00~15:30 KST)인지 */
function isDomesticMarketOpenNow() {
  const now = new Date();
  const kst = Utilities.formatDate(now, "Asia/Seoul", "u HH:mm");
  const [dowStr, hm] = kst.split(" ");
  const dow = Number(dowStr);
  const [h, m] = hm.split(":").map(Number);
  const mins = h * 60 + m;
  return dow >= 1 && dow <= 5 && mins >= 9 * 60 && mins <= 15 * 60 + 30;
}

/**
 * 지금이 미국 정규장 시간(대략 22:00~06:00 KST, 서머타임 변동을 감안해 여유있게 잡음)인지.
 * 22:00~24:00 구간은 그날 KST 요일이 평일이면 미국장(그날 아침), 00:00~06:00 구간은
 * 전날(KST 기준 하루 전) 요일이 평일이면 미국장(전날 밤이 이어지는 것)으로 판단.
 */
function isUsMarketOpenApprox() {
  const now = new Date();
  const kst = Utilities.formatDate(now, "Asia/Seoul", "u HH:mm");
  const [dowStr, hm] = kst.split(" ");
  const dow = Number(dowStr);
  const [h, m] = hm.split(":").map(Number);
  const mins = h * 60 + m;

  if (mins >= 22 * 60) {
    return dow >= 1 && dow <= 5;
  }
  if (mins < 6 * 60) {
    const prevDow = dow === 1 ? 7 : dow - 1;
    return prevDow >= 1 && prevDow <= 5;
  }
  return false;
}

/** 15분마다 실행되는 메인 함수 */
function updateWeeklyIntraday() {
  if (isDomesticMarketOpenNow()) collectDomesticIntraday();
  if (isUsMarketOpenApprox()) collectUsIntraday();
}

function getOrCreateWeeklyIntradaySheet() {
  return getOrCreateSheet(WEEKLY_INTRADAY_SHEET, [
    "거래일", "측정시각", "종목코드", "기업명", "시장", "현지시간", "한국시간",
    "주가", "통화", "출처", "수집시각", "간격",
  ]);
}

/** 국내 종목 1건의 현재가만 조회 (fetchMarketCapShares와 같은 API, 가격만 사용) */
function fetchCurrentDomesticPrice(code) {
  const token = getAccessToken();
  const props = PropertiesService.getScriptProperties();
  const appKey = props.getProperty("KIS_APP_KEY");
  const appSecret = props.getProperty("KIS_APP_SECRET");

  const url = KIS_DOMAIN + "/uapi/domestic-stock/v1/quotations/inquire-price" +
    "?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=" + code;

  const resp = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      "content-type": "application/json; charset=utf-8",
      authorization: "Bearer " + token,
      appkey: appKey, appsecret: appSecret,
      tr_id: "FHKST01010100", custtype: "P",
    },
    muteHttpExceptions: true,
  });
  const data = JSON.parse(resp.getContentText());
  if (data.rt_cd !== "0" || !data.output) return null;
  return Number(data.output.stck_prpr) || null;
}

function collectDomesticIntraday() {
  const sheet = getOrCreateWeeklyIntradaySheet();
  const now = new Date();
  const dateStr = Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd");
  const timeStr = Utilities.formatDate(now, "Asia/Seoul", "HH:mm");
  const collectedAt = Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

  DOMESTIC_COMPANIES.filter((c) => c.code !== STOCK_CODE).forEach((c) => {
    const price = fetchCurrentDomesticPrice(c.code);
    if (price != null) {
      sheet.appendRow([dateStr, timeStr, c.code, c.name, "KOSDAQ", timeStr, timeStr, price, "KRW", "KIS", collectedAt, "15분"]);
    }
    Utilities.sleep(120);
  });
}

function collectUsIntraday() {
  const sheet = getOrCreateWeeklyIntradaySheet();
  const now = new Date();
  const etDateStr = Utilities.formatDate(now, "America/New_York", "yyyy-MM-dd");
  const etTimeStr = Utilities.formatDate(now, "America/New_York", "HH:mm");
  const kstTimeStr = Utilities.formatDate(now, "Asia/Seoul", "HH:mm");
  const collectedAt = Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");

  US_COMPANIES.forEach((c) => {
    const quote = fetchFinnhubQuote(c.symbol);
    if (quote && quote.c) {
      sheet.appendRow([etDateStr, etTimeStr, c.symbol, c.name, "NASDAQ", etTimeStr, kstTimeStr, quote.c, "USD", "Finnhub", collectedAt, "15분"]);
    }
    Utilities.sleep(120);
  });
}

/** (선택) 검증용: 지금 당장 한 번 실행해서 정상 수집되는지 확인 (장중 여부와 상관없이 강제 실행) */
function testWeeklyIntradayForce() {
  collectDomesticIntraday();
  collectUsIntraday();
  Logger.log("강제 수집 완료 (테스트용 - 실제 자동 실행은 장중에만 기록됩니다)");
}
