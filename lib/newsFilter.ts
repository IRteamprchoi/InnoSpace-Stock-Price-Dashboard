// 저품질 기사(포토뉴스, 단순 시황, 단순 인사) 판별 - /monthly, /weekly 공통 사용
export function isLowQuality(title: string): boolean {
  const t = title.trim();
  if (/\[?(포토뉴스|현장포토|포토슬라이드|포토|PHOTO|사진|화보|이함사진|영상)\]?/i.test(t)) return true;
  if (/^\[포토\]|\(사진\)|\(화보사진\)|\(영상\)/.test(t)) return true;
  if (/주가.{0,4}(올랐다|상승했다|급등했다)\.?$/.test(t)) return true;
  const isPersonnel = /(임원\s*인사|정기\s*인사|승진|선임|취임|조직개편|신규\s*임원|대표이사\s*인사|인사\s*발령|^인사$|\[인사\])/.test(t);
  const majorEvent = /(M&A|인수|합병|매각|경영권|지분|최대주주|사업\s*전략|구조조정|상장|분할)/.test(t);
  if (isPersonnel && !majorEvent) return true;
  return false;
}

export function dedupeByLink<T extends { link: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.link)) continue;
    seen.add(item.link);
    out.push(item);
  }
  return out;
}
