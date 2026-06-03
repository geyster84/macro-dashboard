import { NextRequest, NextResponse } from "next/server";

const FRED_API_KEY = process.env.NEXT_PUBLIC_FRED_API_KEY;
const BASE_URL = "https://api.stlouisfed.org/fred";

// Vercel 함수 최대 실행 시간(초) — FRED가 느려도 끊기지 않게 여유
export const maxDuration = 30;

// FRED가 일시적으로 실패(429/5xx)하면 잠깐 쉬었다 다시 시도
async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  let lastRes: Response | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { next: { revalidate: 3600 } });
      lastRes = res;
      // 성공이거나, 재시도해도 소용없는 오류(429 제외한 4xx)면 바로 반환
      if (res.ok || (res.status < 500 && res.status !== 429)) {
        return res;
      }
    } catch {
      // 네트워크 오류 → 아래에서 재시도
    }
    // 마지막 시도가 아니면 잠깐 대기 (요청이 한꺼번에 몰리지 않게 약간의 무작위 지연)
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
    }
  }
  if (lastRes) return lastRes;
  throw new Error("FRED 요청 실패 (네트워크 오류)");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const seriesId = searchParams.get("seriesId");
  // startDate가 없으면 1900-01-01부터 (= FRED 전체 데이터)
  const startDate = searchParams.get("startDate") ?? "1900-01-01";
  const endDate = searchParams.get("endDate") ?? "";

  if (!seriesId) {
    return NextResponse.json({ error: "seriesId required" }, { status: 400 });
  }

  try {
    const infoUrl = `${BASE_URL}/series?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json`;

    let obsUrl = `${BASE_URL}/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=asc&observation_start=${startDate}`;
    if (endDate) obsUrl += `&observation_end=${endDate}`;

    const [infoRes, obsRes] = await Promise.all([
      fetchWithRetry(infoUrl),
      fetchWithRetry(obsUrl),
    ]);

    if (!infoRes.ok || !obsRes.ok) {
      // 실패 응답은 CDN에 저장하지 않음
      return NextResponse.json(
        { error: `FRED error: ${infoRes.status}/${obsRes.status}` },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const infoData = await infoRes.json();
    const obsData = await obsRes.json();

    const info = infoData.seriess?.[0];
    const observations = (obsData.observations || []).filter(
      (o: { value: string }) => o.value !== "."
    );

    // 성공 응답은 Vercel 엣지에 1시간 저장 → 이후 접속은 FRED 안 거치고 즉시 응답
    return NextResponse.json(
      {
        seriesId,
        title: info?.title ?? seriesId,
        units: info?.units ?? "",
        lastUpdated: info?.last_updated ?? "",
        observations,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}