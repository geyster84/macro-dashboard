import { Indicator } from "./indicators";

export type TodayIndicatorInfo = {
  indicator: Indicator;
  releaseDate: string;
  latestValue: number;
  previousValue: number;
  changePercent: number;
  searchKeywords: string[];
};

// 지표별 네이버 검색 키워드 매핑
// (한국 언론사가 자주 쓰는 표현으로)
const SEARCH_KEYWORDS: Record<string, string[]> = {
  // Crisis Watch
  BAMLH0A0HYM2: ["하이일드 스프레드", "정크본드"],
  NFCI: ["금융여건지수", "시카고 연은"],
  STLFSI4: ["금융스트레스", "세인트루이스 연은"],
  T10Y3M: ["장단기 금리차", "장단기 스프레드", "10년 3개월"],
  DTWEXBGS: ["달러인덱스", "달러 강세", "달러화"],
  DFII10: ["TIPS 금리", "실질금리"],
  WRESBAL: ["은행 준비금", "Fed 유동성"],
  BAA10Y: ["투자등급 스프레드", "회사채 스프레드"],
  DCOILWTICO: ["WTI", "국제유가", "원유"],
  BUSLOANS: ["기업대출", "상업대출"],

  // 성장/생산
  A191RL1Q225SBEA: ["GDP", "경제성장률"],
  INDPRO: ["산업생산", "산업생산지수"],
  TCU: ["가동률", "공장 가동률"],
  DGORDER: ["내구재 주문", "내구재"],

  // 고용
  UNRATE: ["실업률", "미국 고용"],
  PAYEMS: ["비농업 고용", "고용 보고서", "신규 일자리"],
  ICSA: ["실업수당", "신규 실업수당"],
  CES0500000003: ["시간당 임금", "임금 상승률"],
  CIVPART: ["경제활동참가율"],

  // 물가
  CPIAUCSL: ["CPI", "소비자물가", "소비자물가지수", "인플레이션"],
  CPILFESL: ["근원 CPI", "근원 소비자물가"],
  PCEPI: ["PCE", "개인소비지출", "Fed 선호 물가"],
  PCEPILFE: ["근원 PCE", "근원 개인소비지출"],
  PPIACO: ["PPI", "생산자물가"],

  // 금리/통화
  DFF: ["기준금리", "연방기금금리", "Fed 금리"],
  DGS10: ["10년물 국채", "미국 국채금리"],
  DGS2: ["2년물 국채"],
  T10Y2Y: ["10년 2년 스프레드", "장단기 금리"],
  M2SL: ["M2 통화량", "통화공급"],

  // 소비/심리
  RSAFS: ["소매판매", "미국 소비"],
  PCE: ["개인소비지출", "PCE"],
  UMCSENT: ["소비자심리", "미시간 소비자심리"],

  // 주택/시장
  HOUST: ["신규 주택착공", "주택착공"],
  CSUSHPISA: ["케이스실러", "주택가격지수"],
  VIXCLS: ["VIX", "공포지수", "변동성지수"],
};

/**
 * 오늘(또는 최근 N일 이내) 발표된 지표인지 판단
 */
export function isRecentlyReleased(releaseDate: string, daysWindow = 1): boolean {
  if (!releaseDate) return false;
  const release = new Date(releaseDate);
  const now = new Date();
  const diffMs = now.getTime() - release.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= daysWindow;
}

/**
 * 지표 ID로 검색 키워드 가져오기
 */
export function getSearchKeywords(seriesId: string): string[] {
  return SEARCH_KEYWORDS[seriesId] || [];
}

/**
 * 여러 지표의 키워드를 합쳐서 네이버 검색용 쿼리 생성
 * (가장 대표적인 키워드 1개씩만 사용)
 */
export function buildNewsQuery(indicators: Indicator[]): string {
  const keywords = indicators
    .map((ind) => SEARCH_KEYWORDS[ind.seriesId]?.[0])
    .filter(Boolean)
    .slice(0, 3); // 최대 3개

  if (keywords.length === 0) return "미국 경제";
  return keywords.join(" ");
}

/**
 * 변화율 계산 (현재값 vs 이전값)
 */
export function calculateChange(current: number, previous: number): number {
  if (!previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}