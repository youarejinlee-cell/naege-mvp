import { Entry, EntryCategory } from "../types/domain";

export const entryCategoryOptions: Array<{ key: EntryCategory; label: string; pattern: RegExp }> = [
  { key: "work", label: "일", pattern: /업무|회의|마감|회사|프로젝트|보고|성과|출근|퇴근|상사|동료|커리어|일정|할 일|해야 할|해내|처리|기획|자료|메일|발표|일 생각|일이 많|일을|일에서|일 때문에|일 관련|일 하|일하는/ },
  { key: "relationships", label: "인간관계", pattern: /친구|사람|관계|대화|모임|동료|연락|약속|눈치|사회|사이|말 한마디|칭찬|비교|부러/ },
  { key: "love", label: "사랑", pattern: /연애|사랑|답장|데이트|상대|애인|남자친구|여자친구|썸|이별|만남|좋아하는 사람|좋아해|고백|마음이 흔들/ },
  { key: "family", label: "가족", pattern: /가족|엄마|아빠|부모|동생|언니|오빠|누나|형|할머니|할아버지|집안|가정/ },
  { key: "dream", label: "꿈", pattern: /꿈|목표|미래|하고 싶|되고 싶|계획|성장|공부|배우|도전|이루|준비|욕망|바라는/ },
  { key: "taste", label: "취향", pattern: /취향|음악|노래|영화|책|쇼핑|먹|카페|쇼츠|드라마|음식|맛|빵|커피|옷|물건|콘텐츠|좋아하는 것/ },
  { key: "habit", label: "습관", pattern: /습관|루틴|반복|매일|정리|미루|기록|청소|일찍|늦게|잠들|핸드폰|스크롤|계속|자주|오늘도/ },
  { key: "attitude", label: "태도", pattern: /태도|마음가짐|반응|대처|기준|완벽|노력|버티|피하|마주|선택|판단|집중|조절|극복|받아들이|해보려|하려고/ },
  { key: "health", label: "건강", pattern: /건강|몸|피곤|잠|아픔|컨디션|병원|두통|소화|산책|쉬|휴식|스트레칭|밥|운동|아침|수면/ },
  { key: "other", label: "기타", pattern: /$^/ }
];

export const entryCategoryLabels = entryCategoryOptions.reduce<Record<EntryCategory, string>>((acc, option) => {
  acc[option.key] = option.label;
  return acc;
}, {} as Record<EntryCategory, string>);

export const defaultEntryCategory: EntryCategory = "other";

export function detectEntryCategory(text: string): EntryCategory | null {
  const normalized = text.trim();
  if (!normalized) return null;
  return entryCategoryOptions.find((option) => option.pattern.test(normalized))?.key || null;
}

export function suggestEntryCategory(text: string): EntryCategory {
  return detectEntryCategory(text) || defaultEntryCategory;
}

export function categoryForEntry(entry: Entry): EntryCategory | null {
  return entry.category || detectEntryCategory(entry.text) || defaultEntryCategory;
}
