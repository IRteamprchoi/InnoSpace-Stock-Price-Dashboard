// 실제 환율(USD->KRW)을 무료/키 없는 공개 API(Frankfurter, 유럽중앙은행 기준)에서 조회.
// 실패 시에도 임의의 고정 환율을 코드에 넣지 않고, null을 반환해서 화면에서 "환율 조회 실패"로
// 명확히 표시되도록 함 (조용히 틀린 값을 쓰지 않기 위함).
export type FxRate = {
  usdToKrw: number;
  asOfDate: string; // YYYY-MM-DD
};

export async function fetchUsdKrwRate(): Promise<FxRate | null> {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=KRW", {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data?.rates?.KRW;
    if (!rate) return null;
    return { usdToKrw: Number(rate), asOfDate: data.date };
  } catch (e) {
    console.error("환율 조회 실패", e);
    return null;
  }
}
