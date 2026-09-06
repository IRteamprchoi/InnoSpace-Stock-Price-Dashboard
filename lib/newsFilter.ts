export function isLowQuality(title: string): boolean {
  const t = title.trim();
  if (/\[?(포토뉴스|현장포토|포토슬라이드|포토|PHOTO|사진|화보|이함사진|영상)\]?/i.test(t)) return true;
  if (/^\[포토\]|\(사진\)|\(화보사진\)|\(영상\)/.test(t)) return true;
  if (/주가.{0,4}(올랐다|상승했다|급등했다)\.?$/.test(t)) return true;

  // "~하는 [이름] [직함]" 형태의 무태그 사진 캡션 (뉴스1/뉴시스 등 통신사 특유 형식)
  if (/하는\s+[가-힣]{2,4}\s+.{0,20}(대표이사|대표|사장|회장|장관|위원장|본부장|실장|이사장)$/.test(t)) return true;

  // 단순 행사/협약 개최 사실만 전달 (내용 없는 행사 안내성 기사)
  const isCeremonial = /(업무협약식|협약식|체결식|기념식|간담회|출범식|발대식|시무식|종무식)/.test(t);
  const majorEvent2 = /(M&A|인수|합병|매각|경영권|지분|최대주주|사업\s*전략|구조조정|상장|분할|수주|계약|투자)/.test(t);
  if (isCeremonial && !majorEvent2) return true;

  const isPersonnel = /(임원\s*인사|정기\s*인사|승진|선임|취임|조직개편|신규\s*임원|대표이사\s*인사|인사\s*발령|^인사$|\[인사\])/.test(t);
  const majorEvent = /(M&A|인수|합병|매각|경영권|지분|최대주주|사업\s*전략|구조조정|상장|분할)/.test(t);
  if (isPersonnel && !majorEvent) return true;
  return false;
}
