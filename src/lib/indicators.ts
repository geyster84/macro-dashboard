// 35개 매크로 지표 정의

export interface Indicator {
  seriesId: string;
  displayName: string;
  category: string;
  // 위험 기준값 (선택)
  warningThreshold?: number;  // 노란 점선 (경계)
  dangerThreshold?: number;   // 빨간 점선 (위험)
  // true면 "값이 낮을수록 위험" (예: 은행 준비금)
  invertSignal?: boolean;
  // "yoy"면 지수 값을 전년比 %로 변환해서 표시 (CPI, M2 등)
  transform?: "yoy";
}

// 🚨 Crisis Watch — 위기 감지 지표 10개
export const CRISIS_INDICATORS: Indicator[] = [
  {
    seriesId: "BAMLH0A0HYM2",
    displayName: "하이일드 스프레드",
    category: "Credit",
    warningThreshold: 6,   // 경계: 6% (역사적 평균선)
    dangerThreshold: 8,    // 위험: 8% (침체 직전 수준)
  },
  {
    seriesId: "NFCI",
    displayName: "Chicago Fed 금융여건지수",
    category: "Financial Stress",
    warningThreshold: 0,   // 경계: 0 (긴축 진입)
    dangerThreshold: 0.5,  // 위험: 0.5 (강한 긴축)
  },
  {
    seriesId: "STLFSI4",
    displayName: "St. Louis Fed 금융스트레스지수",
    category: "Financial Stress",
    warningThreshold: 1,   // 경계: 1
    dangerThreshold: 2,    // 위험: 2 (2008/2020 수준)
  },
  {
    seriesId: "T10Y3M",
    displayName: "10Y-3M 스프레드 (침체 신호)",
    category: "Yield Curve",
    warningThreshold: 0,    // 경계: 0% (역전 임박)
    dangerThreshold: -0.5,  // 위험: -0.5% (확실한 역전)
    invertSignal: true,     // 낮을수록 위험
  },
  {
    seriesId: "DTWEXBGS",
    displayName: "달러 인덱스 (광역)",
    category: "Currency",
    warningThreshold: 125,  // 경계: 125
    dangerThreshold: 130,   // 위험: 130 (강달러 위기)
  },
  {
    seriesId: "DFII10",
    displayName: "10Y TIPS (실질금리)",
    category: "Real Rate",
    warningThreshold: 2,    // 경계: 2%
    dangerThreshold: 2.5,   // 위험: 2.5% (긴축 부담)
  },
  {
    seriesId: "WRESBAL",
    displayName: "은행 준비금",
    category: "Liquidity",
    warningThreshold: 3000000,  // 경계: 3조 (유동성 부족 우려)
    dangerThreshold: 2500000,   // 위험: 2.5조
    invertSignal: true,         // 낮을수록 위험
  },
  {
    seriesId: "BAA10Y",
    displayName: "투자등급 스프레드 (BAA-10Y)",
    category: "Credit",
    warningThreshold: 2.5,  // 경계: 2.5%
    dangerThreshold: 3.5,   // 위험: 3.5%
  },
  {
    seriesId: "DCOILWTICO",
    displayName: "WTI 원유",
    category: "Geopolitical",
    warningThreshold: 100,  // 경계: 100달러
    dangerThreshold: 120,   // 위험: 120달러 (스태그플레이션 우려)
  },
  {
    seriesId: "BUSLOANS",
    displayName: "상업·산업 대출",
    category: "Credit",
    invertSignal: true,  // 낮을수록 위험 (대출 감소 = 침체)
  },
];

