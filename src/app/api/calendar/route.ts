import { NextRequest, NextResponse } from "next/server";

const FRED_API_KEY = process.env.FRED_API_KEY;
const BASE_URL = "https://api.stlouisfed.org/fred";

export const maxDuration = 30;

// 캘린더에 표시할 주요 FRED 발표 (release_id, 표시명, 중요도 1~3)
const RELEASES: { id: number; name: string; importance: number }[] = [
  { id: 50, name: "고용보고서", importance: 3 },
  { id: 10, name: "CPI 소비자물가", importance: 3 },
  { id: 54, name: "PCE·개인소득", importance: 3 },
  { id: 53, name: "GDP", importance: 2 },
  { id: 9, name: "소매판매", importance: 2 },
  { id: 46, name: "PPI 생산자물가", importance: 2 },
  { id: 13, name: "산업생산", importance: 1 },
  { id: 97, name: "주택착공", importance: 1 },
];

// FOMC 회의 (둘째 날 = 금리 결정 발표일), 2026년
const FOMC_DATES = [
  "2026-01-28",
  "2026-03-18",
  "2026-04-29",
  "2026-06-17",
  "2026-07-29",
  "2026-09-16",
  "2026-10-28",
  "2026-12-09",
];

// FRED에서 한 발표의 예정/과거 날짜 목록 가져오기
async function fetchReleaseDates(id: number): Promise<string[]> {
  const url = `${BASE_URL}/release/dates?release_id=${id}&api_key=${FRED_API_KEY}&file_type=json&include_release_dates_with_no_data=true&sort_order=desc&limit=60`;
  try {
    const res = await fetch(url, { next: { revalidate: 21600 } });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.release_dates || []).map((d: { date: string }) => d.date);
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  // 기본 구간: 이번 달 1일 ~ 다음 달 말일 (클라이언트가 start/end 보내면 그걸 사용)
  const defStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const endD = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const defEnd = `${endD.getFullYear()}-${pad(endD.getMonth() + 1)}-${pad(
    endD.getDate()
  )}`;
  const start = searchParams.get("start") || defStart;
  const end = searchParams.get("end") || defEnd;

  try {
    const results = await Promise.all(
      RELEASES.map(async (r) => {
        const dates = await fetchReleaseDates(r.id);
        return dates
          .filter((d) => d >= start && d <= end)
          .map((d) => ({ date: d, name: r.name, importance: r.importance }));
      })
    );

    const entries = results.flat();

    // FOMC 추가
    FOMC_DATES.filter((d) => d >= start && d <= end).forEach((d) =>
      entries.push({ date: d, name: "FOMC 금리결정", importance: 3 })
    );

    // 날짜순 정렬
    entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    return NextResponse.json(
      { entries },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message, entries: [] },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}