// 📊 Macro Dashboard — 거시경제 지표 25개
export const MACRO_INDICATORS: Indicator[] = [
  // 성장/생산
  {
    seriesId: "A191RL1Q225SBEA",
    displayName: "실질 GDP 성장률",
    category: "성장/생산",
    warningThreshold: 1,    // 경계: 1% (저성장)
    dangerThreshold: 0,     // 위험: 0% (역성장)
    invertSignal: true,     // 낮을수록 위험
  },
  {
    seriesId: "INDPRO",
    displayName: "산업생산지수",
    category: "성장/생산",
    // 절대수준 기준 어려움 - 추세로 판단
  },
  {
    seriesId: "TCU",
    displayName: "설비가동률",
    category: "성장/생산",
    warningThreshold: 76,   // 경계: 76%
    dangerThreshold: 73,    // 위험: 73% (침체 수준)
    invertSignal: true,
  },
  {
    seriesId: "DGORDER",
    displayName: "내구재 주문",
    category: "성장/생산",
    // 절대수준 기준 어려움
  },

  // 고용
  {
    seriesId: "UNRATE",
    displayName: "실업률",
    category: "고용",
    warningThreshold: 5,    // 경계: 5%
    dangerThreshold: 7,     // 위험: 7%
  },
  {
    seriesId: "PAYEMS",
    displayName: "비농업 고용",
    category: "고용",
    invertSignal: true,
  },
  {
    seriesId: "ICSA",
    displayName: "신규 실업수당 청구",
    category: "고용",
    warningThreshold: 350000,  // 경계: 35만건
    dangerThreshold: 450000,   // 위험: 45만건
  },
  {
    seriesId: "CES0500000003",
    displayName: "시간당 평균임금",
    category: "고용",
  },
  {
    seriesId: "CIVPART",
    displayName: "경제활동참가율",
    category: "고용",
    warningThreshold: 62,
    dangerThreshold: 60,
    invertSignal: true,
  },

  // 물가
  {
    seriesId: "CPIAUCSL",
    displayName: "CPI (Headline)",
    category: "물가",
    transform: "yoy",       // 전년比 %로 표시
    warningThreshold: 4,    // 경계: 4%
    dangerThreshold: 6,     // 위험: 6%
  },
  {
    seriesId: "CPILFESL",
    displayName: "Core CPI",
    category: "물가",
    transform: "yoy",
    warningThreshold: 4,    // 경계: 4%
    dangerThreshold: 5,     // 위험: 5%
  },
  {
    seriesId: "PCEPI",
    displayName: "PCE Price Index",
    category: "물가",
    transform: "yoy",
    warningThreshold: 4,    // 경계: 4%
    dangerThreshold: 6,     // 위험: 6%
  },
  {
    seriesId: "PCEPILFE",
    displayName: "Core PCE",
    category: "물가",
    transform: "yoy",
    warningThreshold: 3.5,  // 경계: 3.5%
    dangerThreshold: 5,     // 위험: 5%
  },
  {
    seriesId: "PPIACO",
    displayName: "PPI (생산자물가)",
    category: "물가",
    transform: "yoy",
    warningThreshold: 6,    // 경계: 6%
    dangerThreshold: 10,    // 위험: 10%
  },

  // 금리/통화
  {
    seriesId: "DFF",
    displayName: "연방기금금리",
    category: "금리/통화",
    warningThreshold: 5,    // 경계: 5% (긴축)
    dangerThreshold: 6,     // 위험: 6% (강한 긴축)
  },
  {
    seriesId: "DGS10",
    displayName: "10년물 국채금리",
    category: "금리/통화",
    warningThreshold: 4.5,
    dangerThreshold: 5.5,
  },
  {
    seriesId: "DGS2",
    displayName: "2년물 국채금리",
    category: "금리/통화",
    warningThreshold: 5,
    dangerThreshold: 6,
  },
  {
    seriesId: "T10Y2Y",
    displayName: "10Y-2Y 스프레드",
    category: "금리/통화",
    warningThreshold: 0,    // 경계: 0% (역전 임박)
    dangerThreshold: -0.5,  // 위험: -0.5% (강한 역전)
    invertSignal: true,
  },
  {
    seriesId: "M2SL",
    displayName: "M2 통화량",
    category: "금리/통화",
    transform: "yoy",
    warningThreshold: 10,   // 경계: 10% (과잉 통화 증가)
    dangerThreshold: 15,    // 위험: 15% (강한 인플레 압력)
  },

  // 소비/심리
  {
    seriesId: "RSAFS",
    displayName: "소매판매",
    category: "소비/심리",
  },
  {
    seriesId: "PCE",
    displayName: "개인소비지출",
    category: "소비/심리",
  },
  {
    seriesId: "UMCSENT",
    displayName: "미시간 소비자심리",
    category: "소비/심리",
    warningThreshold: 70,   // 경계: 70 (불안)
    dangerThreshold: 60,    // 위험: 60 (침체 수준)
    invertSignal: true,
  },

  // 주택/시장
  {
    seriesId: "HOUST",
    displayName: "주택착공",
    category: "주택/시장",
    warningThreshold: 1200,  // 경계: 120만건
    dangerThreshold: 1000,   // 위험: 100만건
    invertSignal: true,
  },
  {
    seriesId: "CSUSHPISA",
    displayName: "Case-Shiller 주택가격",
    category: "주택/시장",
  },
  {
    seriesId: "VIXCLS",
    displayName: "VIX (변동성지수)",
    category: "주택/시장",
    warningThreshold: 25,   // 경계: 25
    dangerThreshold: 35,    // 위험: 35 (공포)
  },
];

// 전체 지표 + seriesId로 지표 찾기 (route.ts에서 YoY 여부 판단에 사용)
export const ALL_INDICATORS: Indicator[] = [
  ...CRISIS_INDICATORS,
  ...MACRO_INDICATORS,
];

export function findIndicator(seriesId: string): Indicator | undefined {
  return ALL_INDICATORS.find((i) => i.seriesId === seriesId);
}